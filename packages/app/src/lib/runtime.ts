/**
 * SANDHI - on-device model runtime. Port of web/lib/model/runtime.ts.
 *
 * Evaluates the exported booster (assets/model.json) in plain TypeScript.
 * No TFLite, no ONNX, no WASM: ~60 lines of tree walking, which is why the
 * whole inference path fits in the app bundle and runs with the radio off.
 */

export type Leaf = { v: number; f?: undefined };
export type Split = { f: number; t: number; v: number; l: TreeNode; r: TreeNode };
export type TreeNode = Leaf | Split;

export interface SandhiModel {
  format: string;
  features: string[];
  base: number;
  lr: number;
  trees: TreeNode[];
  bands: { low: number; refer: number };
  trained: string;
  cohort: { kind: string; n: number; generator: string; seed: number };
}

export type Band = "low" | "watch" | "refer";

const isLeaf = (n: TreeNode): n is Leaf => n.f === undefined;

export function margin(model: SandhiModel, x: number[]): number {
  let f = model.base;
  for (const tree of model.trees) {
    let nd: TreeNode = tree;
    while (!isLeaf(nd)) nd = x[nd.f] <= nd.t ? nd.l : nd.r;
    f += model.lr * nd.v;
  }
  return f;
}

export const sigmoid = (z: number) => 1 / (1 + Math.exp(-Math.max(-35, Math.min(35, z))));

export function predict(model: SandhiModel, x: number[]): number {
  return sigmoid(margin(model, x));
}

export function bandOf(model: SandhiModel, p: number): Band {
  return p >= model.bands.refer ? "refer" : p >= model.bands.low ? "watch" : "low";
}

export function contributions(model: SandhiModel, x: number[]): { c: number[]; bias: number } {
  const c = new Array(model.features.length).fill(0);
  let bias = 0;
  for (const tree of model.trees) {
    bias += model.lr * tree.v;
    let nd: TreeNode = tree;
    while (!isLeaf(nd)) {
      const next = x[nd.f] <= nd.t ? nd.l : nd.r;
      c[nd.f] += model.lr * (next.v - nd.v);
      nd = next;
    }
  }
  return { c, bias };
}

export interface Explanation {
  feature: string;
  contribution: number;
  value: number;
  direction: "raises" | "lowers";
}

export function explain(model: SandhiModel, x: number[], topN = 6): Explanation[] {
  const { c } = contributions(model, x);
  return c
    .map((v, i) => ({
      feature: model.features[i],
      contribution: v,
      value: x[i],
      direction: (v >= 0 ? "raises" : "lowers") as "raises" | "lowers",
    }))
    .filter((e) => Math.abs(e.contribution) > 1e-6)
    .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))
    .slice(0, topN);
}