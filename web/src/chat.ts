// COMMS on its own page (comms.html): the founder's console — the open channel and who's on air, to
// keep in a tab of its own, with everything COMMS in the observatory has: every command (ui/commands.ts,
// /tip and /sys included), reactions, replies, SYSTEM, and word when a pilot signs up or gets in.
// Other pilots see only a note pointing back to the observatory.
// Light: no map here. A shared track or a fleet opens in the observatory tab (it's told over a
// BroadcastChannel; if none is open, a new one opens). Signing in happens in the observatory: the
// session is shared, so this page follows along.
import "@fontsource/dotgothic16/latin-400.css";
import "@fontsource/dotgothic16/cyrillic-400.css";
import "@fontsource/martian-mono/latin-400.css";
import "@fontsource/martian-mono/cyrillic-400.css";
import "./style.css";
import { esc } from "./core/util";
import { $ } from "./core/dom";
import { browserKV } from "./store/storage";
import { Prefs } from "./store/prefs";
import { applyCursors } from "./ui/cursors";
import { ALL, goLive, loadRoom, messages, onComms, remove, report, toggleReaction, transmit, type Msg } from "./cloud/comms";
import { approveAll, grantAccess, lookup, onPilot, pilot, roster, wake, waitingPilots, watchPilots } from "./cloud/pilots";
import { cloud } from "./cloud/client";
import { avatarSvg, systemAvatarSvg } from "./ui/avatar";
import { isStaff, rankOf } from "./ui/ranks";
import { runCommand } from "./ui/commands";
import { goToMessage, nameTag, paintReplyBar, quote, reactionRow, sysHead, time } from "./ui/commsView";
import { initRail, say } from "./ui/rail";
import { paintLogos } from "./ui/logo";
import type { RealtimeChannel } from "@supabase/supabase-js";

paintLogos();
// the phosphor the observatory uses
document.documentElement.dataset.phosphor = new Prefs(browserKV).phosphor;
{ const cs = getComputedStyle(document.documentElement); applyCursors(`rgb(${cs.getPropertyValue("--ph").trim().split(/\s+/).join(",")})`, cs.getPropertyValue("--bg").trim()); }

type Host = { id: string; nick: string; avatar: number; rank?: string; title: string; artist: string; style: string; n: number };
let view: "all" | "air" = "all", hosts: Host[] = [], note: { text: string; kind: "err" | "info" } | null = null;
const reported = new Set<number>();
let replyTo: number | null = null;

// —— the observatory tab: play there (or open one)
const bus = typeof BroadcastChannel === "function" ? new BroadcastChannel("sound-cosmos") : null;
function openInObservatory(hash: string, what: string) {
  let heard = false;
  const ack = (e: MessageEvent) => { if (e.data?.ack === hash) heard = true; };
  bus?.addEventListener("message", ack);
  bus?.postMessage({ go: hash });
  setTimeout(() => {
    bus?.removeEventListener("message", ack);
    if (heard) say(`${what} in the observatory tab`);
    else window.open(`./${hash}`, "sound-cosmos");
  }, 450);
}

