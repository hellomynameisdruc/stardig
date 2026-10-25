// The closed beta on screen: a line on the rail while this visitor has no access, the message when a
// locked track is tried, and the dossier's play keys swapped for GET ACCESS outside the open galaxy.
import { beta, openName, starOpen } from "../app/beta";
import { galaxy, state } from "../app/state";
import { provide, ui } from "../app/ports";
import { onPilot, pilot } from "../cloud/pilots";
import { openPilot } from "./pilot";
import { clearMode, say, setMode } from "./rail";

function paint() {
  const me = pilot.me, was = beta.open;
  beta.open = !!(me && (me.access || me.admin));
  if (beta.open || !beta.on) clearMode("beta");
  else setMode("beta", `<b>CLOSED BETA</b> · ${openName().toUpperCase()} IS OPEN TO ALL${me ? " · WAITING FOR ACCESS" : ""}`, [{ label: me ? "ENTER INVITE" : "GET ACCESS", run: () => openPilot() }]);
  if (was !== beta.open) ui.showSelection(0); // the dossier's keys open up (or lock)
}

/** the selected object's star, for the dossier */
const selStar = () => { const o = state.sel; return !o ? -1 : o.kind === "planet" ? galaxy.planets[o.p].s : o.s; };

/** outside the open galaxy, the dossier's play keys become one GET ACCESS key */
export function lockDossier(d: HTMLElement) {
  const s = selStar(); if (s < 0 || starOpen(s)) return;
  const keys = d.querySelectorAll<HTMLElement>("[data-play], [data-orbit], [data-system], [data-dig], [data-years]");
  if (!keys.length) return;
  keys[0].insertAdjacentHTML("beforebegin", `<button class="play beta-lock" data-beta="1" title="The closed beta: ${openName()} is open to everyone; the rest of the map needs access">⊘ CLOSED BETA · GET ACCESS</button>`);
  keys.forEach((k) => k.remove());
}

export function initBeta() {
  provide({
    locked: () => { say(`Closed beta: only ${openName()} is open. Sign in and ask for access, or enter an invite`, "err"); openPilot(); },
  });
  document.getElementById("detail")!.addEventListener("click", (e) => { if ((e.target as HTMLElement).closest("[data-beta]")) openPilot(); });
  onPilot(paint);
  paint();
}
