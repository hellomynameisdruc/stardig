// LIVE: DJ sets streaming right now (the table live_sets, kept by the Edge Function live-sets every ten
// minutes). Read with a plain request every minute; the stars they're placed in light up.
import { galaxy, state } from "../app/state";
import { ui } from "../app/ports";
import { CLOUD_KEY, CLOUD_URL } from "./client";

import type { LiveRec } from "../data/sets";

let last = "";
async function poll() {
  try {
    const r = await fetch(`${CLOUD_URL}/rest/v1/live_sets?select=v,t,c,stars,viewers,started&order=viewers.desc`, { headers: { apikey: CLOUD_KEY } });
    const rows: LiveRec[] = r.ok ? await r.json() : [];
    const key = rows.map((x) => x.v + x.stars.join()).join("|"); if (key === last) return; last = key;
    const m = new Map<number, LiveRec[]>();
    for (const x of rows) for (const name of x.stars) {
      const si = galaxy.stars.findIndex((s) => s.name === name); if (si < 0) continue;
      if (!m.has(si)) m.set(si, []); m.get(si)!.push(x);
    }
    state.live = m; state.dirty = true; ui.liveChanged();
  } catch { /* offline, or the table isn't there yet */ }
}
export function initLive() { setTimeout(poll, 3000); setInterval(poll, 60_000); }
