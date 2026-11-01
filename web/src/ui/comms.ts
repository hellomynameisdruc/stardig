// The COMMS panel: three channels in the panel under the dossier — ALL (the open channel), FLEET (the
// fleet you're in, while you're in one) and ON AIR (broadcasts to tune in to). New messages count up on
// the tab while it's closed. Commands start with "/" (ui/commands.ts).
// The messages themselves live in cloud/comms.ts, the fleets in cloud/fleet.ts.
import { esc } from "../core/util";
import { $ } from "../core/dom";
import { ALL, clearInvites, dropRoom, goLive, loadRoom, messages, onComms, remove, report, toggleReaction, transmit, type Msg } from "../cloud/comms";
import { crewCount, lookup, onPilot, pilot, roster, wake } from "../cloud/pilots";
import { setCrew } from "./ticker";
import { beta } from "../app/beta";
import { ui } from "../app/ports";
import { fleet, fleetRoom, inviteLink, known, leave, onFleet, tuneIn, watchOnAir } from "../cloud/fleet";
import { chunk, galaxy } from "../app/state";
import { select } from "../app/actions";
import { find, parseSignal, placed, withoutSignal } from "../app/signal";
import { avatarSvg, systemAvatarSvg } from "./avatar";
import { openPilot } from "./pilot";
import { isStaff, rankOf } from "./ranks";
import { flashKey, say } from "./rail";
import { copyInvite } from "./fleet";
import { ICON } from "./dock";
import { runCommand, waitingNote } from "./commands";
import { goToMessage, nameTag, paintReplyBar, quote, reactionRow, sysHead, time } from "./commsView";

type View = "all" | "fleet" | "air";
let view: View = "all", started = false, unread = 0;
let note: { text: string; kind: "err" | "info" } | null = null;
const reported = new Set<number>();
const room = () => (view === "fleet" ? fleetRoom() : ALL);
const seen = () => !$("comms").hidden && !document.hidden;

// —— drawing
// Each shared track still being looked up asks for ONE repaint when it's found, and repaints are batched
// into one per frame. (Asking on every paint made each paint ask again: the repaints multiplied until
// the page froze.)
const asked = new Set<string>();
let repaint = 0;
const paintSoon = () => { if (!repaint) repaint = requestAnimationFrame(() => { repaint = 0; paint(); }); };
function awaitSignal(sig: { yt: string; star: string }) {
  const k = `${sig.yt}.${sig.star}`; if (asked.has(k)) return; asked.add(k);
  find(sig).then(paintSoon, paintSoon);
}
/**
 * A shared track as a card: cover, title, artist, style; a click flies there and plays it. Drawn from
 * the message itself (new shares carry "♪ title — artist" before the link) and the YouTube cover, so the
 * chat never has to load the tracks of every style it mentions; older shares are looked up, one star at
 * a time, only while COMMS is open — or if their star is loaded already.
 */
