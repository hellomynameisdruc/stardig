// Beacons (likes): signals the visitor marked. Each one remembers the YouTube id plus title and artist,
// so it survives map rebuilds where track indices move.
import type { Chunk, TrackRef } from "../core/types";
import { type KV, readJSON, Signal } from "./storage";

/** st: the star's name, to find the track again after the map is rebuilt */
export type Beacon = { y: string; s: number; i: number; t: string; a: string; at: number; st?: string };
/** a named playlist, apart from the beacons: its tracks (newest first), each remembered like a beacon.
 *  at: when it last changed; yt: its playlist on YouTube; sent: the tracks already put there */
export type BList = { id: string; name: string; items: Beacon[]; at: number; yt?: string; sent?: string[] };
const okItem = (b: unknown): b is Beacon => !!b && typeof (b as Beacon).y === "string" && Number.isInteger((b as Beacon).s) && Number.isInteger((b as Beacon).i);
const KEY = "kosmos-likes", LISTS = "kosmos-lists", CUR = "kosmos-list-cur";
export const MAX_LISTS = 24;
/** a list as saved (lists first kept only ids of beacons, `ys`: their tracks are taken from `beacons`) */
export function readList(l: unknown, beacons: readonly Beacon[] = []): BList | null {
  if (!l || typeof (l as BList).id !== "string" || typeof (l as BList).name !== "string") return null;
  const o = l as BList & { ys?: unknown };
  let items = Array.isArray(o.items) ? o.items.filter(okItem) : null;
  if (!items && Array.isArray(o.ys)) { const by = new Map(beacons.map((b) => [b.y, b])); items = o.ys.map((y) => by.get(y as string)).filter((b): b is Beacon => !!b); }
  if (!items) return null;
  const { ys: _old, ...rest } = o; void _old;
  return { ...rest, items };
}
/** YouTube makes a temporary playlist from up to this many ids */
export const YT_BATCH = 50;

export class Beacons {
  private list: Beacon[];
  private ids: Set<string>;
  readonly changed = new Signal();

