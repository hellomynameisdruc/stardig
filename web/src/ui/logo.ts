// The wordmark: the burst, then STARDIG in Martian Mono capitals — the same face as the credit line.
// Drawn in the colour it sits in.
/** the burst: sixteen rays, long and short in turn, round a bright core (the site's mark and favicon) */
function burstSvg(size: number) {
  let rays = "";
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2, r = i % 2 ? 8.7 : 14, c = Math.cos(a), s = Math.sin(a), f = (v: number) => v.toFixed(2);
    rays += `<line x1="${f(16 + c * 3.5)}" y1="${f(16 + s * 3.5)}" x2="${f(16 + c * r)}" y2="${f(16 + s * r)}"/>`;
  }
  return `<svg class="logo-mark" viewBox="0 0 32 32" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="square" aria-hidden="true">${rays}<circle cx="16" cy="16" r="2.2" fill="currentColor" stroke="none"/></svg>`;
}
/** the wordmark: the burst, then STARDIG in Martian Mono capitals, the face of the credit line */
export function logoHtml(px = 1, mark = true) {
  return `${mark ? burstSvg(Math.round(17 * px)) : ""}<span class="logo-word" style="font-size:${Math.round(15 * px)}px" aria-hidden="true">STARDIG</span>`;
}
/** fill every .logo on the page */
export function paintLogos() {
  document.querySelectorAll<HTMLElement>(".logo").forEach((el) => { el.innerHTML = logoHtml(Number(el.dataset.px) || 1, el.dataset.mark !== "0"); });
}