// —— shared tracks: the card needs the map's names, fetched only when a track is shared
type Placed = { title: string; artist: string; label: string; style: string; year: number; color: string; yt: string } | null;
const cards = new Map<string, Placed | "pending">();
function trackCard(text: string) {
  const m = text.match(/#sig-([A-Za-z0-9_-]{11})\.([^\s#?&]+)/); if (!m) return "";
  const key = `${m[1]}.${m[2]}`, hash = `#sig-${key}`, c = cards.get(key);
  if (c === undefined) {
    cards.set(key, "pending");
    import("./app/signal").then(async ({ find, parseSignal }) => {
      const { chunk, galaxy } = await import("./app/state");
      const sig = parseSignal(hash)!, r = await find(sig), ch = r && chunk(r.s);
      cards.set(key, r && ch ? { title: ch.t[r.i], artist: ch.an[ch.a[r.i]], label: ch.p[r.i] >= 0 ? galaxy.planets[ch.p[r.i]].name : "ASTEROID BELT", style: galaxy.stars[r.s].name, year: ch.yr[r.i], color: galaxy.stars[r.s].color, yt: ch.yt[r.i] } : null);
      paint();
    });
  }
  if (c === undefined || c === "pending") return `<div class="sig-card wait">TUNING IN TO A SIGNAL…</div>`;
  if (!c) return `<div class="sig-card wait">THIS SIGNAL IS NOT ON THE MAP ANY MORE</div>`;
  return `<button type="button" class="sig-card" data-go="${esc(hash)}" style="--acc:${c.color}" title="Play it in the observatory">
    <span class="frame thumb sig-th"><img alt="" src="https://i.ytimg.com/vi/${esc(c.yt)}/default.jpg" referrerpolicy="no-referrer"><span class="raster"></span></span>
    <span class="sig-i"><b>${esc(c.title)}</b><span>${esc(c.artist)}</span><i>${esc(c.label.toUpperCase())} · ${esc(c.style.toUpperCase())}${c.year ? ` · ${c.year}` : ""}</i></span>
    <span class="sig-go">▶</span></button>`;
}
function fleetCard(hostId: string) {
  const live = hosts.find((h) => h.id === hostId), p = roster.get(hostId), k = rankOf(p?.rank), name = esc((p?.nick ?? live?.nick ?? "A PILOT").toUpperCase());
  const head = `<span class="fc-h"><span class="fc-lamp${live ? " on" : ""}">${live ? "● LIVE" : "○ OFF AIR"}</span><b${k.color ? ` style="color:${k.color}"` : ""}>${name}</b><span class="fc-k">FLEET</span></span>`;
  if (!live) return `<div class="fleet-card off">${avatarSvg(p?.avatar ?? 0, 40)}<span class="fc-i">${head}<span class="fc-t">This broadcast has ended.</span></span></div>`;
  return `<button type="button" class="fleet-card" data-go="#fleet-${esc(hostId)}" title="Tune in, in the observatory">${avatarSvg(p?.avatar ?? live.avatar, 40)}<span class="fc-i">${head}
    <span class="fc-t">♪ ${esc(live.artist)}${live.artist ? " — " : ""}${esc(live.title)}</span><span class="fc-m">${esc(live.style.toUpperCase())} · ${live.n + 1} ${live.n ? "PILOTS" : "PILOT"} ABOARD</span></span><span class="fc-go">▶ TUNE IN</span></button>`;
}

// —— drawing
/** a message in a few words, for a reply's quote */
function snippet(text: string) {
  const m = text.match(/#sig-([A-Za-z0-9_-]{11})\.([^\s#?&]+)/);
  if (m) { const c = cards.get(`${m[1]}.${m[2]}`); return c && c !== "pending" ? `♪ ${c.title}` : "♪ a shared track"; }
  if (/#fleet-/.test(text)) return "an invite to a fleet";
  return text.length > 60 ? `${text.slice(0, 60)}…` : text;
}
function body(text: string) {
  const sig = /#sig-[A-Za-z0-9_-]{11}\./.test(text), f = text.match(/#fleet-([\w-]{6,64})/);
  const said = text.replace(/\S*#(sig|fleet)-\S+/, "").replace(/^tune in with me:?$/i, "").trim();
  return `${said ? `<span class="m-t">${esc(said)}</span>` : ""}${sig ? trackCard(text) : f ? fleetCard(f[1]) : ""}`;
}
function line(m: Msg) {
  const del = `<button class="m-x" data-del="${m.id}" aria-label="Delete the message" title="Delete">×</button>`;
  if (!m.pilot) {
    const sig = /#sig-/.test(m.body) ? `<span class="m-t">◆ A SIGNAL FROM THE STATION</span>` : "";
    return `<div class="msg sys" data-mid="${m.id}">${systemAvatarSvg(32)}<div class="m-b">${sysHead(m, pilot.me && isStaff(pilot.me) ? del : "")}${sig}${body(m.body)}${reactionRow(m)}</div></div>`;
  }
  const p = roster.get(m.pilot), mine = m.pilot === pilot.me?.id;
  const act = !pilot.me ? "" : mine || isStaff(pilot.me) ? del : `<button class="m-x" data-rep="${m.id}" aria-label="Report this message" ${reported.has(m.id) ? "disabled" : ""}>!</button>`;
  return `<div class="msg${mine ? " mine" : ""}${replyTo === m.id ? " replying" : ""}" data-mid="${m.id}">${avatarSvg(p?.avatar ?? 0, 32)}<div class="m-b"><span class="m-h">${nameTag(p)}<time>${time(m.created_at)}</time>${act}</span>${quote(m, snippet)}${body(m.body)}${reactionRow(m)}</div></div>`;
}
function airList() {
  if (!hosts.length) return `<p class="note">NOBODY IS BROADCASTING RIGHT NOW.</p>`;
  return hosts.map((h) => fleetCard(h.id)).join("");
}
let locked = true, connected = false;
function paint() {
  if (locked) {
    $("commsList").innerHTML = `<p class="note">${!connected ? "CONNECTING…" : "THIS CONSOLE IS FOR THE FOUNDER. CHAT IN COMMS, IN THE OBSERVATORY."}</p>`;
    $("commsForm").hidden = true; $("chatMe").innerHTML = `<a href="./" target="sound-cosmos">THE OBSERVATORY ↗</a>`;
    return;
  }
  const el = $("commsList"), atEnd = el.scrollHeight - el.scrollTop - el.clientHeight < 60, msgs = messages(ALL);
  el.innerHTML = view === "air" ? airList() : msgs.length ? msgs.map(line).join("") : `<p class="note">SILENCE ON THE CHANNEL. SAY HELLO.</p>`;
  if (atEnd && view === "all") el.scrollTop = el.scrollHeight;
  document.querySelectorAll<HTMLElement>("[data-ch]").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.ch === view)));
  $("airN").textContent = hosts.length ? String(hosts.length) : "";
  const inp = $<HTMLInputElement>("commsIn");
  $("commsForm").hidden = view === "air"; inp.disabled = !pilot.me;
  inp.placeholder = pilot.me ? "transmit to all pilots" : "sign in in the observatory to transmit";
  if (!paintReplyBar(view === "all" ? replyTo : null, snippet, click)) replyTo = null;
  const n = $("commsNote"); n.hidden = !note; n.textContent = note?.text ?? ""; n.className = `fmsg ${note?.kind === "err" ? "err" : ""}`;
  $("chatMe").innerHTML = pilot.me ? `${avatarSvg(pilot.me.avatar, 16)}<span>${nameTag(pilot.me)}</span>` : `<a href="./" target="sound-cosmos">SIGN IN IN THE OBSERVATORY ↗</a>`;
}
const tell = (text: string, kind: "err" | "info" = "err") => { note = { text: text.toUpperCase(), kind }; paint(); };

// —— doing
async function send() {
  const inp = $<HTMLInputElement>("commsIn"), text = inp.value.trim(); if (!text || !pilot.me) return;
  if (text.startsWith("/")) {
    inp.disabled = true;
    await runCommand(text, { tell, done: (said) => { inp.value = ""; note = null; paint(); if (said) say(said); } });
    inp.disabled = false; inp.focus();
    return;
  }
  inp.disabled = true; const e = await transmit(ALL, text, replyTo); inp.disabled = false; inp.focus();
  if (e) { tell(e === "too-fast" ? "Too fast. One message every few seconds" : "Transmission failed. Try again"); return; }
  inp.value = ""; note = null; replyTo = null; paint(); $("commsList").scrollTop = 1e9;
}
$("commsForm").onsubmit = (e) => { e.preventDefault(); send(); };
async function click(e: Event) {
  const t = e.target as HTMLElement;
  const rx = t.closest<HTMLElement>("[data-rx]");
  if (rx && pilot.me) {
    const [id, kind] = rx.dataset.rx!.split(":"), err = await toggleReaction(+id, kind, pilot.me.id);
    if (err) tell(/reactions/.test(err) ? "Reactions aren't switched on yet" : "Couldn't react. Try again");
    return;
  }
  const rp = t.closest<HTMLElement>("[data-reply]"); if (rp) { replyTo = +rp.dataset.reply!; paint(); $<HTMLInputElement>("commsIn").focus(); return; }
  if (t.closest("[data-unreply]")) { replyTo = null; paint(); return; }
  const gt = t.closest<HTMLElement>("[data-goto]"); if (gt) { goToMessage(gt.dataset.goto!); return; }
  const go = t.closest<HTMLElement>("[data-go]"); if (go) { openInObservatory(go.dataset.go!, go.dataset.go!.startsWith("#fleet") ? "Tuned in" : "Playing"); return; }
  const d = t.closest<HTMLElement>("[data-del]"); if (d) { if (await remove(+d.dataset.del!)) say("Message deleted"); return; }
  const r = t.closest<HTMLElement>("[data-rep]"); if (r && (await report(+r.dataset.rep!))) { reported.add(+r.dataset.rep!); paint(); say("Reported. Thank you, pilot"); }
}
$("commsList").addEventListener("click", click);
document.querySelectorAll<HTMLElement>("[data-ch]").forEach((b) => { b.onclick = () => { view = b.dataset.ch as "all" | "air"; note = null; paint(); if (view === "all") $("commsList").scrollTop = 1e9; }; });

// —— who waits for access: a bar over the channel, each pilot with a LET IN key (and LET ALL IN)
let waitList: { nick: string; created_at: string }[] = [];
const ago = (t: string) => { const m = Math.round((Date.now() - Date.parse(t)) / 60000); return m < 60 ? `${m}m` : m < 2880 ? `${Math.round(m / 60)}h` : `${Math.round(m / 1440)}d`; };
async function refreshWaiting() { waitList = (await waitingPilots()) ?? []; paintWaiting(); }
function paintWaiting() {
  let bar = document.getElementById("waitBar");
  if (!bar) {
    bar = document.createElement("div"); bar.id = "waitBar"; bar.className = "wait-bar"; $("commsList").before(bar);
    bar.addEventListener("click", async (e) => {
      const t = e.target as HTMLElement, one = t.closest<HTMLElement>("[data-let]");
      if (one) { one.textContent = "…"; const r = await grantAccess(one.dataset.let!, true); if ("error" in r) tell(`Failed: ${r.error}`); else say(`${r.nick} is in: full access`); refreshWaiting(); return; }
      if (t.closest("[data-letall]")) { const r = await approveAll(); if ("error" in r) tell(r.error === "missing" ? "Run stardig-system.sql in Supabase first" : `Failed: ${r.error}`); else say(`${r.n} ${r.n === 1 ? "pilot is" : "pilots are"} in`); refreshWaiting(); }
    });
  }
  const n = waitList.length;
  document.title = n ? `(${n}) COMMS · stardig` : "COMMS · stardig";
  bar.hidden = locked || !n;
  if (!n) { bar.innerHTML = ""; return; }
  bar.innerHTML = `<div class="wb-h"><b>◆ ${n} ${n === 1 ? "PILOT WAITS" : "PILOTS WAIT"} FOR ACCESS</b>${n > 1 ? `<button type="button" class="key sm hot" data-letall>LET ALL IN</button>` : ""}</div>` +
    waitList.map((p) => `<div class="wb-r"><span>${esc(p.nick.toUpperCase())}</span><time>waiting ${ago(p.created_at)}</time><button type="button" class="key sm" data-let="${esc(p.nick)}">LET IN</button></div>`).join("");
}

// —— start
initRail();
onComms(() => paint());
onPilot(() => { locked = !pilot.me?.admin; paint(); if (!locked) boot(); });
paint();
let booted = false;
/** the founder is here: tune in to the channel and to who's on air (once) */
async function boot() {
  if (booted) return; booted = true;
  if (!(await loadRoom(ALL))) tell("No signal from COMMS. Try again later");
  goLive((r) => r === ALL);
  paint(); $("commsList").scrollTop = 1e9;
  // word as soon as someone signs up or gets in
  refreshWaiting();
  watchPilots((kind, nick) => { say(kind === "new" ? `New pilot: ${nick} signed up and waits for access` : `${nick} is in`, "info"); refreshWaiting(); }).catch(() => {});
  setInterval(refreshWaiting, 60_000); // the "waiting for" times move on, and nothing is missed
  const sb = await cloud(), air: RealtimeChannel = sb.channel("onair", { config: { private: true } });
  air.on("presence", { event: "sync" }, async () => {
    const seen = new Set<string>();
    hosts = Object.values(air.presenceState<Host>()).flat().filter((h) => h.title !== undefined && !seen.has(h.id) && seen.add(h.id));
    await lookup(hosts.map((h) => h.id)).catch(() => {});
    paint();
  }).subscribe();
}
wake().then(() => { connected = true; locked = !pilot.me?.admin; paint(); if (!locked) boot(); });
