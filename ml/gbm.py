"""
SANDHI — gradient-boosted decision trees, written from scratch on numpy.

Why not xgboost/sklearn: the field build has to run on a ₹6k Android phone with
no Python runtime. Writing the booster ourselves means the exported model is a
plain JSON array of trees that a 90-line TypeScript function can evaluate, with
no ONNX/TFLite toolchain in the loop and no version skew between what we train
and what ships.

Algorithm is the standard second-order (Newton) boosting of Chen & Guestrin:
    gain = 1/2 [ GL^2/(HL+λ) + GR^2/(HR+λ) - G^2/(H+λ) ] - γ
with histogram-binned split finding.
"""
import numpy as np


def _sigmoid(z):
    return 1.0 / (1.0 + np.exp(-np.clip(z, -35, 35)))


class Node:
    __slots__ = ("feat", "thr", "left", "right", "value", "cover")

    def __init__(self):
        self.feat = -1
        self.thr = 0.0
        self.left = None
        self.right = None
        self.value = 0.0
        self.cover = 0.0

    def is_leaf(self):
        return self.left is None


class GBM:
    def __init__(self, n_trees=300, depth=4, lr=0.06, lam=1.0, gamma=0.0,
                 min_child_weight=8.0, subsample=0.85, colsample=0.85,
                 n_bins=64, seed=0):
        self.p = dict(n_trees=n_trees, depth=depth, lr=lr, lam=lam, gamma=gamma,
                      min_child_weight=min_child_weight, subsample=subsample,
                      colsample=colsample, n_bins=n_bins, seed=seed)
        self.trees = []
        self.base = 0.0
        self.bin_edges = None
        self.n_features = 0

    # ---------------------------------------------------------- binning ----
    def _fit_bins(self, X):
        nb = self.p["n_bins"]
        self.bin_edges = []
        for j in range(X.shape[1]):
            qs = np.unique(np.quantile(X[:, j], np.linspace(0, 1, nb + 1)[1:-1]))
            self.bin_edges.append(qs)
        return self._bin(X)

    def _bin(self, X):
        B = np.empty(X.shape, dtype=np.int16)
        for j in range(X.shape[1]):
            B[:, j] = np.searchsorted(self.bin_edges[j], X[:, j], side="left")
        return B

    # ------------------------------------------------------ tree growth ----
    def _build(self, B, g, h, rows, cols, depth):
        node = Node()
        G, H = float(g[rows].sum()), float(h[rows].sum())
        node.cover = H
        node.value = -G / (H + self.p["lam"])

        if depth >= self.p["depth"] or len(rows) < 2 or H < 2 * self.p["min_child_weight"]:
            return node

        parent = (G * G) / (H + self.p["lam"])
        best = (0.0, -1, 0)          # gain, feature, bin
        nb = self.p["n_bins"] + 1

        for j in cols:
            bj = B[rows, j]
            gh = np.bincount(bj, weights=g[rows], minlength=nb)
            hh = np.bincount(bj, weights=h[rows], minlength=nb)
            GL = np.cumsum(gh)[:-1]
            HL = np.cumsum(hh)[:-1]
            GR, HR = G - GL, H - HL
            ok = (HL >= self.p["min_child_weight"]) & (HR >= self.p["min_child_weight"])
            if not ok.any():
                continue
            gain = 0.5 * (GL * GL / (HL + self.p["lam"])
                          + GR * GR / (HR + self.p["lam"]) - parent) - self.p["gamma"]
            gain = np.where(ok, gain, -np.inf)
            k = int(np.argmax(gain))
            if gain[k] > best[0]:
                best = (float(gain[k]), j, k)

        if best[1] < 0:
            return node

        _, j, k = best
        edges = self.bin_edges[j]
        node.feat = j
        node.thr = float(edges[k]) if k < len(edges) else float(edges[-1] if len(edges) else 0.0)
        mask = B[rows, j] <= k
        lrows, rrows = rows[mask], rows[~mask]
        if len(lrows) == 0 or len(rrows) == 0:
            node.feat = -1
            return node
        node.left = self._build(B, g, h, lrows, cols, depth + 1)
        node.right = self._build(B, g, h, rrows, cols, depth + 1)
        return node

    @staticmethod
    def _apply(node, X):
        out = np.empty(len(X))
        stack = [(node, np.arange(len(X)))]
        while stack:
            nd, idx = stack.pop()
            if nd.is_leaf():
                out[idx] = nd.value
                continue
            m = X[idx, nd.feat] <= nd.thr
            stack.append((nd.left, idx[m]))
            stack.append((nd.right, idx[~m]))
        return out

    # ------------------------------------------------------------- fit ----
    def fit(self, X, y, Xva=None, yva=None, early_stop=30, verbose=False):
        rng = np.random.default_rng(self.p["seed"])
        self.n_features = X.shape[1]
        B = self._fit_bins(X)
        n = len(y)
        pos = float(np.mean(y))
        self.base = float(np.log(pos / (1 - pos)))
        F = np.full(n, self.base)
        Fva = np.full(len(yva), self.base) if Xva is not None else None

        best_ll, best_iter, hist = np.inf, 0, []
        for t in range(self.p["n_trees"]):
            p = _sigmoid(F)
            g = p - y
            h = np.maximum(p * (1 - p), 1e-6)

            rows = np.arange(n)
            if self.p["subsample"] < 1.0:
                rows = rng.choice(n, int(self.p["subsample"] * n), replace=False)
            cols = np.arange(self.n_features)
            if self.p["colsample"] < 1.0:
                cols = rng.choice(self.n_features,
                                  max(1, int(self.p["colsample"] * self.n_features)),
                                  replace=False)

            tree = self._build(B, g, h, rows, cols, 0)
            self.trees.append(tree)
            F += self.p["lr"] * self._apply(tree, X)

            if Xva is not None:
                Fva += self.p["lr"] * self._apply(tree, Xva)
                q = _sigmoid(Fva)
                ll = float(-np.mean(yva * np.log(q + 1e-12) + (1 - yva) * np.log(1 - q + 1e-12)))
                hist.append(ll)
                if ll < best_ll - 1e-5:
                    best_ll, best_iter = ll, t
                elif t - best_iter >= early_stop:
                    self.trees = self.trees[:best_iter + 1]
                    if verbose:
                        print(f"  early stop @ {best_iter+1} trees, val logloss {best_ll:.4f}")
                    break
        self.val_hist = hist
        return self

    # --------------------------------------------------------- predict ----
    def margin(self, X):
        F = np.full(len(X), self.base)
        for tr in self.trees:
            F += self.p["lr"] * self._apply(tr, X)
        return F

    def predict_proba(self, X):
        return _sigmoid(self.margin(X))

    # ------------------------------------------------- explainability -----
    def contributions(self, x):
        """Per-feature attribution in log-odds for ONE sample (Saabas path method).

        Walking each tree, the change in node value from parent to chosen child
        is credited to the feature that made the split. The decomposition is
        exact:

            margin(x) = base + bias + sum(contributions)

        where bias is lr * (sum of tree root values). Returning the bias too
        means the explanation shown to the ASHA worker always reconciles with
        the score she is looking at, to the last decimal.
        """
        c = np.zeros(self.n_features)
        bias = 0.0
        for tr in self.trees:
            bias += self.p["lr"] * tr.value
            nd = tr
            while not nd.is_leaf():
                nxt = nd.left if x[nd.feat] <= nd.thr else nd.right
                c[nd.feat] += self.p["lr"] * (nxt.value - nd.value)
                nd = nxt
        return c, float(bias)

    def gain_importance(self):
        """Total loss reduction attributable to each feature."""
        imp = np.zeros(self.n_features)

        def walk(nd):
            if nd.is_leaf():
                return
            # Reduction in the regularised objective at this split.
            gl = nd.left.value ** 2 * (nd.left.cover + self.p["lam"])
            gr = nd.right.value ** 2 * (nd.right.cover + self.p["lam"])
            gp = nd.value ** 2 * (nd.cover + self.p["lam"])
            imp[nd.feat] += max(0.0, 0.5 * (gl + gr - gp))
            walk(nd.left)
            walk(nd.right)

        for tr in self.trees:
            walk(tr)
        s = imp.sum()
        return imp / s if s > 0 else imp

    # -------------------------------------------------------- export ------
    def to_json(self, feature_names):
        def enc(nd):
            if nd.is_leaf():
                return {"v": float(nd.value)}
            # Thresholds are exported at FULL precision, never rounded.
            # Several features are discrete (burst counts / 6 s, squat load,
            # the yes/no questions), so a split threshold lands exactly on an
            # observed value all the time. Rounding the threshold to 9 dp sends
            # every tied sample down the opposite branch and the phone quietly
            # disagrees with the trainer. Internal nodes carry their
            # Newton-optimal value too: the on-device attribution path needs it
            # to reproduce contributions() exactly.
            return {"f": int(nd.feat), "t": float(nd.thr), "v": float(nd.value),
                    "l": enc(nd.left), "r": enc(nd.right)}
        return {
            "format": "sandhi-gbm/1",
            "features": list(feature_names),
            "base": round(self.base, 6),
            "lr": self.p["lr"],
            "trees": [enc(t) for t in self.trees],
        }

    @classmethod
    def from_json(cls, doc: dict) -> "GBM":
        """:class:`GBM` reconstructed from a :meth:`to_json` document.

        Tree thresholds are embedded as full-precision floats, so a rebuilt
        model predicts bit-identically to the trainer for any input in the
        trained feature space. This is the loader the sync server uses to
        cross-check phone-reported risk against the same artifact the phone
        ships.
        """
        m = cls(n_trees=len(doc["trees"]), lr=doc["lr"], seed=0)
        m.n_features = len(doc["features"])
        m.base = doc["base"]
        m.bin_edges = [[] for _ in range(m.n_features)]

        def dec(nd: dict) -> Node:
            if "l" in nd:
                node = Node()
                node.feat, node.thr, node.value = nd["f"], nd["t"], nd["v"]
                node.left, node.right = dec(nd["l"]), dec(nd["r"])
                return node
            node = Node()
            node.value = nd["v"]
            return node

        m.trees = [dec(t) for t in doc["trees"]]
        return m


