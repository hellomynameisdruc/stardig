// DJ sets per star system (pipeline/build_sets.py, rebuilt daily into data/sets/): the index of how
// many each star has, fetched once, and a star's own list when its dossier opens.

/** one set: video id, title, channel, seconds, year, views, and its tracklist as read from the
 *  description: [seconds or -1, "Artist — Title", the track's YouTube id on the map or "", its star or ""] */
export type SetRec = { v: string; t: string; c: string; d: number; y: number; w: number; tl: [number, string, string, string][] };

/** a star's name as a file name, as the pipeline writes it (slug in build_sets.py) */
export const setSlug = (name: string) =>
  name.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || "x";

let index: Promise<Record<string, number>> | null = null;
const lists = new Map<string, Promise<SetRec[]>>();

/** how many sets each star has (empty when there are none yet) */
export const setCounts = () =>
  (index ??= fetch("./data/sets/index.json", { cache: "no-cache" }).then((r) => (r.ok ? r.json() : { n: {} })).then((j) => j.n ?? {}).catch(() => ({})));
/** a star's sets, most watched first */
export function starSets(name: string): Promise<SetRec[]> {
  if (!lists.has(name)) lists.set(name, fetch(`./data/sets/s/${setSlug(name)}.json`).then((r) => (r.ok ? r.json() : [])).catch(() => []));
  return lists.get(name)!;
}
/** the counts, if they have arrived (the dossier draws without waiting) */
export let setCountsNow: Record<string, number> | null = null;
export const loadSetCounts = () => setCounts().then((n) => { setCountsNow = n; return n; });
/** the sets, if they have arrived */
export const setsNow = new Map<string, SetRec[]>();
export const loadStarSets = (name: string) => starSets(name).then((l) => { setsNow.set(name, l); return l; });
