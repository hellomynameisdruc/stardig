// The asteroid belt up close, and digging into it. From the SIGNALS zoom in, the belt tracks (no label)
// are drawn on the live layer as little rocks that tumble in place — outlined like the planets, ore
// you've dug up glinting — as long as there aren't too many on screen; further out the static layer
// draws them as dots. A dig shows as a lock-on and a burst of debris at the rock being drilled.
import { hash } from "../core/util";
import { baseChunk, galaxy, ore, state } from "../app/state";
import { eachTrack } from "./beltGrid";
import { BG, FONT_LBL, sc } from "./palette";
import { cam, LOD_TITLES } from "./camera";
import { inLive, view } from "./view";

/** most rocks drawn one by one; past this the static layer's dots stand in */
export const ROCK_MAX = 1400;
/** set by the static layer at each repaint: whether the live layer draws the belt as rocks */
export const belt = { rocks: false };

const SIDES = 7;
function rock(G: CanvasRenderingContext2D, si: number, i: number, x: number, y: number, t: number, mined: boolean) {
  const h = hash(`${si}:${i}`), size = Math.max(4, Math.min(10, cam.s * 1.3)) * (0.6 + ((h & 255) / 255) * 0.8);
  const spin = (((h >>> 8) & 255) / 255) * 6.283 + (t / (2600 + ((h >>> 16) & 255) * 22)) * ((h & 1) ? 1 : -1);
  G.beginPath();
  for (let k = 0; k < SIDES; k++) {
    const a = spin + (k / SIDES) * 6.283, r = size * (0.68 + (((h >>> (k * 3)) & 7) / 7) * 0.42);
    const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r * 0.82;
    if (k) G.lineTo(px, py); else G.moveTo(px, py);
  }
  G.closePath();
  G.fillStyle = mined ? sc(si, 0.45) : BG; G.fill();
  G.strokeStyle = sc(si, mined ? 1 : 0.8); G.lineWidth = 1; G.stroke();
  if (size > 4) { // a crater, turning with the rock
    const a = spin + 1.1, cx = x + Math.cos(a) * size * 0.3, cy = y + Math.sin(a) * size * 0.25;
    G.beginPath(); G.arc(cx, cy, size * 0.22, 0, 7); G.stroke();
  }
  if (mined && Math.floor(t / 700 + (h & 7)) % 4 === 0) { G.fillStyle = "#fff"; G.fillRect(Math.round(x + size * 0.4), Math.round(y - size * 0.6), 2, 2); } // glint
}

/** the belt as rocks, on the live layer (only when the static layer said so) */
export function drawBelt(G: CanvasRenderingContext2D, t: number) {
  if (!belt.rocks || cam.s < LOD_TITLES) return;
  const { LV0, LV1 } = view;
  galaxy.stars.forEach((s, si) => {
    if (!inLive(s.x, s.y, s.R)) return;
    const ch = baseChunk(si); if (!ch) return;
    eachTrack(si, LV0.x, LV0.y, LV1.x, LV1.y, (i) => {
      if (ch.p[i] >= 0) return;
      const x = ch.x[i], y = ch.y[i]; if (x < LV0.x - 2 || x > LV1.x + 2 || y < LV0.y - 2 || y > LV1.y + 2) return;
      const p = cam.toScreen(x, y);
      rock(G, si, i, p.x, p.y, t, ore.has(ch.yt[i]));
    });
  });
}

/** a dig: lock-on brackets closing in, then the rock breaks open in a burst of pixels */
export function drawDig(G: CanvasRenderingContext2D, t: number) {
  const d = state.dig; if (!d) return;
  if (cam.flying) { d.t0 = t; return; } // the drill starts once the ship is there
  const ch = baseChunk(d.s), k = (t - d.t0) / 1000;
  if (!ch || k > 3.2) { state.dig = null; return; }
  if (k < 0) return;
  const p = cam.toScreen(ch.x[d.i], ch.y[d.i]), col = (a: number) => sc(d.s, a);
  if (k < 1.4) {
    const q = k / 1.4, r = 46 - 34 * q * q, len = 7;
    G.strokeStyle = col(0.95); G.lineWidth = 1.5; G.beginPath();
    for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const cx = p.x + sx * r, cy = p.y + sy * r;
      G.moveTo(cx, cy - sy * len); G.lineTo(cx, cy); G.lineTo(cx - sx * len, cy);
    }
    G.stroke();
    if (Math.floor(k * 6) % 2 === 0) { G.font = `11px ${FONT_LBL}`; G.textAlign = "center"; G.fillStyle = col(1); G.fillText("DRILLING", p.x, p.y - r - 8); }
  } else {
    const q = (k - 1.4) / 1.8, f = 1 - q;
    G.strokeStyle = col(0.8 * f); G.lineWidth = 1; G.beginPath(); G.arc(p.x, p.y, 8 + q * 60, 0, 7); G.stroke();
    for (let n = 0; n < 18; n++) {
      const a = n * 2.39996 + d.i, sp = 30 + ((n * 37) % 50), r = 6 + sp * Math.sqrt(q) * 1.6, sz = n % 3 ? 2 : 3;
      G.fillStyle = col(f); G.fillRect(Math.round(p.x + Math.cos(a) * r), Math.round(p.y + Math.sin(a) * r), sz, sz);
    }
  }
}