# ------------------------------------------------------------- metrics ----

def roc_auc(y, s):
    o = np.argsort(s)
    r = np.empty(len(s), float)
    r[o] = np.arange(1, len(s) + 1)
    # average ranks for ties
    ss = s[o]
    i = 0
    while i < len(ss):
        j = i
        while j + 1 < len(ss) and ss[j + 1] == ss[i]:
            j += 1
        if j > i:
            r[o[i:j + 1]] = 0.5 * (i + 1 + j + 1)
        i = j + 1
    n1 = float(y.sum())
    n0 = float(len(y) - n1)
    if n1 == 0 or n0 == 0:
        return 0.5
    return float((r[y == 1].sum() - n1 * (n1 + 1) / 2) / (n0 * n1))


def brier(y, p):
    return float(np.mean((p - y) ** 2))


def at_threshold(y, p, thr):
    pred = (p >= thr).astype(int)
    tp = int(((pred == 1) & (y == 1)).sum())
    fp = int(((pred == 1) & (y == 0)).sum())
    fn = int(((pred == 0) & (y == 1)).sum())
    tn = int(((pred == 0) & (y == 0)).sum())
    sens = tp / (tp + fn) if tp + fn else 0.0
    spec = tn / (tn + fp) if tn + fp else 0.0
    ppv = tp / (tp + fp) if tp + fp else 0.0
    npv = tn / (tn + fn) if tn + fn else 0.0
    return dict(threshold=round(thr, 3), tp=tp, fp=fp, fn=fn, tn=tn,
                sensitivity=round(sens, 4), specificity=round(spec, 4),
                ppv=round(ppv, 4), npv=round(npv, 4),
                youden=round(sens + spec - 1, 4))
