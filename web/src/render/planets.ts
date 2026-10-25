// Planets: how each type looks, cached sprites, and drawing them at their moving positions.
import { hash } from "../core/util";
import { baseChunk, galaxy, motion, state } from "../app/state";
import { sc } from "./palette";
import { genome, MAX_CELLS, surface, texReady, texW } from "./surface";
import { cam, LOD_PLANETS } from "./camera";
import { inView, inLive } from "./view";
import { labels } from "./labels";
import { hudFits } from "./markers";

// Planets drawn every frame (the one you are at, turning; or one too big for a sprite) keep their
// painted surface and repaint it only when it has turned by one column of its map, or its size moved
// to another step. slot: 0 the map, 1 the dossier (one planet can be in both at different sizes).
const live = new Map<number, { c: HTMLCanvasElement; D: number; q: number; fine: boolean; at: number }>();
const stepD = (D: number) => Math.min(200, Math.round(Math.pow(2, Math.round(Math.log2(D) * 5) / 5)));
function liveSurface(i: number, D: number, spin: number, slot: number) {
  const step = (Math.PI * 2) / texW(D), q = Math.round(spin / step), id = i * 2 + slot;
  let e = live.get(id);
  const fine = texReady(galaxy.planets[i].name, galaxy.ptype[i], texW(D));
  if (e && e.q === q && e.D === D && e.fine === fine) return e.c;
  if (e && e.D && performance.now() - frameT0 > SPRITE_BUDGET) return e.c; // over this frame's budget: as it was, scaled
  // turning: a new picture at most ~12 times a second (each is a full repaint of the surface)
  if (e && e.D === D && e.fine === fine && performance.now() - e.at < 80) return e.c;
  const pl = galaxy.planets[i], src = surface(pl.name, galaxy.ptype[i], pl.s, D, q * step);
  if (!e) { if (live.size > 8) live.delete(live.keys().next().value!); e = { c: document.createElement("canvas"), D: 0, q: 0, fine: false, at: 0 }; live.set(id, e); }
  if (e.c.width !== D || e.c.height !== D) { e.c.width = D; e.c.height = D; } // a new canvas is 300×150: check both
  const g = e.c.getContext("2d")!; g.clearRect(0, 0, D, D); g.drawImage(src, 0, 0);
  e.D = D; e.q = q; e.fine = fine; e.at = performance.now();
  return e.c;
}
/** forget painted surfaces (after the colours change) */
export function resetSurfaces() { live.clear(); for (let i = 0; i < pSprite.length; i++) if (pSprite[i]) { free(pSprite[i]!.c); pSprite[i] = null; spriteCount--; } }

/**
 * banded giants, ringed long-runners, cratered retired labels, icy newcomers: the surface is a relief
 * map (render/surface.ts) drawn in crisp screen pixels. `spin` (radians) turns it round the planet's
 * axis; light, shadow and rings stay where they are.
 */