  constructor(private kv: KV, private chunk: (s: number) => Chunk | null) {
    const raw = readJSON<unknown>(kv, KEY, []);
    this.list = (Array.isArray(raw) ? raw : []).filter((b): b is Beacon => !!b && typeof b.y === "string" && Number.isInteger(b.s) && Number.isInteger(b.i));
    this.ids = new Set(this.list.map((b) => b.y));
    const rl = readJSON<unknown>(kv, LISTS, []);
    this.pl = (Array.isArray(rl) ? rl : []).map((l) => readList(l, this.list)).filter((l): l is BList => !!l);
    this.cur = kv.get(CUR) ?? "";
    if (!this.pl.some((l) => l.id === this.cur)) this.cur = "";
  }
  private pl: BList[];
  /** the list open in BEACONS ("" = the beacons) */
  private cur: string;
  get lists(): readonly BList[] { return this.pl; }
  get current() { return this.cur; }
  setCurrent(id: string) { this.cur = this.pl.some((l) => l.id === id) ? id : ""; this.kv.set(CUR, this.cur); this.changed.emit(); }
  getList(id: string) { return this.pl.find((l) => l.id === id); }
  /** the tracks of a list (or the beacons), in its order */
  of(id: string): Beacon[] { const l = this.getList(id); return l ? [...l.items] : [...this.list]; }
  inList(id: string, y: string) { return !!this.getList(id)?.items.some((b) => b.y === y); }
  /** how many lists a track is in */
  listsWith(y: string) { return this.pl.filter((l) => l.items.some((b) => b.y === y)).length; }
  createList(name: string): string | null {
    const n = name.trim().replace(/\s+/g, " ").slice(0, 32); if (!n || this.pl.length >= MAX_LISTS) return null;
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    this.pl = [...this.pl, { id, name: n, items: [], at: Date.now() }]; this.saveLists(); return id;
  }
  renameList(id: string, name: string) {
    const l = this.getList(id), n = name.trim().replace(/\s+/g, " ").slice(0, 32); if (!l || !n) return;
    l.name = n; l.at = Date.now(); this.saveLists();
  }
  deleteList(id: string) {
    if (!this.getList(id)) return;
    this.pl = this.pl.filter((l) => l.id !== id); if (this.cur === id) { this.cur = ""; this.kv.set(CUR, ""); }
    this.listGone.emit(id); this.saveLists();
  }
  /** the list's playlist on YouTube, and which of its tracks are in it already */
  setYouTube(id: string, yt: string | undefined, sent: string[]) {
    const l = this.getList(id); if (!l) return;
    l.yt = yt; l.sent = sent; l.at = Date.now(); this.saveLists();
  }
  /** put a track in a list, or take it out (its beacon is a separate thing) */
  toggleIn(id: string, item: Beacon) {
    const l = this.getList(id); if (!l) return;
    l.items = l.items.some((b) => b.y === item.y) ? l.items.filter((b) => b.y !== item.y) : [{ ...item, at: Date.now() }, ...l.items];
    l.at = Date.now(); this.saveLists();
  }
  /** a track on the map, as a list or a beacon remembers it */
  item(r: TrackRef, starName?: string): Beacon | null {
    const ch = this.chunk(r.s); if (!ch || !ch.yt[r.i]) return null;
    return { y: ch.yt[r.i], s: r.s, i: r.i, t: ch.t[r.i], a: ch.an[ch.a[r.i]], at: Date.now(), ...(starName ? { st: starName } : {}) };
  }
  /** lists from the account, merged */
  replaceLists(pl: BList[]) { this.pl = pl.map((l) => readList(l, this.list)).filter((l): l is BList => !!l); if (!this.pl.some((l) => l.id === this.cur)) this.cur = ""; this.saveLists(); }
  /** a list was deleted here (for its tombstone) */
  readonly listGone = new Signal<string>();
  get all(): readonly Beacon[] { return this.list; }
  get size() { return this.list.length; }
  hasId(yt: string) { return this.ids.has(yt); }
  has(r: TrackRef | null) { const ch = r && this.chunk(r.s); return !!ch && this.ids.has(ch.yt[r!.i]); }

  toggle(r: TrackRef | null, starName?: string) {
    const ch = r && this.chunk(r.s); if (!r || !ch) return;
    const y = ch.yt[r.i];
    if (this.ids.has(y)) this.remove(y);
    else { this.ids.add(y); this.list = [this.item(r, starName)!, ...this.list]; this.save(); }
  }
  remove(y: string) {
    if (!this.ids.delete(y)) return;
    this.list = this.list.filter((b) => b.y !== y); this.save();
  }
  /** take a merged list (from the account): replaces what this browser has */
  replaceAll(list: Beacon[]) {
    this.list = list.filter((b) => !!b && typeof b.y === "string" && Number.isInteger(b.s) && Number.isInteger(b.i));
    this.ids = new Set(this.list.map((b) => b.y)); this.save();
  }
  /** where a beacon's track sits on the current map, or null if it moved out of reach */
  ref(b: Beacon, s = b.s): TrackRef | null {
    const ch = this.chunk(s);
    if (ch && s === b.s && ch.yt[b.i] === b.y) return { s, i: b.i };
    if (ch) { const i = ch.yt.indexOf(b.y); if (i >= 0) return { s, i }; }
    return null;
  }
  /** youtube.com/watch_videos links, YT_BATCH ids each */
  playlistLinks(id = ""): string[] {
    const out: string[] = [], src = this.of(id);
    for (let k = 0; k < src.length; k += YT_BATCH) out.push(`https://www.youtube.com/watch_videos?video_ids=${src.slice(k, k + YT_BATCH).map((b) => b.y).join(",")}`);
    return out;
  }
  private saveLists() { this.kv.set(LISTS, JSON.stringify(this.pl)); this.changed.emit(); }
  private save() { this.kv.set(KEY, JSON.stringify(this.list)); this.changed.emit(); }
}
