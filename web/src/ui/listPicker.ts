// The list picker: a small menu to put a track in your playlists (or take it out), and to start a new one.
// Opened from the dossier's LISTS key, the player's list key, a beacon's ＋ in BEACONS, or Shift+L.
// Lists are apart from the beacons: putting a track in a list doesn't set its beacon. It never covers
// the video: it opens where the player's picture isn't.
import { $, uiZoom } from "../core/dom";
import { esc } from "../core/util";
import type { TrackRef } from "../core/types";
import { beacons, galaxy } from "../app/state";
import { type Beacon, MAX_LISTS } from "../store/beacons";

let pop: HTMLElement | null = null, anchor: HTMLElement | null = null;
let cur: Beacon | null = null;

const box = (r: DOMRect, o: { left: number; top: number; w: number; h: number }) =>
  !(o.left + o.w <= r.left || o.left >= r.right || o.top + o.h <= r.top || o.top >= r.bottom);

function paint() {
  if (!pop || !cur) return;
  const y = cur.y, full = beacons.lists.length >= MAX_LISTS;
  pop.innerHTML = `<div class="lp-h">ADD TO A LIST<button type="button" class="m-x" data-lpx aria-label="Close">×</button></div>
    <div class="lp-l">${beacons.lists.length ? beacons.lists.map((l) => {
      const inL = l.items.some((b) => b.y === y);
      return `<button type="button" class="lp-i${inL ? " on" : ""}" data-pl="${esc(l.id)}" role="menuitemcheckbox" aria-checked="${inL}"><b>${inL ? "■" : "□"}</b><span>${esc(l.name.toUpperCase())}</span><i>${l.items.length}</i></button>`;
    }).join("") : `<p class="note">NO LISTS YET. NAME ONE BELOW: “NIGHT DRIVE”, “WARM-UP”…</p>`}</div>
    ${full ? `<p class="note">${MAX_LISTS} LISTS IS THE MOST.</p>` : `<form class="lp-n"><input maxlength="32" placeholder="NEW LIST…" aria-label="New list name"><button type="submit" class="key sm">＋ ADD</button></form>`}`;
}

function place() {
  if (!pop || !anchor) return;
  const a = anchor.getBoundingClientRect(), p = pop.getBoundingClientRect(), z = uiZoom(pop) || 1;
  const W = innerWidth, H = innerHeight, m = 6, w = p.width, h = p.height;
  const vw = $("videoWrap"), dock = $("playerBox");
  const video = vw && !dock.hidden ? vw.getBoundingClientRect() : null, dk = video ? dock.getBoundingClientRect() : null;
  const clampX = (x: number) => Math.max(m, Math.min(W - w - m, x)), clampY = (y: number) => Math.max(m, Math.min(H - h - m, y));
  const tries = [
    { left: clampX(a.left), top: a.top - h - 4 },                 // above the key
    { left: clampX(a.left), top: a.bottom + 4 },                  // below it
    ...(dk ? [{ left: dk.left - w - 6, top: clampY(a.top - h / 2) }, { left: dk.right + 6, top: clampY(a.top - h / 2) }] : []), // beside the player
    { left: clampX(a.left), top: clampY(a.bottom + 4) },
  ];
  const fits = (o: { left: number; top: number }) => o.left >= 0 && o.top >= 0 && o.left + w <= W && o.top + h <= H && !(video && box(video, { ...o, w, h }));
  const o = tries.find(fits) ?? tries[tries.length - 1];
  pop.style.left = `${o.left / z}px`; pop.style.top = `${o.top / z}px`;
}

export function closeListPicker() {
  pop?.remove(); pop = null; anchor?.setAttribute("aria-expanded", "false"); anchor = null; cur = null;
}

/** open the picker for a track */
export function openListPicker(at: HTMLElement, item: Beacon) {
  if (pop && anchor === at) { closeListPicker(); return; }
  closeListPicker();
  anchor = at; cur = item; at.setAttribute("aria-expanded", "true");
  pop = document.createElement("div"); pop.className = "list-pop"; pop.setAttribute("role", "menu");
  pop.style.left = "-9999px"; pop.style.top = "0";
  document.body.appendChild(pop); paint(); place();
  pop.addEventListener("click", (e) => {
    const t = e.target as HTMLElement;
    if (t.closest("[data-lpx]")) { closeListPicker(); return; }
    const b = t.closest<HTMLElement>("[data-pl]"); if (!b || !cur) return;
    beacons.toggleIn(b.dataset.pl!, cur);
  });
  pop.addEventListener("submit", (e) => {
    e.preventDefault(); if (!cur || !pop) return;
    const inp = pop.querySelector<HTMLInputElement>(".lp-n input")!, id = beacons.createList(inp.value);
    if (!id) { inp.focus(); return; }
    beacons.toggleIn(id, cur);
    pop.querySelector<HTMLInputElement>(".lp-n input")?.focus();
  });
}

/** the picker for a track on the map (the one on air, or in the dossier) */
export function listPickerFor(at: HTMLElement, r: TrackRef | null) {
  const item = r && beacons.item(r, galaxy.stars[r.s]?.name); if (item) openListPicker(at, item);
}

export function initListPicker() {
  beacons.changed.on(() => { if (pop) { const f = !!pop.querySelector(".lp-n input:focus"); paint(); place(); if (f) pop.querySelector<HTMLInputElement>(".lp-n input")?.focus(); } });
  addEventListener("pointerdown", (e) => { if (pop && !pop.contains(e.target as Node) && !anchor?.contains(e.target as Node)) closeListPicker(); }, true);
  addEventListener("keydown", (e) => { if (pop && e.key === "Escape") { e.stopImmediatePropagation(); closeListPicker(); } }, true);
  addEventListener("resize", () => closeListPicker());
}