export function drawPlanetBody(G: CanvasRenderingContext2D, i: number, x: number, y: number, r: number, spin = 0, slot = -1) {
  const pl = galaxy.planets[i], si = pl.s, ty = galaxy.ptype[i], h = hash(pl.name), ringed = galaxy.ringed[i], gn = genome(pl.name, ty);
  const tilt = -0.5 + (h % 100) / 100 * 0.45, rx = r * gn.ringRx, ry = rx * gn.ringRy, rw = Math.max(1, r * gn.ringW);
  // rings: the far half behind the planet, the near half in front; some have a thin inner ring too
  const rings = (a0: number, a1: number, a: number) => {
    G.strokeStyle = sc(si, a); G.lineWidth = rw; G.beginPath(); G.ellipse(x, y, rx, ry, tilt, a0, a1); G.stroke();
    if (gn.ring2) { G.lineWidth = Math.max(1, rw * 0.4); G.beginPath(); G.ellipse(x, y, rx * 0.8, ry * 0.8, tilt, a0, a1); G.stroke(); }
  };
  if (ringed) rings(Math.PI, Math.PI * 2, 0.5);
  const D = slot >= 0 ? stepD(Math.max(4, r * 2)) : Math.min(MAX_CELLS, Math.max(4, Math.round(r * 2)));
  const sm = G.imageSmoothingEnabled; G.imageSmoothingEnabled = false;
  const src = slot >= 0 ? liveSurface(i, D, spin, slot) : surface(pl.name, ty, si, D, spin);
  // only the part on screen: a small map blown up far past the canvas edges draws wrongly in Chrome
  const big = slot === 0, vw = big ? cam.W : Infinity, vh = big ? cam.H : Infinity, cell = (2 * r) / D; // the map's view, in CSS px
  const c0 = Math.max(0, Math.floor((0 - (x - r)) / cell)), c1 = Math.min(D, Math.ceil((vw - (x - r)) / cell));
  const r0 = Math.max(0, Math.floor((0 - (y - r)) / cell)), r1 = Math.min(D, Math.ceil((vh - (y - r)) / cell));
  if (c1 > c0 && r1 > r0) G.drawImage(src, c0, r0, c1 - c0, r1 - r0, x - r + c0 * cell, y - r + r0 * cell, (c1 - c0) * cell, (r1 - r0) * cell);
  G.imageSmoothingEnabled = sm;
  G.strokeStyle = sc(si, 0.95); G.lineWidth = 1;
  if (ty === "young") G.setLineDash([2, 2]);
  G.beginPath(); G.arc(x, y, r, 0, 7); G.stroke(); G.setLineDash([]);
  if (ringed) rings(0, Math.PI, 0.95);
}

// Planet bodies are cached as sprites at bucketed sizes (~19% steps) and scaled to the exact size,
// so zooming doesn't repaint every planet on every wheel tick. Unused sprites are dropped.
const pSprite: ({ c: HTMLCanvasElement; rb: number; used: number } | null)[] = galaxy.planets.map(() => null);
let frameNo = 0, spriteCount = 0, frameT0 = 0, spritePx = 0;
/** sprite memory kept, in pixels (×4 bytes): past it the least recently drawn are dropped. Safari reloads a
 *  tab whose canvases take too much memory, so this is a hard ceiling, not a count */
const SPRITE_PX = 24e6;
const free = (c: HTMLCanvasElement) => { spritePx -= c.width * c.height; c.width = c.height = 0; };
const SPRITE_BUDGET = 4; // ms of sprite painting per frame
function planetSprite(i: number, r: number): { c: HTMLCanvasElement; k: number } | null {
  const rb = Math.pow(2, Math.round(Math.log2(r) * 4) / 4), DPR = cam.DPR; // size steps of ~19%
  let e = pSprite[i];
  // repainting is spread over frames while zooming: past the budget, a planet keeps its old sprite, scaled
  const over = performance.now() - frameT0 > SPRITE_BUDGET;
  if (e && e.rb !== rb && over) { e.used = frameNo; return { c: e.c, k: r / e.rb }; }
  if (!e && over) return null; // painted in a later frame; a plain disc stands in
  if (!e || e.rb !== rb) {
    const gn = genome(galaxy.planets[i].name, galaxy.ptype[i]);
    const half = Math.ceil((galaxy.ringed[i] ? rb * (gn.ringRx + gn.ringW) : rb) + 3), w = half * 2;
    const c = e?.c ?? document.createElement("canvas"), px = Math.ceil(w * DPR);
    if (c.width !== px || c.height !== px) { spritePx += px * px - (e ? c.width * c.height : 0); c.width = c.height = px; } else c.getContext("2d")!.clearRect(0, 0, px, px);
    const g = c.getContext("2d")!; g.setTransform(DPR, 0, 0, DPR, 0, 0);
    drawPlanetBody(g, i, half, half, rb);
    if (!e) spriteCount++;
    e = pSprite[i] = { c, rb, used: frameNo };
  }
  e.used = frameNo;
  return { c: e.c, k: r / rb };
}
/** call once per frame */
export function tickSprites() {
  frameNo++; frameT0 = performance.now();
  if (frameNo % 30 !== 0 || (spritePx < SPRITE_PX && spriteCount < 600)) return;
  // over the ceiling: drop sprites not drawn for a while, oldest first, until well under it
  const idle = pSprite.map((e, i) => (e && frameNo - e.used > 2 ? i : -1)).filter((i) => i >= 0).sort((a, b) => pSprite[a]!.used - pSprite[b]!.used);
  for (const i of idle) { if (spritePx < SPRITE_PX * 0.7 && spriteCount < 500) break; free(pSprite[i]!.c); pSprite[i] = null; spriteCount--; }
}

