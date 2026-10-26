// Beacons (likes): signals the visitor marked. Each one remembers the YouTube id plus title and artist,
// so it survives map rebuilds where track indices move.
import type { Chunk, TrackRef } from "../core/types";
import { type KV, readJSON, Signal } from "./storage";

/** st: the star's name, to find the track again after the map is rebuilt */
export type Beacon = { y: string; s: number; i: number; t: string; a: string; at: number; st?: string };
/** a named playlist of beacons: the ids of its tracks, newest first. at: when it last changed */
export type BList = { id: string; name: string; ys: string[]; at: number; yt?: string; sent?: string[] };
const KEY = "kosmos-likes", LISTS = "kosmos-lists", CUR = "kosmos-list-cur";
export const MAX_LISTS = 24;
const okList = (l: unknown): l is BList => !!l && typeof (l as BList).id === "string" && typeof (l as BList).name === "string" && Array.isArray((l as BList).ys);
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
    this.pl = (Array.isArray(rl) ? rl : []).filter(okList);
    this.cur = kv.get(CUR) ?? "";
    if (!this.pl.some((l) => l.id === this.cur)) this.cur = "";
  }
  private pl: BList[];
  /** the list open in BEACONS ("" = all): new beacons go into it too */
  private cur: string;
  get lists(): readonly BList[] { return this.pl; }
  get current() { return this.cur; }
  setCurrent(id: string) { this.cur = this.pl.some((l) => l.id === id) ? id : ""; this.kv.set(CUR, this.cur); this.changed.emit(); }
  getList(id: string) { return this.pl.find((l) => l.id === id); }
  /** the beacons of a list (or all of them), in the list's order */
  of(id: string): Beacon[] {
    const l = this.getList(id); if (!l) return [...this.list];
    const by = new Map(this.list.map((b) => [b.y, b])); return l.ys.map((y) => by.get(y)).filter((b): b is Beacon => !!b);
  }
  inList(id: string, y: string) { return !!this.getList(id)?.ys.includes(y); }
  createList(name: string): string | null {
    const n = name.trim().replace(/\s+/g, " ").slice(0, 32); if (!n || this.pl.length >= MAX_LISTS) return null;
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    this.pl = [...this.pl, { id, name: n, ys: [], at: Date.now() }]; this.saveLists(); return id;
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
  /** put a beaconed track in a list, or take it out */
  toggleIn(id: string, y: string) {
    const l = this.getList(id); if (!l || !this.ids.has(y)) return;
    l.ys = l.ys.includes(y) ? l.ys.filter((v) => v !== y) : [y, ...l.ys]; l.at = Date.now(); this.saveLists();
  }
  /** lists from the account, merged */
  replaceLists(pl: BList[]) { this.pl = pl.filter(okList); if (!this.pl.some((l) => l.id === this.cur)) this.cur = ""; this.saveLists(); }
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
    else { this.ids.add(y); this.list = [{ y, s: r.s, i: r.i, t: ch.t[r.i], a: ch.an[ch.a[r.i]], at: Date.now(), ...(starName ? { st: starName } : {}) }, ...this.list];
      const l = this.getList(this.cur); if (l && !l.ys.includes(y)) { l.ys = [y, ...l.ys]; l.at = Date.now(); this.kv.set(LISTS, JSON.stringify(this.pl)); }
      this.save(); }
  }
  remove(y: string) {
    if (!this.ids.delete(y)) return;
    this.list = this.list.filter((b) => b.y !== y);
    for (const l of this.pl) if (l.ys.includes(y)) { l.ys = l.ys.filter((v) => v !== y); l.at = Date.now(); }
    this.kv.set(LISTS, JSON.stringify(this.pl)); this.save();
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
