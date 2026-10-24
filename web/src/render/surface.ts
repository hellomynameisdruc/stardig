// Planet surfaces: each label's world as a little relief map — terrain in contour bands, craters with
// rims, storm bands on the giants — wrapped on a sphere, lit from the upper left and dithered like the
// rest of the screen. The map comes from the label's name, so a planet always looks the same.
import type { PType } from "../core/types";
import { hash, lcg } from "../core/util";
import { BG, SC } from "./palette";

const TW = 256, TH = 128; // the map: longitude × latitude
type Tex = { band: Uint8Array; pit: Uint8Array }; // pit: 0 ground, 1 crater floor, 2 rim
const texCache = new Map<string, Tex>();

/** smooth 3D value noise, seeded; sampled on the sphere so the map has no seam */
function noise3(seed: number) {
  const rnd = lcg(seed || 1), P = new Uint8Array(512), V = new Float32Array(256);
  for (let i = 0; i < 256; i++) { P[i] = i; V[i] = rnd(); }
  for (let i = 255; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = P[i]; P[i] = P[j]; P[j] = t; }
  for (let i = 0; i < 256; i++) P[i + 256] = P[i];
  const h = (x: number, y: number, z: number) => V[P[P[P[x & 255] + (y & 255)] + (z & 255)]];
  const s = (t: number) => t * t * (3 - 2 * t), L = (a: number, b: number, t: number) => a + (b - a) * t;
  return (x: number, y: number, z: number) => {
    const X = Math.floor(x), Y = Math.floor(y), Z = Math.floor(z), u = s(x - X), v = s(y - Y), w = s(z - Z);
    return L(L(L(h(X, Y, Z), h(X + 1, Y, Z), u), L(h(X, Y + 1, Z), h(X + 1, Y + 1, Z), u), v),
      L(L(h(X, Y, Z + 1), h(X + 1, Y, Z + 1), u), L(h(X, Y + 1, Z + 1), h(X + 1, Y + 1, Z + 1), u), v), w);
  };
}

function texture(name: string, ty: PType): Tex {
  const key = ty + "|" + name; let t = texCache.get(key); if (t) return t;
  const h = hash(name), N = noise3(h), rnd = lcg((h % 2147483646) + 1);
  const nCr = ty === "ancient" ? 16 : ty === "giant" || ty === "young" ? 0 : 6;
  const craters = Array.from({ length: nCr }, () => {
    const lon = rnd() * 6.283, lat = Math.asin(rnd() * 1.6 - 0.8);
    return { x: Math.cos(lat) * Math.sin(lon), y: Math.sin(lat), z: Math.cos(lat) * Math.cos(lon), s: 0.07 + Math.pow(rnd(), 2.2) * 0.3 };
  });
  const band = new Uint8Array(TW * TH), pit = new Uint8Array(TW * TH), off = (h % 97) / 9;
  for (let j = 0; j < TH; j++) for (let i = 0; i < TW; i++) {
    const lat = ((j + 0.5) / TH - 0.5) * Math.PI, lon = ((i + 0.5) / TW) * Math.PI * 2;
    const x = Math.cos(lat) * Math.sin(lon), y = Math.sin(lat), z = Math.cos(lat) * Math.cos(lon);
    let v: number, levels = 6;
    if (ty === "giant") { v = 0.5 + 0.5 * Math.sin(y * 9 + off + N(x * 2 + off, y * 2, z * 2) * 3.4); levels = 5; }
    else if (ty === "young") { v = N(x * 1.3 + off, y * 1.3, z * 1.3); levels = 4; }
    else v = N(x * 1.6 + off, y * 1.6, z * 1.6) * 0.62 + N(x * 4, y * 4 + off, z * 4) * 0.28 + N(x * 9, y * 9, z * 9 + off) * 0.1;
    const k = j * TW + i;
    band[k] = Math.min(levels - 1, Math.floor(v * levels));
    for (const c of craters) {
      const d = Math.acos(Math.max(-1, Math.min(1, x * c.x + y * c.y + z * c.z)));
      if (d < c.s) pit[k] = Math.max(pit[k], d > c.s * 0.78 ? 2 : 1);
    }
  }
  t = { band, pit };
  if (texCache.size > 400) texCache.delete(texCache.keys().next().value!);
  texCache.set(key, t);
  return t;
}

