// Dead signals: videos that turned out to be removed, private or not allowed to play on other sites.
// Remembered in this browser, so the visitor is never sent to them again and they go dark on the map;
// and shared: one pilot's dead signal goes dark for everyone (cloud/deadShared.ts).
import { type KV, readJSON, Signal } from "./storage";

const KEY = "kosmos-dead";
/** keep the newest this many (a few tens of KB at most) */
export const DEAD_MAX = 5000;

export class DeadSignals {
  private list: string[];
  private ids: Set<string>;
  readonly changed = new Signal();

  constructor(private kv: KV) {
    const raw = readJSON<unknown>(kv, KEY, []);
    this.list = (Array.isArray(raw) ? raw : []).filter((y): y is string => typeof y === "string").slice(-DEAD_MAX);
    this.ids = new Set(this.list);
  }
  /** dead as other pilots found them (the shared list): kept for this visit, not stored here */
  private shared = new Set<string>();
  get size() { return this.ids.size; }
  has(y: string) { return this.ids.has(y) || this.shared.has(y); }
  addShared(ys: Iterable<string>) { let n = 0; for (const y of ys) if (y && !this.shared.has(y)) { this.shared.add(y); n++; } if (n) this.changed.emit(); return n; }
  add(y: string) {
    if (!y || this.ids.has(y)) return;
    this.list.push(y); this.ids.add(y);
    while (this.list.length > DEAD_MAX) this.ids.delete(this.list.shift()!);
    this.kv.set(KEY, JSON.stringify(this.list)); this.changed.emit();
  }
}