/** the planets in focus: selected, playing, or with a Solaris station in orbit */
function focusPlanets() {
  const out = new Set<number>(), sel = state.sel, np = state.nowPlaying;
  if (sel?.kind === "planet") out.add(sel.p);
  if (sel?.kind === "track") { const p = baseChunk(sel.s)?.p[sel.i] ?? -1; if (p >= 0) out.add(p); }
  if (np) { const p = baseChunk(np.s)?.p[np.i] ?? -1; if (p >= 0) out.add(p); }
  if (state.orbit !== null) out.add(state.orbit);
  return out;
}
/**
 * How far a planet has turned: a label still releasing turns once in ~25 s, one that went quiet
 * turns slower the longer ago that was, down to once in ~2.5 minutes.
 */
const spinFrom = new Map<number, number>(); // when each planet came into focus: its turn starts from the still picture
function spinOf(i: number, t: number) {
  let t0 = spinFrom.get(i); if (t0 === undefined) { t0 = t; spinFrom.set(i, t); }
  const p = galaxy.planets[i], last = galaxy.meta.years?.[1] ?? 2026, gap = Math.max(0, last - (p.yr[1] || last - 20));
  const period = Math.min(150, 25 + gap * 7) * 1000;
  return ((t - t0) / period) * Math.PI * 2;
}

export function drawPlanets(ctx: CanvasRenderingContext2D, t: number) {
  if (cam.s < LOD_PLANETS) return;
  const { stars, planets, planetsByStar } = galaxy;
  const vis: number[] = [];
  stars.forEach((st, si) => {
    if (!inView(st.x, st.y, st.R)) return;
    for (const i of planetsByStar[si]) { const q = motion.planetPos(i, t); if (inLive(q.x, q.y, planets[i].r * 3)) vis.push(i); }
  });
  const focus = focusPlanets();
  for (const k of spinFrom.keys()) if (!focus.has(k)) spinFrom.delete(k);
  for (const i of vis) {
    const pl = planets[i], q = motion.planetPos(i, t), p = cam.toScreen(q.x, q.y), r = Math.max(1.5, pl.r * cam.s);
    if (r < 3) { ctx.fillStyle = sc(pl.s, 0.95); ctx.fillRect(Math.round(p.x - 1), Math.round(p.y - 1), 2, 2); continue; }
    // the planet you are at turns (drawn live, a handful at most); the rest stay still as cached sprites
    if (r > 180 || focus.has(i)) { drawPlanetBody(ctx, i, p.x, p.y, r, focus.has(i) ? spinOf(i, t) : 0, 0); continue; }
    const sp = planetSprite(i, r);
    if (!sp) { ctx.fillStyle = sc(pl.s, 0.35); ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 7); ctx.fill(); ctx.strokeStyle = sc(pl.s, 0.95); ctx.lineWidth = 1; ctx.stroke(); continue; }
    const w = sp.c.width / cam.DPR * sp.k;
    ctx.drawImage(sp.c, p.x - w / 2, p.y - w / 2, w, w);
  }
  vis.sort((a, b) => planets[b].n - planets[a].n);
  for (const i of vis) {
    const pl = planets[i], r = pl.r * cam.s; if (r < 4) continue;
    if (state.sel?.kind === "planet" && state.sel.p === i && hudFits(r)) continue; // its name is on the HUD
    const q = motion.planetPos(i, t), p = cam.toScreen(q.x, q.y);
    labels.label(pl.name.toUpperCase(), p.x, p.y + r + 14, 11, sc(pl.s, 0.85));
  }
}
