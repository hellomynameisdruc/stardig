// The logbook: a signed-in pilot's beacons and flight log, kept with the account so every device has
// them. On sign-in this browser's and the account's are merged; after that every change is sent up.
// A removed beacon leaves a tombstone ("gone": id → when), so another device's copy can't bring it back
// unless it was set again later. Ore (belt tracks dug up) is a plain union. Flights are counted for good, apart from the short log: each device
// keeps its own tally and the account holds them all, so the total adds up across devices.
import { beacons, flightLog, ore } from "../app/state";
import type { Beacon, BList } from "../store/beacons";
import type { LogEntry } from "../store/flightLog";
import { browserKV, readJSON } from "../store/storage";
import { cloud } from "./client";
import { onPilot, pilot, pilotChanged } from "./pilots";

const GONE = "kosmos-gone", MAX_GONE = 500, COUNT = "kosmos-flights", DEV = "kosmos-dev";
let uid: string | null = null, applying = false, timer = 0, ready = false;
let gone: Record<string, number> = readJSON(browserKV, GONE, {});
let known = new Set(beacons.all.map((b) => b.y));
const dev = browserKV.get(DEV) ?? (() => { const d = Math.random().toString(36).slice(2, 10); browserKV.set(DEV, d); return d; })();
let counts: Record<string, number> = readJSON(browserKV, COUNT, {});
if (!Object.keys(counts).length) counts[dev] = flightLog.size; // a tally starts from what's in the log
const saveCounts = () => browserKV.set(COUNT, JSON.stringify(counts));
/** every flight ever logged, on all of this pilot's devices */
export const flightsTotal = () => Object.values(counts).reduce((a, n) => a + (Number.isFinite(n) ? n : 0), 0);

const keyOf = (e: LogEntry) => e.y ?? e.k;
function trimGone() {
  const e = Object.entries(gone).sort((a, b) => b[1] - a[1]).slice(0, MAX_GONE);
  gone = Object.fromEntries(e); browserKV.set(GONE, JSON.stringify(gone));
}

/** this browser's logbook and the account's, as one: beacons by when they were first set, minus the
 *  ones removed since (tombstones win over older copies); flights by track, latest time kept */
type Flights = LogEntry[] | { list?: LogEntry[]; count?: Record<string, number> };
export function mergeLogbook(localB: readonly Beacon[], localL: readonly LogEntry[], localGone: Record<string, number>, remote: { beacons?: unknown; gone?: unknown; flights?: unknown }, localCount: Record<string, number> = {}) {
  const rf = (remote.flights ?? []) as Flights, rList = Array.isArray(rf) ? rf : rf.list ?? [], rCount = Array.isArray(rf) ? {} : rf.count ?? {};
  const count = { ...localCount };
  for (const [d, n] of Object.entries(rCount)) if (typeof n === "number" && !(count[d] >= n)) count[d] = n;
  const g = { ...localGone }, rg = (remote.gone && typeof remote.gone === "object" ? remote.gone : {}) as Record<string, number>;
  for (const [y, t] of Object.entries(rg)) if (typeof t === "number" && !(g[y] >= t)) g[y] = t;
  const byId = new Map<string, Beacon>();
  for (const b of [...(Array.isArray(remote.beacons) ? remote.beacons : []) as Beacon[], ...localB]) {
    if (!b || typeof b.y !== "string") continue;
    const had = byId.get(b.y); if (!had || (b.at ?? 0) < (had.at ?? 0)) byId.set(b.y, b);
  }
  const list = [...byId.values()].filter((b) => !(g[b.y] >= (b.at ?? 0))).sort((a, b) => (b.at ?? 0) - (a.at ?? 0));
  const log = new Map<string, LogEntry>();
  for (const e of [...rList, ...localL]) {
    if (!e || typeof e.t !== "number") continue;
    const had = log.get(keyOf(e)); if (!had || e.t > had.t) log.set(keyOf(e), e);
  }
  return { beacons: list, flights: [...log.values()].sort((a, b) => b.t - a.t), gone: g, count };
}

/** playlists: by id, the copy changed last wins; a deleted list leaves a tombstone ("L:" + id) that
 *  beats copies older than it. Only tracks still beaconed stay in a list. */
