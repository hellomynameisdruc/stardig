// Smooth transitions: when a track is about to end by itself and the next will follow (the autopilot,
// a station, an odyssey, a list, DIG), its last seconds fade out, and the next one fades in back to
// your volume. One YouTube player, so between them there's the breath it takes the next video to load.
// A track you pick yourself starts at once, at your volume; touching the volume stops a fade.
// For now a test: stardig.app/?fade=1 turns it on in this browser (?fade=0 off).
import { $ } from "../core/dom";
import { state } from "../app/state";
import { browserKV } from "../store/storage";
import type { Player } from "./youtubePlayer";

const KEY = "kosmos-fade";
let secs = 0, player: Player, fadingIn = 0, inPending = false, out = false;
const note = (text: string) => { const n = $("fadeNote"); n.hidden = !text; n.textContent = text; };

/** the next track was started by the end of this one (not by a click) */
export function fadeNext() { if (secs) inPending = true; }
/** a new track started playing */
export function fadeStarted() {
  out = false;
  if (!secs) return;
  if (inPending) { inPending = false; fadingIn = performance.now(); player.setLevel(0); note("◑ FADING IN"); }
  else { fadingIn = 0; player.setLevel(player.volume); note(""); }
}
/** the volume was moved by hand: no fade any more */
export function fadeCancel() { fadingIn = 0; out = false; note(""); }

export function initFade(p: Player) {
  player = p;
  try {
    const q = new URLSearchParams(location.search).get("fade");
    if (q === "0") browserKV.set(KEY, ""); else if (q) browserKV.set(KEY, String(Math.min(20, Math.max(2, +q === 1 ? 8 : +q || 8))));
    secs = +(browserKV.get(KEY) || 0);
  } catch { secs = 0; }
  if (!secs) return;
  setInterval(() => {
    if (!player.playing) return;
    if (fadingIn) {
      const k = (performance.now() - fadingIn) / (secs * 1000);
      if (k >= 1) { fadingIn = 0; player.setLevel(player.volume); note(""); } else player.setLevel(player.volume * k);
      return;
    }
    const auto = !state.following && $<HTMLInputElement>("autopilot").checked;
    const d = player.duration(), left = d - player.time();
    if (auto && d > secs * 3 && left <= secs && left > 0) {
      if (!out) { out = true; note("◐ FADING OUT"); }
      player.setLevel(player.volume * Math.max(0, left / secs));
    } else if (out) { out = false; player.setLevel(player.volume); note(""); } // seeked back, or the autopilot went off
  }, 100);
}
