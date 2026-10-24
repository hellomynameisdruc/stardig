// Selection and hover markers: corner brackets plus a leader line with the object's name.
import type { Sel } from "../core/types";
import { chunk, galaxy, motion } from "../app/state";
import { BG, FONT_LBL, sc } from "./palette";
import { cam } from "./camera";
import { labels } from "./labels";
import { starSize } from "./pulsar";
import { tempoLabel } from "../model/tempo";

/** stars sit still (drawn on the static layer); planets and tracks move (live layer) */
export const isMoving = (o: Sel) => !!o && (o.kind === "planet" || o.kind === "track");

/** a selected planet at least this big on screen (radius, px) gets the full HUD round it */
export const HUD_MIN = 34;
export const hudFits = (r: number) => r >= HUD_MIN && r < Math.min(cam.W, cam.H) * 0.4;

/**
 * The planet HUD: its name on a tag with a tick down to it, crosshair arms with its numbers, two
 * heading marks, and a ruler under it with the planet's code.
 */
function planetHud(pi: number, x: number, y: number, r: number) {
  const G = labels.g, pl = galaxy.planets[pi], si = pl.s, c = sc(si, 0.95), dim = sc(si, 0.7);
  G.strokeStyle = c; G.fillStyle = c; G.lineWidth = 1;
  const X = Math.round(x) + 0.5, top = y - r - 12, arm = Math.min(70, 26 + r * 0.35);
  G.beginPath();
  G.moveTo(X, top - 14); G.lineTo(X, top); G.moveTo(X - 6, top); G.lineTo(X + 7, top); // tick under the name
  const L = x - r - 12, Rx = x + r + 12, Y = Math.round(y) + 0.5;
  G.moveTo(L - arm, Y); G.lineTo(L, Y); G.moveTo(L + 0.5, Y - 6); G.lineTo(L + 0.5, Y + 7); // left arm
  G.moveTo(Rx, Y); G.lineTo(Rx + arm, Y); G.moveTo(Rx - 0.5, Y - 6); G.lineTo(Rx - 0.5, Y + 7); // right arm
  const ry = Math.round(y + r + 30) + 0.5, rx0 = x - r - arm * 0.6, rx1 = x + r + arm * 0.6, code = `PL-${String(pi).padStart(4, "0")}`;
  G.font = `11px ${FONT_LBL}`; const cw = G.measureText(code).width + 14;
  G.moveTo(rx0, ry - 8); G.lineTo(rx0, ry + 7); G.moveTo(rx1, ry - 8); G.lineTo(rx1, ry + 7);
  const n = Math.max(6, Math.round((rx1 - rx0) / 18));
  for (let k = 1; k < n; k++) { const tx = Math.round(rx0 + (rx1 - rx0) * k / n) + 0.5; if (Math.abs(tx - x) < cw / 2 + 4) continue; G.moveTo(tx, ry - 4); G.lineTo(tx, ry + 4); }
  G.stroke();
  G.strokeRect(Math.round(x - cw / 2) + 0.5, ry - 9, Math.round(cw), 18);
  // heading marks, off the upper right and lower left
  for (const [a, rot] of [[-0.85, 0], [2.3, Math.PI]] as const) {
    const tx = x + Math.cos(a) * (r + 22), ty = y + Math.sin(a) * (r + 22);
    G.save(); G.translate(tx, ty); G.rotate(rot); G.beginPath(); G.moveTo(-3, -4); G.lineTo(4, 0); G.lineTo(-3, 4); G.fill(); G.restore();
  }
  // the numbers sit on plates of the background, so passing satellite names don't run through them
  const plate = (txt: string, tx: number, ty: number, al: CanvasTextAlign, size: number, col: string) => {
    G.font = `${size}px ${FONT_LBL}`; const w = G.measureText(txt).width, x0 = al === "right" ? tx - w : al === "center" ? tx - w / 2 : tx;
    G.fillStyle = BG; G.fillRect(x0 - 3, ty - size, w + 6, size + 4); G.fillStyle = col; G.textAlign = al; G.fillText(txt, tx, ty);
  };
  const tracks = pl.t1 - pl.t0, yrs = pl.yr[0] ? `${pl.yr[0]}–${pl.yr[1]}` : "";
  plate(`REL ${pl.n.toLocaleString("en")}`, L - arm, Y - 6, "left", 9, dim); plate(`SAT ${tracks.toLocaleString("en")}`, L - arm, Y + 14, "left", 9, dim);
  if (yrs) plate(yrs, Rx + arm, Y - 6, "right", 9, dim);
  plate(galaxy.ptype[pi].toUpperCase(), Rx + arm, Y + 14, "right", 9, dim);
  plate(code, x, ry + 4, "center", 11, c);
  labels.label(pl.name.toUpperCase(), x, top - 18, 12, sc(si, 1), "center", true, true);
}

export function drawMarker(o: Sel, strong: boolean) {
  if (!o) return;
  if (strong && o.kind === "planet") {
    const pl = galaxy.planets[o.p], q = motion.planetPos(o.p), p = cam.toScreen(q.x, q.y), r = pl.r * cam.s;
    if (hudFits(r)) { planetHud(o.p, p.x, p.y, r); return; }
  }
  const G = labels.g;
  let x = 0, y = 0, r = 8, name = "", si = 0;
  if (o.kind === "star") { const s = galaxy.stars[o.s], p = cam.toScreen(s.x, s.y); x = p.x; y = p.y; r = starSize(o.s) * 2.6 + 6; name = `${tempoLabel(galaxy.tempo[o.s])} · PEAK ${galaxy.peakYear[o.s]}`; si = o.s; }
  else if (o.kind === "planet") { const pl = galaxy.planets[o.p], q = motion.planetPos(o.p), p = cam.toScreen(q.x, q.y); x = p.x; y = p.y; r = Math.max(9, pl.r * cam.s + 6); name = pl.name; si = pl.s; }
  else { const ch = chunk(o.s); if (!ch) return; const q = motion.trackPos(o.s, o.i), p = cam.toScreen(q.x, q.y); x = p.x; y = p.y; r = 7; name = ch.t[o.i]; si = o.s; }
  labels.brackets(x, y, r, sc(si, strong ? 1 : 0.65), strong ? 7 : 4);
  if (strong) {
    const lx = x + r + 26, ly = y - r - 18;
    G.strokeStyle = sc(si, 0.95); G.lineWidth = 1; G.beginPath(); G.moveTo(x + r, y - r); G.lineTo(x + r + 12, ly + 4); G.lineTo(lx - 4, ly + 4); G.stroke();
    labels.label(name.toUpperCase(), lx, ly + 8, 12, sc(si, 1), "left", true, true);
  }
}
