// DJ sets on air: a long video from a star's SETS list plays in the same player (one player, always),
// which grows into SET MODE — the video big, the tracklist beside it. A line of the tracklist seeks the
// set there; a track that's on the map can be flown to (→ PLANET, the set plays on) or beaconed. ◂◂ ▸▸
// and the media keys jump along the tracklist. ⤡ (or Esc) folds SET MODE back into the usual dock.
import { $ } from "../core/dom";
import { esc, mmss } from "../core/util";
import { beacons, galaxy, state, tracks } from "../app/state";
import { select, toggleBeacon } from "../app/actions";
import { starOpen } from "../app/beta";
import { provide, ui } from "../app/ports";
import type { SetRec } from "../data/sets";
import { ICON, player, playTestSignal } from "./dock";
import { say } from "./rail";

let cur = -1;
const dockEl = () => $("playerBox");
/** a set's length: 1:58:12 */
export const hms = (d: number) => (d >= 3600 ? `${Math.floor(d / 3600)}:${mmss(d % 3600).padStart(5, "0")}` : mmss(d));
const starIdx = (name: string) => galaxy.stars.findIndex((s) => s.name === name);
/** tracks of the set found on the map */
export const onMap = (r: SetRec) => r.tl.filter((x) => x[2]).length;

/** put a set on air, in SET MODE */
export function playSet(rec: SetRec, star: string) {
  const si = starIdx(star);
  if (si >= 0 && !starOpen(si)) { ui.locked(si); return; } // closed beta: sets keep to the open galaxy too
  playTestSignal(rec.v);
  state.set = { rec, star }; state.nowPlaying = null; state.orbit = null; state.dirty = true;
  $("npTitle").textContent = rec.t; $("npArtist").textContent = rec.live ? `● LIVE · ${rec.c}` : `SET · ${rec.c} · ${rec.y}`;
  if (si >= 0) for (const id of ["playerBox", "dockPill"]) $(id).style.setProperty("--acc", galaxy.stars[si].color);
  dockEl().classList.add("set", "setmode"); dockEl().classList.toggle("live-set", !!rec.live);
  cur = -1; paintPane(); paintTicks();
}

function paintPane() {
  const s = state.set; if (!s) return;
  const r = s.rec, n = onMap(r);
  $("setPane").innerHTML = `<div class="set-head"><div class="set-t">${esc(r.t)}</div><div class="set-m">${r.live ? `<b class="live-k">● LIVE NOW</b> · ${esc(r.c)}${r.w ? ` · ${r.w.toLocaleString("en")} watching` : ""}` : `${esc(r.c)} · ${r.y} · ${hms(r.d)}`}${r.tl.length ? ` · ${n} of ${r.tl.length} on the map` : ""}</div>
    <a class="out" href="https://www.youtube.com/watch?v=${esc(r.v)}" target="_blank" rel="noopener">OPEN ON YOUTUBE ↗</a></div>
    <div class="ph-sub">TRACKLIST${r.tl.length ? ` · ${r.tl.length}` : ""}</div>
    ${r.tl.length ? `<ol class="set-tl">${r.tl.map(([sec, text, yt], k) => `<li data-k="${k}">${sec >= 0 ? `<button type="button" class="tc" data-seek="${k}" title="Play the set from here">${hms(sec)}</button>` : `<span class="tc">${String(k + 1).padStart(2, "0")}</span>`}<span class="tt${/^id\b/i.test(text) ? " id" : ""}">${esc(text)}</span>${yt ? `<button type="button" class="go" data-fly="${k}" title="Fly to this track on the map (the set plays on)">→ PLANET</button><button type="button" class="go like-k" data-like="${k}" title="Beacon this track">${ICON.beacon}</button>` : ""}</li>`).join("")}</ol>`
      : `<p class="note">${r.live ? "A live stream: no tracklist. Whatever plays, it plays now." : "No tracklist in this set's description."}</p>`}`;
  paintLikes();
}
function paintTicks() {
  const s = state.set; $("setTicks").innerHTML = s ? s.rec.tl.filter((x) => x[0] > 0 && x[0] < s.rec.d).map((x) => `<i style="left:${(x[0] / s.rec.d * 100).toFixed(2)}%"></i>`).join("") : "";
}

