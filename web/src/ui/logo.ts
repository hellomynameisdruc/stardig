// The wordmark: stardig, lowercase, in DotGothic16's own pixels (copied from the font at its native 16px), except
// t, i and r, redrawn on the same grid with the font's 2-pixel strokes (at this size the font
// draws them with 1-pixel stems). A four-point spark comes first. Drawn in the colour it sits in.
const G: Record<string, string[]> = {
  s: ["........", "........", "........", "..####..", ".######.", "##....##", "##......", ".#####..", "..#####.", ".#....##", "##....##", ".######.", "..####..", "........"],
  t: ["......", "..##..", "..##..", "######", "######", "..##..", "..##..", "..##..", "..##..", "..##..", "..##..", "..####", "...###", "......"],
  a: [".......", ".......", ".......", "..###..", ".#####.", "##...##", ".....##", "..#####", ".######", "##...##", "##...##", ".######", "..##...", "......."],
  r: [".....", ".....", ".....", ".####", "#####", "##...", "##...", "##...", "##...", "##...", "##...", "##...", ".....", "....."],
  d: ["........", "......##", "......##", "...##.##", "..######", ".#....##", "##....##", "##....##", "##....##", "##....##", ".##..###", "..######", "...##...", "........"],
  i: ["..", "##", "##", "..", "##", "##", "##", "##", "##", "##", "##", "##", "..", ".."],
  g: ["........", "........", "........", "..###.#.", ".######.", "##...##.", "##...##.", ".#####..", ".####...", ".#####..", ".######.", "##....##", ".######.", "..####.."],
};
const SPARK = ["............", "............", ".....##.....", ".....##.....", "....####....", "...######...", "############", "############", "...######...", "....####....", ".....##.....", ".....##.....", "............", "............"];
const GAP = 2;

/** the wordmark as SVG; px = the size of one font pixel in CSS px */
export function logoSvg(px = 1, spark = true) {
  const rects: string[] = [];
  let x = 0;
  const put = (rows: string[], dx: number) => rows.forEach((r, y) => {
    for (let i = 0; i < r.length; i++) {
      if (r[i] !== "#") continue;
      let j = i; while (j + 1 < r.length && r[j + 1] === "#") j++; // runs, not single pixels
      rects.push(`<rect x="${dx + i}" y="${y}" width="${j - i + 1}" height="1"/>`); i = j;
    }
  });
  if (spark) { put(SPARK, 0); x = SPARK[0].length + 6; }
  for (const ch of "stardig") { put(G[ch], x); x += G[ch][0].length + GAP; }
  const w = x - GAP, h = 14;
  return `<svg class="logo-svg" viewBox="0 0 ${w} ${h}" width="${w * px}" height="${h * px}" fill="currentColor" shape-rendering="crispEdges" aria-hidden="true">${rects.join("")}</svg>`;
}
/** fill every .logo on the page */
export function paintLogos() {
  document.querySelectorAll<HTMLElement>(".logo").forEach((el) => { el.innerHTML = logoSvg(Number(el.dataset.px) || 1, el.dataset.spark !== "0"); });
}
