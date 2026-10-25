// Planet surfaces: each label's world as a little relief map — terrain in contour bands, craters with
// rims, ice caps, canyons, storm bands and storms on the giants — wrapped on a sphere, lit from the
// upper left and dithered like the rest of the screen. Everything about it (the kind of ground, how
// fine, how many craters, caps or not, the tint) comes from the label's name, so each planet looks
// its own way and always the same.
import type { PType } from "../core/types";
import { hash, lcg } from "../core/util";
import { BG, SC } from "./palette";

/** a planet's make-up, rolled once from its name */
export type Genome = {
  ground: "continents" | "ridged" | "patchy" | "canyons";
  freq: number; levels: number; craters: number; craterSize: number; cap: number; // cap: 0 = none, else the latitude it starts at
  bandFreq: number; turb: number; storms: number; gamma: number; tint: number; // tint: + toward white, − toward dark
  ringW: number; ringRx: number; ringRy: number; ring2: boolean;
};
const genomes = new Map<string, Genome>();
export function genome(name: string, ty: PType): Genome {
  const key = ty + "|" + name; let g = genomes.get(key); if (g) return g;
  const rnd = lcg((hash(name + "·genome") % 2147483646) + 1), pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];
  const baseCr = ty === "ancient" ? 12 : ty === "rocky" || ty === "ringed" ? 5 : ty === "young" ? 1 : 0;
  g = {
    ground: ty === "young" ? pick(["continents", "patchy"] as const) : pick(["continents", "ridged", "patchy", "canyons"] as const),
    freq: 1.1 + rnd() * 1.6, levels: 4 + Math.floor(rnd() * 4),
    craters: ty === "giant" ? 0 : Math.round(baseCr * (0.4 + rnd() * 1.2) + (rnd() < 0.25 ? 4 : 0)), craterSize: 0.6 + rnd() * 0.9,
    cap: rnd() < (ty === "young" ? 0.6 : 0.3) ? 0.62 + rnd() * 0.26 : 0,
    bandFreq: 6 + rnd() * 9, turb: 1.4 + rnd() * 3.8, storms: ty === "giant" ? Math.floor(rnd() * 3) : 0,
    gamma: 0.8 + rnd() * 0.45, tint: rnd() < 0.5 ? rnd() * 0.32 : -rnd() * 0.25,
    ringW: 0.07 + rnd() * 0.1, ringRx: 1.7 + rnd() * 0.5, ringRy: 0.2 + rnd() * 0.12, ring2: rnd() < 0.4,
  };
  if (genomes.size > 2000) genomes.delete(genomes.keys().next().value!);
  genomes.set(key, g);
  return g;
}

// the map: longitude × latitude; small planets use a coarse one, big ones a fine one so turning is smooth
type Tex = { w: number; h: number; band: Uint8Array; pit: Uint8Array }; // pit: 0 ground, 1 low (crater floor, canyon), 2 rim, 3 ice
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

