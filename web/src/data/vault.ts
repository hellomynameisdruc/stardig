// The vault: tracks kept off the map (a label's satellites past what's drawn, the belt past its rocks),
// stored per star in shards and fetched only when one is needed — to play, or to find a saved track.
import { dataUrl } from "./loader";

export type VaultTrack = { yt: string; yr: number; t: string; an: string };
type Shard = { yt: string; yr: number[]; t: string[]; an: string[]; a: number[] };

export class VaultStore {
  private shards = new Map<string, Promise<Shard>>();
  private ids = new Map<number, Promise<string>>();
  constructor(private size: number) {}

  private shard(s: number, k: number): Promise<Shard> {
    const key = `${s}/${k}`; let p = this.shards.get(key);
    if (!p) {
      p = fetch(dataUrl(`vault/${key}.json`)).then((r) => r.json()).then((w: { yt: string; yr: number[]; t: string; an: string; a: number[] }) => ({ ...w, t: w.t.split("\n"), an: w.an.split("\n") }));
      p.catch(() => this.shards.delete(key));
      this.shards.set(key, p);
    }
    return p;
  }
  /** track `pos` of star s's vault */
  async track(s: number, pos: number): Promise<VaultTrack> {
    const sh = await this.shard(s, Math.floor(pos / this.size)), j = pos % this.size;
    return { yt: sh.yt.slice(j * 11, j * 11 + 11), yr: sh.yr[j], t: sh.t[j], an: sh.an[sh.a[j]] };
  }
  /** where a YouTube id is in star s's vault, or -1 */
  async find(s: number, yt: string): Promise<number> {
    let p = this.ids.get(s);
    if (!p) { p = fetch(dataUrl(`vault/${s}/ids.json`)).then((r) => (r.ok ? r.json() : { yt: "" })).then((o: { yt: string }) => o.yt).catch(() => ""); this.ids.set(s, p); }
    const all = await p;
    for (let k = all.indexOf(yt); k >= 0; k = all.indexOf(yt, k + 1)) if (k % 11 === 0) return k / 11;
    return -1;
  }
}