function signalCard(text: string) {
  const sig = parseSignal(text)!, said = withoutSignal(text), st = galaxy.stars[galaxy.starIndex(sig.star)];
  const meta = said.match(/^♪\s*(.+?)(?:\s+—\s+(.+))?$/);
  let title = meta?.[1] ?? "", artist = meta?.[2] ?? "", extra = "";
  const before = said && !meta ? `<span class="m-t">${esc(said)}</span>` : "";
  if (!title) {
    const r = placed(sig), ch = r && chunk(r.s);
    if (r && ch) { title = ch.t[r.i]; artist = ch.an[ch.a[r.i]]; const pi = ch.p[r.i]; extra = `${pi >= 0 ? galaxy.planets[pi].name : "ASTEROID BELT"}`; }
    else if (r === undefined && seen()) awaitSignal(sig);
    else if (r === null) return `${before}<div class="sig-card wait">THIS SIGNAL IS NOT ON THE MAP ANY MORE</div>`;
  }
  return `${before}<button type="button" class="sig-card" data-sigh="${esc(`${sig.yt}.${sig.star}`)}" style="--acc:${st?.color ?? "var(--ink)"}" title="Fly there and play it">
    <span class="frame thumb sig-th"><img alt="" src="https://i.ytimg.com/vi/${esc(sig.yt)}/default.jpg" referrerpolicy="no-referrer"><span class="raster"></span></span>
    <span class="sig-i"><b>${esc(title || "A shared signal")}</b><span>${esc(artist)}</span><i>${extra ? `${esc(extra.toUpperCase())} · ` : ""}${esc(sig.star.toUpperCase())}</i></span>
    <span class="sig-go">▶</span></button>`;
}
/** a message's text; a shared track or an invite to a fleet becomes a card */
function body(text: string, nick?: string) {
  if (parseSignal(text)) return signalCard(text);
  const f = text.match(/#fleet-([\w-]{6,64})/);
  if (!f) return `<span class="m-t">${esc(text)}</span>`;
  const rest = text.replace(/\S*#fleet-[\w-]{6,64}\S*/, "").replace(/^tune in with me:?$/i, "").trim();
  return `${rest ? `<span class="m-t">${esc(rest)}</span>` : ""}${fleetCard(f[1], nick)}`;
}
/** an invite to a fleet: the host, and — while they're on air — what's playing and who's aboard */
function fleetCard(hostId: string, nick?: string) {
  const live = fleet.hosts.find((h) => h.id === hostId), p = roster.get(hostId) ?? (live && known(live));
  if (!p && !looked.has(hostId)) { looked.add(hostId); lookup([hostId]).then(paintSoon).catch(() => {}); }
  const name = esc((p?.nick ?? nick ?? "A PILOT").toUpperCase()), k = rankOf(p?.rank), aboard = fleet.role === "crew" && fleet.hostId === hostId, self = hostId === pilot.me?.id;
  const head = `<span class="fc-h"><span class="fc-lamp${live ? " on" : ""}">${live ? "● LIVE" : "○ OFF AIR"}</span><b${k.color ? ` style="color:${k.color}"` : ""}>${name}</b><span class="fc-k">FLEET</span></span>`;
  if (!live) return `<div class="fleet-card off">${avatarSvg(p?.avatar ?? 0, 40)}<span class="fc-i">${head}<span class="fc-t">This broadcast has ended. Look for it in ON AIR next time.</span></span></div>`;
  const n = live.n, key = self ? `<span class="fc-go you">YOU</span>` : aboard ? `<span class="fc-go you">ABOARD</span>` : `<span class="fc-go">▶ TUNE IN</span>`;
  return `<button type="button" class="fleet-card" ${self || aboard ? "disabled" : `data-join="${esc(hostId)}"`} title="Listen along with ${name}">${avatarSvg(p?.avatar ?? 0, 40)}<span class="fc-i">${head}
    <span class="fc-t">♪ ${esc(live.artist)}${live.artist ? " — " : ""}${esc(live.title)}</span>
    <span class="fc-m">${esc(live.style.toUpperCase())} · ${n + 1} ${n === 0 ? "PILOT" : "PILOTS"} ABOARD</span></span>${key}</button>`;
}
const looked = new Set<string>();
/** a word from the station itself: a new pilot in the ranks */
function sysLine(m: Msg) {
  const act = pilot.me && isStaff(pilot.me) ? `<button class="m-x" data-del="${m.id}" aria-label="Delete the message" title="Delete">×</button>` : "";
  return `<div class="msg sys" data-mid="${m.id}">${systemAvatarSvg(32)}<div class="m-b">${sysHead(m, act)}${parseSignal(m.body) ? `<span class="m-t">◆ A SIGNAL FROM THE STATION</span>` : ""}${body(m.body)}${reactionRow(m)}</div></div>`;
}
function line(m: Msg) {
  if (!m.pilot) return sysLine(m);
  const p = roster.get(m.pilot), mine = m.pilot === pilot.me?.id;
  const act = !pilot.me ? "" : mine || isStaff(pilot.me)
    ? `<button class="m-x" data-del="${m.id}" aria-label="Delete the message" title="Delete">×</button>`
    : `<button class="m-x" data-rep="${m.id}" aria-label="Report this message" title="${reported.has(m.id) ? "Reported" : "Report"}" ${reported.has(m.id) ? "disabled" : ""}>!</button>`;
  return `<div class="msg${mine ? " mine" : ""}${replyTo === m.id ? " replying" : ""}" data-mid="${m.id}">${avatarSvg(p?.avatar ?? 0, 32)}<div class="m-b"><span class="m-h">${nameTag(p)}<time>${time(m.created_at)}</time>${act}</span>${quote(m, snippet)}${body(m.body, p?.nick)}${reactionRow(m)}</div></div>`;
}
/** a message in a few words: a shared track by its title */
function snippet(text: string) {
  const sig = parseSignal(text);
  if (sig) { const r = placed(sig), ch = r && chunk(r.s); if (ch && r) return `♪ ${ch.t[r.i]}`; return "♪ a shared track"; }
  if (/#fleet-/.test(text)) return "an invite to a fleet";
  return text.length > 60 ? `${text.slice(0, 60)}…` : text;
}
let replyTo: number | null = null;
function paintReply() { if (!paintReplyBar(replyTo, snippet, act)) replyTo = null; }
function airList() {
  if (!fleet.hosts.length) return `<p class="note">NOBODY IS BROADCASTING RIGHT NOW. START ONE WITH <span class="ico-in">${ICON.cast}</span> IN THE PLAYER.</p>`;
  return fleet.hosts.map((raw) => {
    const h = known(raw), self = h.id === pilot.me?.id, on = fleet.role === "crew" && fleet.hostId === h.id;
    const key = self ? `<span class="air-tag">YOU</span>` : on ? `<button type="button" class="key sm" data-leave>LEAVE</button>` : `<button type="button" class="key sm hot" data-join="${esc(h.id)}">TUNE IN</button>`;
    return `<div class="msg air">${avatarSvg(h.avatar, 32)}<div class="m-b"><span class="m-h">${nameTag(h)}<time>${h.n} ${h.n === 1 ? "PILOT" : "PILOTS"}</time></span><span class="m-t">♪ ${esc(h.artist)}${h.artist ? " — " : ""}${esc(h.title)}</span><span class="m-s">${esc(h.style.toUpperCase())}</span></div>${key}</div>`;
  }).join("");
}

function paint() {
  if (view === "fleet" && !fleet.role) view = "all";
  const el = $("commsList"), atEnd = el.scrollHeight - el.scrollTop - el.clientHeight < 40, msgs = messages(room());
  const invite = fleet.role ? `<div class="fl-inv"><span>INVITE PILOTS</span><button type="button" class="key sm" data-fl-copy>COPY LINK</button><button type="button" class="key sm" data-fl-post>POST TO ALL</button></div>` : "";
  // older shared tracks are looked up newest first, so the latest cards fill in before the old ones
  if (seen() && view !== "air") for (let k = msgs.length - 1; k >= 0; k--) {
    const sig = parseSignal(msgs[k].body);
    if (sig && !/^♪/.test(withoutSignal(msgs[k].body)) && placed(sig) === undefined) awaitSignal(sig);
  }
  el.innerHTML = view === "air" ? airList()
    : view === "fleet" ? invite + (msgs.length ? msgs.map(line).join("") : `<p class="note">THE FLEET'S OWN CHANNEL. ITS MESSAGES FADE A FEW HOURS ON.</p>`)
    : msgs.length ? msgs.map(line).join("") : `<p class="note">${started ? "SILENCE ON THE CHANNEL FOR A DAY. SAY HELLO." : "TUNING IN…"}</p>`;
  if (atEnd && view !== "air") el.scrollTop = el.scrollHeight;
  for (const b of document.querySelectorAll<HTMLElement>("#comms .tabs [data-ch]")) b.setAttribute("aria-selected", String(b.dataset.ch === view));
  $("chFleet").hidden = !fleet.role;
  $("fleetN").textContent = fleet.role ? String(fleet.crew.length + 1) : "";
  $("airN").textContent = fleet.hosts.length ? String(fleet.hosts.length) : "";
  $("popOut").hidden = !pilot.me?.admin; // COMMS in a tab of its own: the founder's console
  const f = $("commsForm"), inp = $<HTMLInputElement>("commsIn");
  f.hidden = view === "air"; f.classList.toggle("off", !pilot.me);
  inp.disabled = !pilot.me;
  inp.placeholder = !pilot.me ? "sign in to transmit" : view === "fleet" ? "talk to your fleet" : "transmit to all pilots";
  paintReply();
  const n = $("commsNote"); n.hidden = !note; n.textContent = note?.text ?? ""; n.className = `fmsg ${note?.kind === "err" ? "err" : ""}`;
}
function paintUnread() {
  const b = $("commsUnread"); b.hidden = !unread; b.textContent = unread > 99 ? "99+" : String(unread);
  $("tabComms").classList.toggle("news", unread > 0);
}
const tell = (text: string, kind: "err" | "info" = "err") => { note = { text: text.toUpperCase(), kind }; paint(); };

/** the founder's list of pilots waiting for access, as a note in COMMS */
export async function showWaiting() {
  document.getElementById("tabComms")?.click(); // the COMMS tab, where the note shows
  const [text, kind] = await waitingNote(); tell(text, kind);
}

// —— doing
async function start() {
  if (started) return; started = true;
  wake();
  if (!(await loadRoom(ALL))) tell("No signal from COMMS. Try again later");
  goLive((r) => r === ALL || r === fleetRoom());
}

async function send() {
  const inp = $<HTMLInputElement>("commsIn"), text = inp.value.trim(), r = room();
  if (!pilot.me) { openPilot(); return; }
  if (!text || !r) return;
  if (text.startsWith("/")) {
    await runCommand(text, { tell, done: (said) => { inp.value = ""; note = null; paint(); if (said) say(said); } });
    return;
  }
  if (!beta.open) { tell("Closed beta: COMMS opens once you have access. Enter an invite in your pilot card"); return; }
  inp.disabled = true;
  const e = await transmit(r, text, replyTo);
  inp.disabled = false; inp.focus();
  if (e) { tell(e === "too-fast" ? "Too fast. One message every few seconds" : "Transmission failed. Try again"); return; }
  inp.value = ""; note = null; replyTo = null; paint(); $("commsList").scrollTop = $("commsList").scrollHeight;
}

async function act(e: Event) {
  const t = e.target as HTMLElement;
  const rxk = t.closest<HTMLElement>("[data-rx]");
  if (rxk) {
    if (!pilot.me) { openPilot(); return; }
    if (!beta.open) { ui.locked(-1); return; }
    const [id, kind] = rxk.dataset.rx!.split(":"); const err = await toggleReaction(+id, kind, pilot.me.id);
    if (err) tell(/reactions/.test(err) ? "Reactions aren't switched on yet" : "Couldn't react. Try again");
    return;
  }
  const rp = t.closest<HTMLElement>("[data-reply]");
  if (rp) { replyTo = +rp.dataset.reply!; paint(); $<HTMLInputElement>("commsIn").focus(); return; }
  if (t.closest("[data-unreply]")) { replyTo = null; paint(); return; }
  const go = t.closest<HTMLElement>("[data-goto]");
  if (go) { goToMessage(go.dataset.goto!); return; }
  const sg = t.closest<HTMLElement>("[data-sigh]");
  if (sg) {
    const [yt, ...rest] = sg.dataset.sigh!.split("."), r = await find({ yt, star: rest.join(".") });
    if (r) select({ kind: "track", ...r }, true, true); else flashKey(sg, "NOT ON THE MAP");
    return;
  }
  const j = t.closest<HTMLElement>("[data-join]"); if (j) { if (!beta.open) { ui.locked(-1); return; } await tuneIn(j.dataset.join!); return; }
  if (t.closest("[data-leave]")) { await leave(); return; }
  const cp = t.closest<HTMLElement>("[data-fl-copy]"); if (cp) { if (await copyInvite()) flashKey(cp, "COPIED ✓"); return; }
  if (t.closest("[data-fl-post]")) {
    if (!pilot.me) { openPilot(); return; }
    view = "all"; paint();
    await clearInvites(pilot.me.id); // one invite at a time: the new one replaces the old
    const err = await transmit(ALL, inviteLink());
    if (err) tell(err === "too-fast" ? "Too fast. One message every few seconds" : "Transmission failed. Try again"); else say("Invite posted to ALL");
    return;
  }
  const del = t.closest<HTMLElement>("[data-del]");
  if (del) { if (await remove(+del.dataset.del!)) say("Message deleted"); else say("Could not delete the message", "err"); return; }
  const rep = t.closest<HTMLElement>("[data-rep]");
  if (rep && (await report(+rep.dataset.rep!))) { reported.add(+rep.dataset.rep!); paint(); say("Reported. Thank you, pilot"); }
}

/** opening the tab: the latest messages in view (the list can't scroll while it's hidden) */
const toEnd = () => requestAnimationFrame(() => { const el = $("commsList"); el.scrollTop = el.scrollHeight; });
export const openComms = () => { asked.clear(); start(); watchOnAir().catch(() => {}); unread = 0; paintUnread(); paint(); toEnd(); };

export function initComms() {
  $("commsForm").onsubmit = (e) => { e.preventDefault(); send(); };
  $("commsForm").onclick = () => { if (!pilot.me) openPilot(); };
  $("commsList").addEventListener("click", act);
  document.querySelectorAll<HTMLElement>("#comms .tabs [data-ch]").forEach((b) => {
    b.onclick = () => { view = b.dataset.ch as View; note = null; paint(); if (view !== "air") $("commsList").scrollTop = 1e9; };
  });
  // the pilots in the ranks, on the ticker: now, every few minutes, and as soon as SYSTEM welcomes one
  const count = () => crewCount().then(setCrew).catch(() => {});
  setTimeout(count, 3000); setInterval(count, 5 * 60_000);
  onComms((c) => {
    if (c.kind === "new" && !c.msg.pilot) count();
    if (c.kind === "new" && c.msg.pilot !== pilot.me?.id && !seen()) { unread++; paintUnread(); }
    if (started || !$("comms").hidden) paint();
    if (c.kind === "loaded") toEnd();
    if (c.kind === "loaded") toEnd();
  });
  // joining a fleet opens its room; leaving falls back to ALL
  let was: string | null = null;
  onFleet(() => {
    const r = fleetRoom();
    if (r !== was) { if (was) dropRoom(was); was = r; if (r) { view = "fleet"; start(); loadRoom(r); } }
    if (started || !$("comms").hidden) paint();
  });
  onPilot(() => { if (started || !$("comms").hidden) paint(); });
  document.addEventListener("visibilitychange", () => { if (seen()) { unread = 0; paintUnread(); } });
  // tune in a moment after the map is up, so new messages count on the tab
  setTimeout(() => { start(); watchOnAir().catch(() => {}); }, 4000);
}
