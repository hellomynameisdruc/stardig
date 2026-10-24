// The wordmark: STARDIG in Martian Mono capitals — the same face as the
// credit line. Drawn in the colour it sits in.
const SPARK = ["............", "............", ".....##.....", ".....##.....", "....####....", "...######...", "############", "############", "...######...", "....####....", ".....##.....", ".....##.....", "............", "............"];

/** the spark alone, as SVG; px = the size of one of its pixels in CSS px */
function sparkSvg(px: number) {
  const rects: string[] = [];
  SPARK.forEach((r, y) => {
    for (let i = 0; i < r.length; i++) {
      if (r[i] !== "#") continue;
      let j = i; while (j + 1 < r.length && r[j + 1] === "#") j++;
      rects.push(`<rect x="${i}" y="${y}" width="${j - i + 1}" height="1"/>`); i = j;
    }
  });
  return `<svg class="logo-spark" viewBox="0 0 12 14" width="${12 * px}" height="${14 * px}" fill="currentColor" shape-rendering="crispEdges" aria-hidden="true">${rects.join("")}</svg>`;
}
/** the wordmark: the spark, then STARDIG in Martian Mono capitals, the face of the credit line */
export function logoHtml(px = 1, spark = false) {
  return `${spark ? sparkSvg(px) : ""}<span class="logo-word" style="font-size:${Math.round(15 * px)}px" aria-hidden="true">STARDIG</span>`;
}
/** fill every .logo on the page */
export function paintLogos() {
  document.querySelectorAll<HTMLElement>(".logo").forEach((el) => { el.innerHTML = logoHtml(Number(el.dataset.px) || 1, el.dataset.spark === "1"); });
}