// per-size geometry of the disc: which cells are on it, their longitude/latitude cell and light
type Geo = { D: number; on: Uint8Array; lon: Float32Array; row: Int16Array; lam: Float32Array };
const geoCache = new Map<number, Geo>();
function geo(D: number): Geo {
  let g = geoCache.get(D); if (g) return g;
  const n = D * D, on = new Uint8Array(n), lon = new Float32Array(n), row = new Int16Array(n), lam = new Float32Array(n), R = D / 2;
  for (let j = 0; j < D; j++) for (let i = 0; i < D; i++) {
    const nx = (i + 0.5 - R) / R, ny = (j + 0.5 - R) / R, q = nx * nx + ny * ny, k = j * D + i;
    if (q > 1) continue;
    const nz = Math.sqrt(1 - q);
    on[k] = 1;
    lon[k] = (Math.atan2(nx, nz) / (Math.PI * 2)) * TW;
    row[k] = Math.min(TH - 1, Math.max(0, Math.floor((Math.asin(ny) / Math.PI + 0.5) * TH)));
    lam[k] = Math.max(0, -nx * 0.55 - ny * 0.6 + nz * 0.58); // light from the upper left
  }
  g = { D, on, lon, row, lam };
  if (geoCache.size > 40) geoCache.delete(geoCache.keys().next().value!);
  geoCache.set(D, g);
  return g;
}

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const scratch = document.createElement("canvas");
const sg = scratch.getContext("2d")!;
let key: Int16Array = new Int16Array(0);
const bgRgb = () => { const m = BG.replace("#", ""); return [0, 2, 4].map((k) => parseInt(m.slice(k, k + 2), 16) || 0); };

/** the largest map drawn cell by cell; bigger planets are this map, scaled up in crisp pixels */
export const MAX_CELLS = 300;

/**
 * Paints planet i's surface, turned by `spin` radians, as a D×D-cell disc and returns the canvas
 * (shared: draw it straight away). One cell is one screen pixel up to MAX_CELLS across.
 */
export function surface(name: string, ty: PType, si: number, D: number, spin: number): HTMLCanvasElement {
  const t = texture(name, ty), g = geo(D), col = SC[si], bg = bgRgb();
  if (scratch.width !== D) { scratch.width = scratch.height = D; } else sg.clearRect(0, 0, D, D);
  if (key.length < D * D) key = new Int16Array(D * D);
  const img = sg.createImageData(D, D), d = img.data, shift = (spin / (Math.PI * 2)) * TW, young = ty === "young";
  const fade = young ? 0.6 : 1;
  for (let k = 0; k < D * D; k++) {
    if (!g.on[k]) { key[k] = -1; continue; }
    let c = Math.floor(g.lon[k] + shift) % TW; if (c < 0) c += TW;
    const tk = g.row[k] * TW + c, b = t.band[tk], p = t.pit[tk];
    key[k] = p === 2 ? 99 : b + p * 10;
    const lam = g.lam[k];
    let tone = (0.16 + 0.84 * lam) * (0.55 + 0.45 * (b % 3) / 2);
    if (p === 1) tone *= 0.5;
    const i = k % D, j = (k / D) | 0, on = tone * 16 > BAYER[(j & 3) * 4 + (i & 3)] + 0.5 ? 1 : 0.3, a = Math.min(1, tone * on * 1.05) * fade, o = k * 4;
    d[o] = bg[0] + (col[0] - bg[0]) * a; d[o + 1] = bg[1] + (col[1] - bg[1]) * a; d[o + 2] = bg[2] + (col[2] - bg[2]) * a; d[o + 3] = 255;
  }
  // contour lines where the ground changes level, and crater rims; dimmer on the night side
  if (D >= 9) for (let j = 0; j < D - 1; j++) for (let i = 0; i < D - 1; i++) {
    const k = j * D + i, v = key[k]; if (v < 0) continue;
    const r = key[k + 1], dn = key[k + D];
    if (v === 99 || (r >= 0 && r !== v) || (dn >= 0 && dn !== v)) {
      const a = (0.45 + 0.55 * Math.min(1, g.lam[k] * 1.6)) * fade, o = k * 4;
      d[o] = bg[0] + (col[0] - bg[0]) * a; d[o + 1] = bg[1] + (col[1] - bg[1]) * a; d[o + 2] = bg[2] + (col[2] - bg[2]) * a;
    }
  }
  sg.putImageData(img, 0, 0);
  return scratch;
}
