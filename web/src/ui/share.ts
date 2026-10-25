// Sharing a track: its stable link copied, or sent to the open COMMS channel (ALL), where it shows as
// a card. From the player (the track on air) and from a track's dossier.
import { $ } from "../core/dom";
import { state } from "../app/state";
import { signalLink } from "../app/signal";
import { ALL, transmit } from "../cloud/comms";
import { pilot } from "../cloud/pilots";
import { openPilot } from "./pilot";
import { flashKey, say } from "./rail";
import { beta } from "../app/beta";

/** shares; the key it was pressed on says how it went (COPIED ✓ / SENT ✓ / NOT SENT), the rail says more */
export async function shareTrack(o: { s: number; i: number }, how: "copy" | "send", key?: HTMLElement | null): Promise<boolean> {
  const link = signalLink(o.s, o.i);
  if (how === "copy") {
    try { await navigator.clipboard.writeText(link); flashKey(key ?? null, "COPIED ✓"); say("Link copied. Paste it in COMMS or anywhere"); return true; }
    catch { flashKey(key ?? null, "✕ NOT COPIED"); say(`Copy this link: ${link}`, "err"); return false; }
  }
  if (!pilot.me) { openPilot(); return false; }
  if (!beta.open) { flashKey(key ?? null, "✕ NEEDS ACCESS"); say("Closed beta: COMMS opens once you have access", "err"); return false; }
  if (key) { key.dataset.label ??= key.innerHTML; key.textContent = "SENDING…"; }
  const e = await transmit(ALL, link);
  if (key?.dataset.label) { key.innerHTML = key.dataset.label; delete key.dataset.label; }
  if (e) { flashKey(key ?? null, "✕ NOT SENT"); say(e === "too-fast" ? "Too fast. One message every few seconds" : "Couldn't send it. Try again", "err"); return false; }
  flashKey(key ?? null, "SENT TO COMMS ✓"); say("Sent to COMMS · ALL: everyone sees it as a card"); return true;
}

/** the player's share key: a small menu over it, for the track on air */
export function initShareKey() {
  const key = $("pShare"), pop = $("sharePop");
  const close = () => { pop.hidden = true; key.setAttribute("aria-expanded", "false"); };
  key.onclick = (e) => { e.stopPropagation(); const open = pop.hidden; pop.hidden = !open; key.setAttribute("aria-expanded", String(open)); if (open) pop.querySelector<HTMLElement>("button")?.focus(); };
  pop.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>("[data-share]"); const np = state.nowPlaying;
    if (!b || !np) return;
    // the menu stays a moment so its key can say how it went
    shareTrack(np, b.dataset.share as "copy" | "send", b).then(() => setTimeout(close, 1300));
  });
  addEventListener("pointerdown", (e) => { if (!pop.hidden && !pop.contains(e.target as Node) && e.target !== key && !key.contains(e.target as Node)) close(); });
  pop.addEventListener("keydown", (e) => { if (e.key === "Escape") { e.stopPropagation(); close(); key.focus(); } });
}
