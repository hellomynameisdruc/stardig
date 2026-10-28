// First flight: a few steps on the rail for someone who has never played a track here — click a star,
// then a planet, then a satellite, then play — each one shown when the one before is done, so the
// first minute ends with music. It goes for good once a track plays (or on SKIP).
import { $ } from "../core/dom";
import { flightLog, state } from "../app/state";
import { browserKV } from "../store/storage";
import { clearMode, say, setMode } from "./rail";

const DONE = "kosmos-coached";
const STEPS = [
  "CLICK A <b>STAR</b> ON THE MAP: EACH ONE IS A STYLE OF MUSIC",
  "NOW A <b>PLANET</b> ROUND IT: EACH PLANET IS A RECORD LABEL",
  "CLICK A <b>SATELLITE</b> (A DOT ROUND THE PLANET): EACH ONE IS A TRACK. OR <b>▶ SOLARIS STATION</b> PLAYS THE WHOLE LABEL",
  "PRESS <b>▶ PLAY</b> (OR <kbd>SPACE</kbd>) AND LISTEN",
];

export function initCoach() {
  let off = false; try { off = !!browserKV.get(DONE); } catch { /* storage blocked */ }
  if (off || flightLog.size > 0 || location.hash) return;
  let step = -1;
  const stop = (why: "done" | "skip") => {
    clearInterval(timer); clearMode("coach");
    try { browserKV.set(DONE, "1"); } catch { /* */ }
    if (why === "done") say("Signal acquired. → next track, L beacon, D dig the belt, ? the briefing");
  };
  const tick = () => {
    if (state.nowPlaying) { stop("done"); return; }
    if (!$("brief").hidden) return; // the briefing first
    const sel = state.sel;
    const k = !sel ? 0 : sel.kind === "star" ? 1 : sel.kind === "planet" ? 2 : 3;
    if (k === step) return;
    step = k;
    setMode("coach", STEPS[k], [{ label: "SKIP", run: () => stop("skip") }], "mode", `FIRST FLIGHT ${k + 1}/4`, 5);
  };
  const timer = window.setInterval(tick, 400);
}
