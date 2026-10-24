// Ore: the asteroid-belt tracks (no label: self-released, white labels, the unknown) this pilot has
// dug up and heard, by YouTube id. Kept in this browser and, signed in, with the account.
import { type KV, readJSON, Signal } from "./storage";

const KEY = "kosmos-ore";
const MAX = 20000;

export class Ore {
  private ids: Set<string>;
  readonly changed = new Signal();
  constructor(private kv: KV) {
    const raw = readJSON<unknown>(kv, KEY, []);
    this.ids = new Set((Array.isArray(raw) ? raw : []).filter((x): x is string => typeof x === "string"));
  }
  get size() { return this.ids.size; }
  get all(): string[] { return [...this.ids]; }
  has(yt: string) { return this.ids.has(yt); }
  /** true when it's a new find */
  add(yt: string) {
    if (!yt || this.ids.has(yt)) return false;
    this.ids.add(yt);
    if (this.ids.size > MAX) this.ids.delete(this.ids.values().next().value!);
    this.save(); this.changed.emit(); return true;
  }
  /** take the union with the account's */
  merge(list: unknown) {
    if (!Array.isArray(list)) return;
    const n = this.ids.size;
    for (const y of list) if (typeof y === "string" && this.ids.size < MAX) this.ids.add(y);
    if (this.ids.size !== n) { this.save(); this.changed.emit(); }
  }
  private save() { this.kv.set(KEY, JSON.stringify([...this.ids])); }
}
