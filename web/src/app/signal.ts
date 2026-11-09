// A track's own address, that survives the map being rebuilt: its YouTube id and its style's name,
// "#sig-<id>.<style>". Shared in COMMS it becomes a card; opened in a browser it flies to the track.
import { chunk, galaxy } from "./state";
import { locateYt } from "./vault";

const SIG = /#sig-([A-Za-z0-9_-]{11})\.([^\s#?&]+)/;
export type Signal = { yt: string; star: string };

export function signalHash(s: number, i: number) {
  const ch = chunk(s); if (!ch) return "";
  return `#sig-${ch.yt[i]}.${encodeURIComponent(galaxy.stars[s].name)}`;
}
/** the observatory's address (the folder the page is in: comms.html shares links to the map, not to itself) */
const home = () => new URL("./", location.href).href;
export const signalLink = (s: number, i: number) => `${home()}${signalHash(s, i)}`;

export function parseSignal(text: string): Signal | null {
  const m = text.match(SIG); if (!m) return null;
  try { return { yt: m[1], star: decodeURIComponent(m[2]) }; } catch { return null; }
}
/** the text with the signal's link taken out (what was said around it) */
export const withoutSignal = (text: string) => text.replace(/\S*#sig-[A-Za-z0-9_-]{11}\.[^\s#?&]+\S*/, "").trim();

const found = new Map<string, { s: number; i: number } | null>(), pending = new Map<string, Promise<{ s: number; i: number } | null>>();
/** where the signal is on this map now, if its style's tracks are loaded (else undefined: ask find()) */
export function placed(sig: Signal) { return found.get(`${sig.yt}.${sig.star}`); }
// a chat full of shared tracks from many styles would load all their stars at once: take turns
let line: Promise<void> = Promise.resolve();
function queued() {
  const turn = line.then(() => new Promise<void>((r) => setTimeout(r, 350)));
  line = turn; return turn;
}
/** where a signal is. `wide`: if it isn't in its style any more (the map was rebuilt and the track
 *  moved to a new, narrower style), look in the styles closest to it too — for a link someone opened,
 *  not for the many cards in COMMS (that would load a lot) */
export function find(sig: Signal, wide = false) {
  const key = `${sig.yt}.${sig.star}${wide ? ".w" : ""}`;
  if (found.has(key)) return Promise.resolve(found.get(key)!);
  let p = pending.get(key);
  if (!p) {
    p = (async () => {
      const s = galaxy.starIndex(sig.star); if (s < 0) return null;
      if (!chunk(s)) await queued(); // stars not loaded yet come in one at a time, not all at once
      const i = await locateYt(s, sig.yt).catch(() => -1); // the vault too
      if (i >= 0) return { s, i };
      if (wide) for (const { s: s2 } of [...galaxy.adj[s]].sort((a, b) => b.w - a.w).slice(0, 6)) {
        const j = await locateYt(s2, sig.yt).catch(() => -1);
        if (j >= 0) return { s: s2, i: j };
      }
      return null;
    })().then((r) => { found.set(key, r); pending.delete(key); return r; });
    pending.set(key, p);
  }
  return p;
}
