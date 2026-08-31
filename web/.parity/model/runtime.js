/**
 * SANDHI — on-device model runtime.
 *
 * Evaluates the exported booster (ml/out/model.json) in plain TypeScript.
 * No TFLite, no ONNX, no WASM: 60 lines of tree walking, which is why the
 * whole inference path fits in the app bundle and runs with the radio off.
 * A 134-tree / depth-4 model scores in well under a millisecond.
 */
const isLeaf = (n) => n.f === undefined;
export function margin(model, x) {
    let f = model.base;
    for (const tree of model.trees) {
        let nd = tree;
        while (!isLeaf(nd))
            nd = x[nd.f] <= nd.t ? nd.l : nd.r;
        f += model.lr * nd.v;
    }
    return f;
}
export const sigmoid = (z) => 1 / (1 + Math.exp(-Math.max(-35, Math.min(35, z))));
export function predict(model, x) {
    return sigmoid(margin(model, x));
}
export function bandOf(model, p) {
    return p >= model.bands.refer ? "refer" : p >= model.bands.low ? "watch" : "low";
}
/**
 * Per-feature attribution in log-odds (Saabas path method), identical to
 * GBM.contributions() in ml/gbm.py. The decomposition is exact:
 *
 *     margin(x) = base + bias + sum(contributions)
 *
 * so the "why" panel the ASHA worker sees always reconciles with the score
 * printed above it. No approximation, no sampling, no background dataset.
 */
export function contributions(model, x) {
    const c = new Array(model.features.length).fill(0);
    let bias = 0;
    for (const tree of model.trees) {
        bias += model.lr * tree.v;
        let nd = tree;
        while (!isLeaf(nd)) {
            const next = x[nd.f] <= nd.t ? nd.l : nd.r;
            c[nd.f] += model.lr * (next.v - nd.v);
            nd = next;
        }
    }
    return { c, bias };
}
export function explain(model, x, topN = 6) {
    const { c } = contributions(model, x);
    return c
        .map((v, i) => ({
        feature: model.features[i],
        contribution: v,
        value: x[i],
        direction: (v >= 0 ? "raises" : "lowers"),
    }))
        .filter((e) => Math.abs(e.contribution) > 1e-6)
        .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))
        .slice(0, topN);
}