function texture(name: string, ty: PType, w: number): Tex {
  const key = w + "|" + ty + "|" + name; let t = texCache.get(key); if (t) return t;
  const h = hash(name), G = genome(name, ty), N = noise3(h), N2 = noise3(h ^ 0x9e3779b9), rnd = lcg((h % 2147483646) + 1), hh = w / 2;
  const unit = () => { const lon = rnd() * 6.283, lat = Math.asin(rnd() * 1.7 - 0.85); return [Math.cos(lat) * Math.sin(lon), Math.sin(lat), Math.cos(lat) * Math.cos(lon)]; };
  // craters (and the giants' storms) as caps on the sphere: compare dot products, no trigonometry per texel
  const spots = Array.from({ length: G.craters + G.storms }, (_, k) => {
    const [x, y, z] = unit(), storm = k >= G.craters, s = storm ? 0.16 + rnd() * 0.14 : (0.05 + Math.pow(rnd(), 2.2) * 0.26) * G.craterSize;
    return { x, y: storm ? y * 0.5 : y, z, c0: Math.cos(s), c1: Math.cos(s * 0.78), storm };
  });
  const band = new Uint8Array(w * hh), pit = new Uint8Array(w * hh), off = (h % 97) / 9, L = G.levels, f = G.freq;
  for (let j = 0; j < hh; j++) for (let i = 0; i < w; i++) {
    const lat = ((j + 0.5) / hh - 0.5) * Math.PI, lon = ((i + 0.5) / w) * Math.PI * 2;
    const x = Math.cos(lat) * Math.sin(lon), y = Math.sin(lat), z = Math.cos(lat) * Math.cos(lon), k = j * w + i;
    let v: number, p = 0;
    if (ty === "giant") v = 0.5 + 0.5 * Math.sin(y * G.bandFreq + off + N(x * 2 + off, y * 2, z * 2) * G.turb);
    else {
      const fbm = N(x * f + off, y * f, z * f) * 0.62 + N(x * f * 2.5, y * f * 2.5 + off, z * f * 2.5) * 0.28 + N(x * f * 6, y * f * 6, z * f * 6 + off) * 0.1;
      if (G.ground === "ridged") v = 1 - Math.abs(fbm * 2 - 1);
      else if (G.ground === "patchy") v = N(x * f * 2.2 + off, y * f * 2.2, z * f * 2.2) * 0.7 + fbm * 0.3;
      else if (G.ground === "continents") v = fbm < 0.45 ? 0.05 : 0.2 + (fbm - 0.45) * 1.6; // flat seas, stepped land
      else { v = fbm; if (Math.abs(N2(x * f * 1.8, y * f * 1.8, z * f * 1.8) - 0.5) < 0.025) p = 1; } // canyons
    }
    band[k] = Math.max(0, Math.min(L - 1, Math.floor(v * L)));
    if (G.cap && Math.abs(y) > G.cap + (N2(x * 3, y * 3, z * 3) - 0.5) * 0.12) p = 3;
    for (const s of spots) {
      const d = x * s.x + y * s.y + z * s.z;
      if (d > s.c0) { if (s.storm) { band[k] = d > s.c1 ? (L - 1) : 0; p = d > s.c1 ? 0 : 2; } else p = Math.max(p === 3 ? 0 : p, d > s.c1 ? 1 : 2); }
    }
    pit[k] = p;
  }
  t = { w, h: hh, band, pit };
  // the fine maps are big (½ MB each): keep few of them
  const fine = [...texCache.keys()].filter((k) => !k.startsWith("128|"));
  if (fine.length > 30) texCache.delete(fine[0]);
  if (texCache.size > 400) texCache.delete(texCache.keys().next().value!);
  texCache.set(key, t);
  return t;
}

// per-size geometry of the disc: which cells are on it, their longitude (in turns) / latitude and light
type Geo = { on: Uint8Array; lon: Float32Array; lat: Float32Array; lam: Float32Array; img: ImageData };
const geoCache = new Map<number, Geo>();
const scratch = document.createElement("canvas");
const sg = scratch.getContext("2d", { willReadFrequently: true })!; // pixels are written here: keep it off the GPU (no sync stalls)
function geo(D: number): Geo {
  let g = geoCache.get(D); if (g) return g;
  const n = D * D, on = new Uint8Array(n), lon = new Float32Array(n), lat = new Float32Array(n), lam = new Float32Array(n), R = D / 2;
  for (let j = 0; j < D; j++) for (let i = 0; i < D; i++) {
    const nx = (i + 0.5 - R) / R, ny = (j + 0.5 - R) / R, q = nx * nx + ny * ny, k = j * D + i;
    if (q > 1) continue;
    const nz = Math.sqrt(1 - q);
    on[k] = 1;
    lon[k] = Math.atan2(nx, nz) / (Math.PI * 2);
    lat[k] = Math.asin(ny) / Math.PI + 0.5;
    lam[k] = Math.max(0, -nx * 0.55 - ny * 0.6 + nz * 0.58); // light from the upper left
  }
  g = { on, lon, lat, lam, img: sg.createImageData(D, D) };
  if (geoCache.size > 10) geoCache.delete(geoCache.keys().next().value!);
  geoCache.set(D, g);
  return g;
}

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
let key: Int16Array = new Int16Array(0);
const bgRgb = () => { const m = BG.replace("#", ""); return [0, 2, 4].map((k) => parseInt(m.slice(k, k + 2), 16) || 0); };

