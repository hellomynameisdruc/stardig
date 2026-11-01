// Pieces of a COMMS message drawn the same in the observatory and on the founder's console: the time,
// the name with its rank, SYSTEM's head, the line quoting what a reply answers, and the reactions row
// (with, on hover, the keys to react and to reply).
import { esc, pad } from "../core/util";
import { messageById, REACTIONS, reactionsOf, type Msg } from "../cloud/comms";
import { pilot, roster } from "../cloud/pilots";
import { rankOf, rankTag } from "./ranks";

export const time = (iso: string) => { const d = new Date(iso); return `${pad(d.getHours(), 2)}:${pad(d.getMinutes(), 2)}`; };
export function nameTag(p: { nick?: string; rank?: string } | undefined) {
  const k = rankOf(p?.rank);
  return `${rankTag(p?.rank)}<b${k.color ? ` style="color:${k.color}"` : ""}>${esc((p?.nick ?? "PILOT").toUpperCase())}</b>`;
}
export const sysHead = (m: Msg, act = "") => `<span class="m-h"><span class="rk" style="--rk:var(--red)" title="The station">◆ SYS</span><b class="sys-n">SYSTEM</b><time>${time(m.created_at)}</time>${act}</span>`;
export const whoSaid = (m: Msg) => (!m.pilot ? "SYSTEM" : roster.get(m.pilot)?.nick ?? "PILOT");

/** what a message answers: a line quoting it (a click scrolls to it) */
export function quote(m: Msg, snippet: (text: string) => string) {
  if (!m.reply_to) return "";
  const q = messageById(m.reply_to);
  return `<button type="button" class="m-q" data-goto="${m.reply_to}">↩ ${q ? `<b>${esc(whoSaid(q).toUpperCase())}</b> ${esc(snippet(q.body))}` : "AN EARLIER MESSAGE"}</button>`;
}
/** the reactions under a message (mine lit), and on hover the keys to react and to reply */
export function reactionRow(m: Msg) {
  const me = pilot.me?.id, got = reactionsOf(m.id);
  const chips = Object.entries(REACTIONS).flatMap(([k, r]) => {
    const who = got?.get(k); if (!who?.size) return [];
    const names = [...who].map((id) => roster.get(id)?.nick ?? "pilot").join(", ");
    return [`<button type="button" class="rx${me && who.has(me) ? " on" : ""}" data-rx="${m.id}:${k}" title="${esc(r.name)}: ${esc(names)}">${r.glyph} ${who.size}</button>`];
  }).join("");
  const keys = !pilot.me ? "" : `<span class="m-acts">${Object.entries(REACTIONS).map(([k, r]) => `<button type="button" class="rx-k" data-rx="${m.id}:${k}" title="${esc(r.name)}" aria-label="${esc(r.name)}">${r.glyph}</button>`).join("")}<button type="button" class="rx-k rp" data-reply="${m.id}" title="Reply" aria-label="Reply">↩ REPLY</button></span>`;
  return chips || keys ? `<div class="m-rx">${chips}${keys}</div>` : "";
}
/** the bar over the input while replying (the element is made once, before the form) */
export function paintReplyBar(replyTo: number | null, snippet: (text: string) => string, onClick: (e: Event) => void): boolean {
  let bar = document.getElementById("commsReply");
  if (!bar) { bar = document.createElement("div"); bar.id = "commsReply"; bar.className = "comms-reply"; document.getElementById("commsForm")!.before(bar); bar.addEventListener("click", onClick); }
  const q = replyTo ? messageById(replyTo) : null;
  if (!q) { bar.hidden = true; return false; }
  bar.hidden = false;
  bar.innerHTML = `<span>↩ REPLYING TO <b>${esc(whoSaid(q).toUpperCase())}</b> · ${esc(snippet(q.body))}</span><button type="button" class="key icon sm" data-unreply aria-label="Cancel the reply">×</button>`;
  return true;
}
/** scroll to a message in the list and flash it */
export function goToMessage(id: string) {
  const el = document.querySelector<HTMLElement>(`#commsList [data-mid="${id}"]`);
  el?.scrollIntoView({ block: "center", behavior: "smooth" }); el?.classList.add("flash"); setTimeout(() => el?.classList.remove("flash"), 1200);
}