/** the track of line k, on the map (loading its star if needed) */
async function trackOf(k: number) {
  const x = state.set?.rec.tl[k]; if (!x?.[2]) return null;
  const s = starIdx(x[3]); if (s < 0) return null;
  const ch = await tracks.load(s), i = ch.yt.indexOf(x[2]);
  return i < 0 ? null : { s, i };
}
function paintLikes() {
  const s = state.set; if (!s) return;
  document.querySelectorAll<HTMLElement>("#setPane [data-like]").forEach((b) => {
    const k = +b.dataset.like!, x = s.rec.tl[k], si = starIdx(x[3]);
    const on = si >= 0 && beacons.has({ s: si, i: tracks.get(si)?.yt.indexOf(x[2]) ?? -1 });
    b.classList.toggle("on", on); b.innerHTML = on ? ICON.beaconOn : ICON.beacon;
  });
}

/** the line playing now: the last stamped one at or before the player's time */
function lineAt(t: number) {
  const tl = state.set?.rec.tl ?? []; let k = -1;
  for (let j = 0; j < tl.length; j++) if (tl[j][0] >= 0 && tl[j][0] <= t + 0.5) k = j;
  return k;
}
function jump(dir: number) {
  const s = state.set; if (!s) return;
  const t = player.time(), stamps = s.rec.tl.map((x) => x[0]).filter((x) => x >= 0);
  if (!stamps.length) { player.seek(Math.max(0, t + dir * 300)); return; } // no tracklist: five minutes
  if (dir > 0) { const n = stamps.find((x) => x > t + 1); if (n !== undefined) player.seek(n); return; }
  const back = stamps.filter((x) => x <= t + 0.5), at = back[back.length - 1] ?? 0;
  player.seek(t - at > 5 ? at : back[back.length - 2] ?? 0);
}

export function initSets() {
  provide({
    setJump: jump,
    setEnded: (err) => {
      if (err === undefined) say("SET OVER. Pick another from the star's DJ SETS");
      else say(err === 101 || err === 150 ? "This set's owner doesn't allow playing it here. Try OPEN ON YOUTUBE" : "This set is unavailable", "err");
    },
  });
  $("dockBig").onclick = () => dockEl().classList.toggle("setmode");
  addEventListener("keydown", (e) => {
    if (e.key === "Escape" && dockEl().classList.contains("setmode")) { dockEl().classList.remove("setmode"); e.stopImmediatePropagation(); }
  }, true);
  $("setPane").addEventListener("click", async (e) => {
    const t = e.target as HTMLElement, s = state.set; if (!s) return;
    const sk = t.closest<HTMLElement>("[data-seek]"); if (sk) { player.seek(s.rec.tl[+sk.dataset.seek!][0]); if (!player.playing) player.toggle(); return; }
    const fl = t.closest<HTMLElement>("[data-fly]");
    if (fl) { const r = await trackOf(+fl.dataset.fly!); if (r) { dockEl().classList.remove("setmode"); select({ kind: "track", ...r }); } return; }
    const lk = t.closest<HTMLElement>("[data-like]");
    if (lk) { const r = await trackOf(+lk.dataset.like!); if (r) { toggleBeacon(r); paintLikes(); } }
  });
  beacons.changed.on(paintLikes);
  setInterval(() => {
    const s = state.set; if (!s) return;
    const k = lineAt(player.time()); if (k === cur) return;
    cur = k;
    const pane = $("setPane");
    pane.querySelectorAll(".now").forEach((el) => el.classList.remove("now"));
    const li = k >= 0 ? pane.querySelector<HTMLElement>(`li[data-k="${k}"]`) : null;
    if (li) { li.classList.add("now"); if (dockEl().classList.contains("setmode")) li.scrollIntoView({ block: "nearest" }); }
    if (!s.rec.live) $("npArtist").textContent = k >= 0 ? `NOW · ${s.rec.tl[k][1]}` : `SET · ${s.rec.c} · ${s.rec.y}`;
  }, 500);
}