export function mergeLists(local: readonly BList[], remote: unknown, g: Record<string, number>, have: Set<string>): BList[] {
  const by = new Map<string, BList>(), order: string[] = [];
  for (const l of [...(Array.isArray(remote) ? remote : []) as BList[], ...local]) {
    if (!l || typeof l.id !== "string" || typeof l.name !== "string" || !Array.isArray(l.ys)) continue;
    const had = by.get(l.id); if (!had) order.push(l.id);
    if (!had || (l.at ?? 0) > (had.at ?? 0)) by.set(l.id, l);
  }
  return order.map((id) => by.get(id)!).filter((l) => !(g["L:" + l.id] >= (l.at ?? 0)))
    .map((l) => ({ ...l, ys: l.ys.filter((y) => typeof y === "string" && have.has(y)) }));
}

function merge(remote: { beacons?: unknown; gone?: unknown; flights?: unknown }) {
  const m = mergeLogbook(beacons.all, flightLog.all, gone, remote, counts);
  gone = m.gone; trimGone(); counts = m.count; saveCounts();
  applying = true;
  const rf = remote.flights as { ore?: unknown; lists?: unknown } | null;
  const pl = mergeLists(beacons.lists, rf && !Array.isArray(rf) ? rf.lists : [], gone, new Set(m.beacons.map((b) => b.y)));
  try { beacons.replaceAll(m.beacons); beacons.replaceLists(pl); flightLog.replaceAll(m.flights); if (rf && !Array.isArray(rf)) ore.merge(rf.ore); }
  finally { applying = false; }
  known = new Set(beacons.all.map((b) => b.y));
}

async function push() {
  if (!uid || !ready) return;
  const sb = await cloud();
  await sb.from("logbooks").upsert({ pilot: uid, beacons: beacons.all, gone, flights: { list: flightLog.all, count: counts, ore: ore.all, lists: beacons.lists }, updated_at: new Date().toISOString() });
  // the logbook decides the earned rank: ask the registry whether this pilot has climbed
  const { data } = await sb.rpc("claim_rank");
  const me = pilot.me, r = typeof data === "string" ? data : null;
  if (me && r && r !== me.rank) { me.rank = r; promoted.forEach((f) => f(r)); pilotChanged(); }
}
const promoted: ((rank: string) => void)[] = [];
/** the pilot earned a new rank */
export const onPromoted = (f: (rank: string) => void) => { promoted.push(f); };
const later = () => { clearTimeout(timer); timer = window.setTimeout(push, 1500); };

async function pull() {
  if (!uid) return;
  const sb = await cloud(), { data, error } = await sb.from("logbooks").select("beacons,gone,flights").eq("pilot", uid).maybeSingle();
  if (error) return; // no logbook table yet: stay local
  if (data) merge(data);
  ready = true; await push();
}

export function initSync() {
  beacons.changed.on(() => {
    const now = new Set(beacons.all.map((b) => b.y));
    if (!applying) { for (const y of known) if (!now.has(y)) gone[y] = Date.now(); trimGone(); }
    known = now;
    if (!applying) later();
  });
  beacons.listGone.on((id) => { if (applying) return; gone["L:" + id] = Date.now(); trimGone(); });
  ore.changed.on(() => { if (!applying) later(); });
  flightLog.changed.on(() => { if (applying) return; counts[dev] = (counts[dev] ?? 0) + 1; saveCounts(); later(); });
  onPilot(() => {
    const id = pilot.me?.id ?? null; if (id === uid) return;
    const was = uid; uid = id; ready = false;
    if (uid) { pull(); return; }
    // signed out: the logbook lives with the account; this browser forgets it (nothing is sent)
    if (was) {
      clearTimeout(timer); applying = true;
      try { beacons.replaceAll([]); beacons.replaceLists([]); flightLog.replaceAll([]); ore.clear(); }
      finally { applying = false; }
      gone = {}; browserKV.set(GONE, "{}"); counts = {}; saveCounts(); known = new Set();
    }
  });
  // coming back to the tab: pick up what other devices added meanwhile
  document.addEventListener("visibilitychange", () => { if (!document.hidden && uid) pull(); });
}
