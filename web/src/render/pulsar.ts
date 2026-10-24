// Stars as pulsars: a granulated sphere lit from within, a corona of contour lines, a flash on every beat at the
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

/**
 * The topo corona: wavy contour lines round the star, like the relief lines on the planets. They sway
 * slowly; on every beat a wave runs out through them. More rings and brighter the more alive the style.
 */
function corona(c: CanvasRenderingContext2D, si: number, x: number, y: number, s: number, t: number) {
  const lum = galaxy.lum[si], ph = galaxy.phase0[si] * 6.283, sl = reduce ? 0 : t / 5000;
  const beat = reduce ? 0 : (t / 1000) * galaxy.bpm[si] / 60 + galaxy.phase0[si];
  if (s < 4) return;
  const n = s < 10 ? 2 : s < 18 ? 3 : 3 + Math.round(lum * 3), seg = Math.max(18, Math.min(96, Math.round(s * 2)));
  const wave = (beat % 1) * (n + 1) - 0.5; // where the beat's wave is, in rings
  c.lineWidth = Math.max(1, s * 0.035);
  for (let k = 0; k < n; k++) {
    const hit = Math.exp(-((k - wave) ** 2) * 1.6), base = s * (1.28 + k * 0.24 + 0.05 * hit), amp = s * (0.05 + k * 0.035);
    c.strokeStyle = sc(si, Math.min(1, (0.7 - k * 0.09) * (0.55 + 0.45 * lum) + 0.35 * hit));
    c.beginPath();
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * 6.283, f = k * 0.9 + ph;
      const rr = base + amp * (0.5 * Math.sin(a * 2 + f + sl) + 0.35 * Math.sin(a * 3 - f * 1.3 - sl * 0.7) + 0.15 * Math.sin(a * 5 + f * 0.7 + sl * 1.3));
      const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
      if (i) c.lineTo(px, py); else c.moveTo(px, py);
    }
    c.stroke();
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
  corona(c, si, x, y, s, t);
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
