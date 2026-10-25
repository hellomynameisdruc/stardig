// A star's face: convection cells (granules) packed on the sphere, hot white in the middle, its own
// colour toward the limb, cell walls dark — dithered like the planets. Painted once per size step.
import { hash, lcg } from "../core/util";
import { BG, SC } from "./palette";

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
// faces by star and size (the map and the dossier show a star at two sizes at once); oldest dropped
const cache = new Map<number, HTMLCanvasElement>();
const MAX_FACES = 260;
let frameT0 = 0;
/** the time painting faces may take in one frame; past it a star keeps a face of another size */
const BUDGET = 3;
/** call once per frame */
export const tickFaces = () => { frameT0 = performance.now(); };
const nearest = new Map<number, number>(); // star → the size of its last painted face
const seeds = new Map<number, Float32Array>();

/** granule centres on the sphere (unit vectors), more on bigger discs */
function granules(si: number, name: string, n: number) {
  const key = si * 1000 + n; let p = seeds.get(key); if (p) return p;
  const rnd = lcg((hash(name + "·sun") % 2147483646) + 1); p = new Float32Array(n * 3);
  for (let k = 0; k < n; k++) { const z = rnd() * 2 - 1, a = rnd() * 6.283, q = Math.sqrt(1 - z * z); p[k * 3] = Math.cos(a) * q; p[k * 3 + 1] = Math.sin(a) * q; p[k * 3 + 2] = z; }
  seeds.set(key, p); return p;
}

/** the star's disc, D cells across (shared per star: draw it straight away) */
export function starFace(si: number, name: string, D: number): HTMLCanvasElement {
  const key = si * 1024 + D, have = cache.get(key);
  if (have) { cache.delete(key); cache.set(key, have); return have; } // most recently used last
  const old = nearest.get(si), oldC = old !== undefined ? cache.get(si * 1024 + old) : undefined;
  if (oldC && performance.now() - frameT0 > BUDGET) return oldC; // over budget: the last face, scaled
  const c = document.createElement("canvas"); c.width = c.height = D;
  cache.set(key, c); nearest.set(si, D);
  if (cache.size > MAX_FACES) cache.delete(cache.keys().next().value!);
  const g = c.getContext("2d")!, img = g.createImageData(D, D), d = img.data, R = D / 2, col = SC[si];
  const m = BG.replace("#", ""), bg = [0, 2, 4].map((k) => parseInt(m.slice(k, k + 2), 16) || 0);
  const n = Math.max(18, Math.min(60, Math.round(D * 0.5))), P = granules(si, name, n), id = new Int16Array(D * D).fill(-1);
  for (let j = 0; j < D; j++) for (let i = 0; i < D; i++) {
    const nx = (i + 0.5 - R) / R, ny = (j + 0.5 - R) / R, q = nx * nx + ny * ny, k = j * D + i; if (q > 1) continue;
    const nz = Math.sqrt(1 - q);
    let b = 0, b1 = -2, b2 = -2;
    for (let s = 0; s < n; s++) { const dd = nx * P[s * 3] + ny * P[s * 3 + 1] + nz * P[s * 3 + 2]; if (dd > b1) { b2 = b1; b1 = dd; b = s; } else if (dd > b2) b2 = dd; }
    id[k] = b;
    const core = nz, edge = Math.min(1, (b1 - b2) * D * 0.12); // brighter inside a cell than at its wall
    const tone = Math.min(1, 0.3 + 0.6 * core + 0.25 * edge), on = tone * 16 > BAYER[(j & 3) * 4 + (i & 3)] + 0.5 ? 1 : 0.35;
    const w = Math.max(0, core - 0.6) * 2, o = k * 4, a = tone * on; // white-hot centre
    for (let ch = 0; ch < 3; ch++) d[o + ch] = bg[ch] + (col[ch] + (255 - col[ch]) * w - bg[ch]) * a;
    d[o + 3] = 255;
  }
  if (D >= 10) for (let j = 0; j < D - 1; j++) for (let i = 0; i < D - 1; i++) {
    const k = j * D + i, v = id[k]; if (v < 0) continue;
    if ((id[k + 1] >= 0 && id[k + 1] !== v) || (id[k + D] >= 0 && id[k + D] !== v)) { const o = k * 4; d[o] *= 0.45; d[o + 1] *= 0.45; d[o + 2] *= 0.45; }
  }
  g.putImageData(img, 0, 0);
  return c;
}
/** forget painted faces (after the colours change) */
export const resetStarFaces = () => { cache.clear(); nearest.clear(); };