/** the largest map drawn cell by cell; bigger planets are this map, scaled up in crisp pixels */
export const MAX_CELLS = 300;
/** the map width used for a disc D cells across */
export const texW = (D: number) => (D > 90 ? 512 : 128);

/**
 * Paints a planet's surface, turned by `spin` radians, as a D×D-cell disc and returns the canvas
 * (shared: draw it straight away). One cell is one screen pixel up to MAX_CELLS across.
 */
const pending = new Set<string>();
export const texReady = (name: string, ty: PType, w: number) => w === 128 || texCache.has(w + "|" + ty + "|" + name);
/** the fine map is made between frames; until it is ready the coarse one stands in */
function texFor(name: string, ty: PType, w: number) {
  if (w === 128) return texture(name, ty, 128);
  const k = w + "|" + ty + "|" + name, t = texCache.get(k);
  if (t) return t;
  if (!pending.has(k)) { pending.add(k); setTimeout(() => { texture(name, ty, w); pending.delete(k); }, 0); }
  return texture(name, ty, 128);
}

export function surface(name: string, ty: PType, si: number, D: number, spin: number): HTMLCanvasElement {
  const G = genome(name, ty), t = texFor(name, ty, texW(D)), g = geo(D), bg = bgRgb(), tw = t.w, th = t.h;
  const tint = G.tint, col = SC[si].map((v) => (tint > 0 ? v + (255 - v) * tint : v * (1 + tint)));
  if (scratch.width !== D || scratch.height !== D) { scratch.width = D; scratch.height = D; }
  if (key.length < D * D) key = new Int16Array(D * D);
  const d = g.img.data, shift = (spin / (Math.PI * 2)) * tw, fade = ty === "young" ? 0.6 : 1, L = G.levels, gam = G.gamma;
  const put = (o: number, a: number) => { d[o] = bg[0] + (col[0] - bg[0]) * a; d[o + 1] = bg[1] + (col[1] - bg[1]) * a; d[o + 2] = bg[2] + (col[2] - bg[2]) * a; d[o + 3] = 255; };
  for (let k = 0; k < D * D; k++) {
    if (!g.on[k]) { key[k] = -1; d[k * 4 + 3] = 0; continue; }
    let c = Math.floor(g.lon[k] * tw + shift) % tw; if (c < 0) c += tw;
    const tk = Math.min(th - 1, Math.floor(g.lat[k] * th)) * tw + c, b = t.band[tk], p = t.pit[tk];
    key[k] = p === 2 ? 99 : b + p * 10;
    const lam = g.lam[k];
    let tone = Math.pow((0.16 + 0.84 * lam) * (0.5 + 0.5 * b / Math.max(1, L - 1)), gam);
    if (p === 1) tone *= 0.45; else if (p === 3) tone = Math.min(1, tone * 1.6 + 0.15);
    const i = k % D, j = (k / D) | 0, on = tone * 16 > BAYER[(j & 3) * 4 + (i & 3)] + 0.5 ? 1 : 0.3;
    put(k * 4, Math.min(1, tone * on * 1.05) * fade);
  }
  // contour lines where the ground changes level, and rims; dimmer on the night side
  if (D >= 9) for (let j = 0; j < D - 1; j++) for (let i = 0; i < D - 1; i++) {
    const k = j * D + i, v = key[k]; if (v < 0) continue;
    const r = key[k + 1], dn = key[k + D];
    if (v === 99 || (r >= 0 && r !== v) || (dn >= 0 && dn !== v)) put(k * 4, (0.45 + 0.55 * Math.min(1, g.lam[k] * 1.6)) * fade);
  }
  sg.putImageData(g.img, 0, 0);
  return scratch;
}
