// The wordmark: STARDIG in its own pixel letters (5×7, even strokes, an I with serifs), after a small
// four-point spark. Drawn in the colour it sits in, so it works on the inverted plate and on the dark.
const G: Record<string, string[]> = {
  S: [".####", "#....", "#....", ".###.", "....#", "....#", "####."],
  T: ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "..#.."],
  A: [".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  R: ["####.", "#...#", "#...#", "####.", "#.#..", "#..#.", "#...#"],
  D: ["####.", "#...#", "#...#", "#...#", "#...#", "#...#", "####."],
  I: ["###", ".#.", ".#.", ".#.", ".#.", ".#.", "###"],
  G: [".###.", "#....", "#....", "#.###", "#...#", "#...#", ".###."],
};
const SPARK = ["...#...", "...#...", "..###..", "#######", "..###..", "...#...", "...#..."];

/** the wordmark as SVG; px = the size of one pixel in CSS px */
export function logoSvg(px = 2, spark = true) {
  const rects: string[] = [];
  let x = 0;
  const put = (rows: string[], dx: number) => rows.forEach((r, y) => { for (let i = 0; i < r.length; i++) if (r[i] === "#") rects.push(`<rect x="${dx + i}" y="${y}" width="1" height="1"/>`); });
  if (spark) { put(SPARK, 0); x = SPARK[0].length + 3; }
  for (const ch of "STARDIG") { put(G[ch], x); x += G[ch][0].length + 1; }
  const w = x - 1, h = 7;
  return `<svg class="logo-svg" viewBox="0 0 ${w} ${h}" width="${w * px}" height="${h * px}" fill="currentColor" shape-rendering="crispEdges" aria-hidden="true">${rects.join("")}</svg>`;
}
/** fill every .logo on the page */
export function paintLogos() {
  document.querySelectorAll<HTMLElement>(".logo").forEach((el) => { el.innerHTML = logoSvg(Number(el.dataset.px) || 2, el.dataset.spark !== "0"); });
}
