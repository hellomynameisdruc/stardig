// Track titles, map and vault together: an index in small files by the titles' first letters
// (search/, made by pipeline/build_titles.py), fetched only when needed — while someone types in the
// search, or to find a saved track whose style changed when the map was rebuilt.
import { dataUrl } from "./loader";

export const normT = (s: string) => s.toLowerCase().normalize("NFKD").replace(/\p{M}/gu, "").replace(/[^0-9a-z]+/g, "");
export type Shelf = { t: string[]; n: string[]; a: number[]; s: number[]; i: number[]; norm: string[] };
let split: Set<string> | null | undefined; // keys split into longer ones (undefined: not asked yet)
let splitP: Promise<Set<string>> | null = null;
const shelves = new Map<string, Shelf | null>(), shelfP = new Map<string, Promise<Shelf | null>>();

function loadSplit() {
  return splitP ??= fetch(dataUrl("search/index.json")).then((r) => (r.ok ? r.json() : { split: [] })).then((w) => (split = new Set(w.split as string[])))
    .catch(() => { splitP = null; split = undefined; return new Set<string>(); });
}
function loadShelf(key: string) {
  let p = shelfP.get(key);
  if (!p) {
    p = fetch(dataUrl(`search/${key}.json`)).then((r) => (r.ok ? r.json() : null)).then((w) => {
      if (!w) return null;
      const t = (w.t as string).split("\n"), sh: Shelf = { t, n: (w.n as string).split("\n"), a: w.a, s: w.s, i: w.i, norm: t.map(normT) };
      shelves.set(key, sh); return sh;
    }).catch(() => { shelfP.delete(key); return null; });
    shelfP.set(key, p);
  }
  return p;
}
/** the shelf if it's here; otherwise starts fetching it and calls `then` once it is */
export function titleShelf(key: string, then: () => void): Shelf | null {
  const sh = shelves.get(key); if (sh) return sh;
  loadShelf(key).then((x) => { if (x) then(); });
  return null;
}
function keyOf(s: string, sp: Set<string>, exact = false): string | null {
  const n = normT(s);
  if (n.length < 2) return /[\p{L}\p{N}]{2}/u.test(s) ? "_" : null; // other scripts: one file, matched as typed
  let k = n.slice(0, 2);
  while (sp.has(k)) { if (n.length <= k.length) return exact ? `${k}_` : ""; k = n.slice(0, k.length + 1); }
  return k;
}
/** which file holds titles starting with the query; "" while more letters are needed; null: none to look in */
export function titleKey(s: string, then: () => void): string | null {
  if (split === undefined) loadSplit().then(then);
  return split ? keyOf(s, split) : null;
}
/** the stars a track with exactly this title is in (to find a saved track that moved to another style) */
export async function starsWithTitle(title: string): Promise<number[]> {
  const key = keyOf(title, await loadSplit(), true); if (!key) return [];
  const sh = await loadShelf(key); if (!sh) return [];
  const n = normT(title), out = new Set<number>();
  sh.norm.forEach((x, j) => { if (key === "_" ? sh.t[j].toLowerCase() === title.toLowerCase() : x === n) out.add(sh.s[j]); });
  return [...out];
}
