// Stars as pulsars: a dithered sphere lit from within, a dotted halo, a flash on every beat at the
// style's tempo, and a nova shell once per bar.
import { reduce } from "../core/dom";
import { galaxy } from "../app/state";
import { glowS, sc } from "./palette";
import { starFace } from "./starSurface";
import { cam } from "./camera";

export function pulseOf(si: number, t: number) {
  const beat = (t / 1000) * galaxy.bpm[si] / 60 + galaxy.phase0[si];
  return { p: reduce ? 0.4 : Math.exp(-(beat % 1) * 6), bar: reduce ? 0.3 : (beat / 4) % 1 };
}

/** on-screen star radius: popularity sets it, zoom scales it within limits */
export const starSize = (si: number) => { const k = galaxy.starRel[si]; return Math.max(3.5 + 8 * k, Math.min(54, (12 + 44 * k) * cam.s)); };

/** the style's burst: long and short rays in turn; longer and brighter the more alive the style is now */
function burst(c: CanvasRenderingContext2D, si: number, x: number, y: number, s: number, p: number, t: number) {
  const lum = galaxy.lum[si], n = s < 8 ? 12 : 24, rot = (reduce ? 0 : t / 1000) * 0.03 * (si % 2 ? 1 : -1) + galaxy.phase0[si] * 6.283;
  const L = s * (0.55 + 1.5 * lum) * (1 + 0.22 * p), r0 = s * 1.18;
  for (let k = 0; k < n; k++) {
    const long = k % 2 === 0, big = k % 4 === 0, a = rot + (k * 6.283) / n, len = long ? (big ? L : L * 0.62) : L * 0.32;
    c.strokeStyle = sc(si, (long ? 0.55 : 0.35) + 0.35 * lum + 0.1 * p); c.lineWidth = Math.max(1, s * (long ? 0.07 : 0.04));
    c.beginPath(); c.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0); c.lineTo(x + Math.cos(a) * (r0 + len), y + Math.sin(a) * (r0 + len)); c.stroke();
  }
}

export function drawPulsar(c: CanvasRenderingContext2D, si: number, x: number, y: number, s: number, t: number) {
  const { p, bar } = pulseOf(si, t), lum = galaxy.lum[si];
  const prev = c.globalCompositeOperation;
  // nova shell — once per bar
  c.strokeStyle = sc(si, 0.55 * (1 - bar) ** 2); c.lineWidth = Math.max(1, s * 0.1 * (1 - bar));
  c.beginPath(); c.arc(x, y, s * (1.3 + 6 * bar), 0, 7); c.stroke();
  // glow
  c.globalCompositeOperation = "lighter";
  const gR = s * (1.8 + 1.4 * lum + 2.2 * p); c.globalAlpha = Math.min(1, 0.2 + 0.45 * lum + 0.45 * p); c.drawImage(glowS[si], x - gR, y - gR, gR * 2, gR * 2); c.globalAlpha = 1;
  c.globalCompositeOperation = prev;
  burst(c, si, x, y, s, p, t);
  // the face: granules, painted at the size step and scaled to the beat
  const r = s * (1 + 0.1 * p), D = Math.min(200, Math.max(6, Math.round(Math.pow(2, Math.round(Math.log2(s * 2) * 4) / 4))));
  const sm = c.imageSmoothingEnabled; c.imageSmoothingEnabled = false;
  c.drawImage(starFace(si, galaxy.stars[si].name, D), x - r, y - r, r * 2, r * 2);
  c.imageSmoothingEnabled = sm;
  c.globalCompositeOperation = "lighter"; c.globalAlpha = 0.25 + 0.3 * p; c.drawImage(glowS[si], x - r, y - r, r * 2, r * 2); c.globalAlpha = 1;
  c.globalCompositeOperation = prev;
  // outline, like the planets
  c.strokeStyle = sc(si, 0.95); c.lineWidth = 1; c.beginPath(); c.arc(x, y, r, 0, 7); c.stroke();
}
