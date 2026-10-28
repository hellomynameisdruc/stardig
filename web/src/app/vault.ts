// Tracks from the vault on the map: a vault track that's played (or a saved one that turns out to be
// there) is brought into its star's loaded tracks as a guest at the end of the list — a satellite on
// its planet's outer orbit, or a rock in the belt — so everything else (playing, beacons, the log,
// sharing) works with it as with any other track.
import type { Chunk } from "../core/types";
import { VaultStore } from "../data/vault";
import { galaxy, tracks } from "./state";

const GOLDEN = Math.PI * (3 - Math.sqrt(5));
const vault = new VaultStore(galaxy.meta.shard ?? 4000);
const guests = galaxy.stars.map(() => new Map<number, number>()); // vault position → track index

/** the planet whose vault range holds pos (or -1: the belt) */
function ownerOf(s: number, pos: number) {
  for (const pi of galaxy.planetsByStar[s]) { const v = galaxy.planets[pi].v; if (v && pos >= v[0] && pos < v[0] + v[1]) return pi; }
  return -1;
}

/** bring vault track `pos` of star s onto the map; its track index */
export async function adopt(s: number, pos: number): Promise<number> {
  const ch: Chunk = await tracks.load(s), have = guests[s].get(pos);
  if (have !== undefined) return have;
  const v = await vault.track(s, pos);
  const again = guests[s].get(pos); if (again !== undefined) return again; // adopted meanwhile
  if (ch.n0 === undefined) ch.n0 = ch.yt.length;
  const pi = ownerOf(s, pos);
  let x: number, y: number;
  if (pi >= 0) { // just outside the drawn satellites
    const P = galaxy.planets[pi], rr = P.r + 4 + 1.5 * Math.sqrt(P.t1 - P.t0 + 0.5) + 3, a = pos * GOLDEN;
    x = P.x + rr * Math.cos(a); y = P.y + rr * Math.sin(a);
  } else { // next to one of the belt's rocks
    const belt: number[] = []; for (let i = 0; i < ch.n0; i++) if (ch.p[i] < 0) belt.push(i);
    const j = belt.length ? belt[(pos * 2654435761 >>> 0) % belt.length] : -1, a = pos * GOLDEN;
    const st = galaxy.stars[s];
    x = (j >= 0 ? ch.x[j] : st.x + st.R) + 3 * Math.cos(a); y = (j >= 0 ? ch.y[j] : st.y) + 3 * Math.sin(a);
  }
  const i = ch.yt.length;
  ch.yt.push(v.yt); ch.yr.push(v.yr); ch.p.push(pi); ch.x.push(x); ch.y.push(y); ch.t.push(v.t);
  let ai = ch.an.indexOf(v.an); if (ai < 0) { ai = ch.an.length; ch.an.push(v.an); }
  ch.a.push(ai);
  guests[s].set(pos, i);
  return i;
}

/** a track's index on the map by YouTube id: among the loaded tracks, else from the vault (-1: nowhere) */
export async function locateYt(s: number, yt: string, hint = -1): Promise<number> {
  const ch = await tracks.load(s).catch(() => null); if (!ch) return -1;
  if (hint >= 0 && ch.yt[hint] === yt) return hint;
  const i = ch.yt.indexOf(yt); if (i >= 0) return i;
  if (!galaxy.stars[s].bv && !galaxy.planetsByStar[s].some((pi) => galaxy.planets[pi].v)) return -1;
  const pos = await vault.find(s, yt).catch(() => -1);
  return pos >= 0 ? adopt(s, pos) : -1;
}

