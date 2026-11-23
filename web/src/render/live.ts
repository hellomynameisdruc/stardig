// LIVE: a star whose style has a DJ set streaming right now sends out red rings, with a tag naming who's on.
import { reduce } from "../core/dom";
import { galaxy, state } from "../app/state";
import { cam } from "./camera";
import { labels } from "./labels";
import { starSize } from "./pulsar";
import { inView } from "./view";

const RED = "#ff4d6d";
export function drawLiveStars(G: CanvasRenderingContext2D, t: number) {
  for (const [si, recs] of state.live) {
    const s = galaxy.stars[si], r0 = starSize(si) * 1.5 + 4;
    if (!inView(s.x, s.y, (r0 * 3) / cam.s)) continue;
    const p = cam.toScreen(s.x, s.y);
    G.lineWidth = 1.2;
    for (let k = 0; k < 3; k++) {
      const ph = reduce ? k / 3 : (t / 2400 + k / 3) % 1;
      G.strokeStyle = `rgb(255 77 109 / ${((1 - ph) * 0.75).toFixed(2)})`;
      G.beginPath(); G.arc(p.x, p.y, r0 + ph * r0 * 1.6, 0, 7); G.stroke();
    }
    const tag = recs.length > 1 ? `● LIVE ×${recs.length}` : `● LIVE · ${recs[0].c.toUpperCase()}`;
    labels.label(tag, p.x, p.y - r0 - 12, 11, RED, "center", true, true);
  }
}
