// Dead signals, shared: a video found removed, private or not allowed elsewhere is reported by the
// signed-in pilot who hit it; once two pilots have (or the founder or a warden), it goes dark on
// every map (supabase/dead-signals.sql). The list is read with a plain request, so a guest's visit
// doesn't load the cloud library for it.
import { dead, state } from "../app/state";
import { CLOUD_KEY, CLOUD_URL, cloud } from "./client";
import { pilot } from "./pilots";

/** a pilot hit a dead video: tell the others (signed-in pilots only; one report per pilot and video) */
export function reportDead(yt: string, code: number) {
  if (!pilot.me) return;
  cloud().then((sb) => sb.rpc("report_dead", { yt, code })).catch(() => {});
}

/** the dead signals other pilots found, a few seconds after the map is up */
export function loadSharedDead() {
  setTimeout(() => {
    fetch(`${CLOUD_URL}/rest/v1/dead_signals?select=yt`, { headers: { apikey: CLOUD_KEY, Range: "0-19999" } })
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: { yt: string }[]) => { if (dead.addShared(rows.map((r) => r.yt))) state.dirty = true; })
      .catch(() => {});
  }, 5000);
}
