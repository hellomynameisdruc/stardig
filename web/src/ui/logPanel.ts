// The panel under the dossier: FLIGHT LOG and BEACONS tabs.
import { esc, pad } from "../core/util";
import { $ } from "../core/dom";
import { beacons, chunk, flightLog, galaxy, tracks } from "../app/state";
import { select } from "../app/actions";
import { locateYt } from "../app/vault";
import { openComms } from "./comms";

/** a saved entry's place on the current map: by YouTube id within its star (found by name), or by its
 * saved numbers if the map hasn't been rebuilt since; null if it can't be found */
async function locate(e: { s: number; i: number; b?: string; y?: string; st?: string }): Promise<{ s: number; i: number } | null> {
  const { stars, meta } = galaxy;
  if (e.y) {
    const byName = galaxy.starIndex(e.st), s = byName >= 0 ? byName : e.s;
    if (s >= stars.length) return null;
    const i = await locateYt(s, e.y, e.i).catch(() => -1); // the vault too
    return i >= 0 ? { s, i } : null;
  }
  if (e.b !== meta.build || e.s >= stars.length) return null; // numbers from another build of the map
  const ch = await tracks.load(e.s).catch(() => null);
  return ch && e.i < ch.yt.length ? { s: e.s, i: e.i } : null;
}

// The log and the beacons are drawn from what they saved (title, artist, style), never by loading the
// stars' track files: a long log across many styles would load them all, freezing the page and filling
// memory. A track is found on the map only when it's clicked.
let logRefs: ReturnType<typeof flightLog.refs> = [];
export function renderLog() {
  const el = $("log"); logRefs = flightLog.refs();
  el.innerHTML = logRefs.length
    ? logRefs.map((r, k) => {
      // older entries saved no title: use it if their star happens to be loaded already
      const d = new Date(r.t), sn = galaxy.starIndex(r.st), s = sn >= 0 ? sn : r.s, ch = r.ti ? null : chunk(s);
      const i = !ch ? -1 : r.y ? ch.yt.indexOf(r.y) : r.b === galaxy.meta.build && r.i < ch.t.length ? r.i : -1;
      const title = r.ti ?? (i >= 0 ? ch!.t[i] : "Signal"), artist = r.ar ?? (i >= 0 ? ch!.an[ch!.a[i]] : ""), style = r.st ?? galaxy.stars[r.s]?.name ?? "";
      return `<button data-log="${k}"><time>${pad(d.getHours(), 2)}:${pad(d.getMinutes(), 2)}</time><span title="${esc(artist ? `${artist} — ${title}` : title)}">▸ ${esc(title)} · ${esc(style.toUpperCase())}</span></button>`;
    }).join("")
    : `<p class="note">NO ENTRIES YET. SIGNALS YOU PLAY WILL SHOW UP HERE.</p>`;
}

export function renderBeacons() {
  const el = $("liked");
  $("likedN").textContent = String(beacons.size);
  if (el.hidden) return;
  if (!beacons.size) { el.innerHTML = `<p class="note">NO BEACONS YET. SET ONE ON A TRACK YOU LOVE: THE BEACON KEY OR <kbd>L</kbd>.</p>`; return; }
  const parts = beacons.playlistLinks();
  const links = parts.map((href, k) => `<a class="ytlist" href="${href}" target="_blank" rel="noopener">▶ OPEN AS YOUTUBE PLAYLIST${parts.length > 1 ? ` · PART ${k + 1}/${parts.length}` : ""} ↗</a>`).join("");
  el.innerHTML = links + `<p class="note ythint">Opens on YouTube; use “Save” there to keep it in your library.</p>` +
    beacons.all.map((b, k) => {
      const style = b.st ?? galaxy.stars[b.s]?.name ?? "";
      return `<div class="lk"><button data-bk="${k}"><time>${pad(k + 1, 2)}</time><span title="${esc(`${b.a ?? ""} — ${b.t ?? ""}`)}">▸ ${esc(b.a ?? "")} — ${esc(b.t ?? "")}${style ? ` · ${esc(style.toUpperCase())}` : ""}</span></button><button class="unlike" data-y="${esc(b.y)}" aria-label="Remove beacon">×</button></div>`;
    }).join("");
}

/** fly to a saved track and play it (found now: by id in its star, or from the vault) */
async function go(e: { s: number; i: number; b?: string; y?: string; st?: string }, key: HTMLElement) {
  key.classList.add("busy");
  const r = await locate(e); key.classList.remove("busy");
  if (r) select({ kind: "track", ...r }, true, true); else { key.setAttribute("disabled", ""); key.title = "Not on the map any more"; }
}

type Tab = "log" | "liked" | "comms";
function showTab(tab: Tab) {
  $("log").hidden = tab !== "log"; $("liked").hidden = tab !== "liked"; $("comms").hidden = tab !== "comms";
  ($("log").parentElement as HTMLElement).hidden = tab === "comms";
  $("tabLog").setAttribute("aria-selected", String(tab === "log")); $("tabLiked").setAttribute("aria-selected", String(tab === "liked"));
  $("tabComms").setAttribute("aria-selected", String(tab === "comms"));
  if (tab === "liked") renderBeacons();
  if (tab === "comms") openComms();
}

/** the grip between the dossier and this panel: drag to share the height out; remembered in this browser */
function initGrip() {
  const grip = $("logGrip"), panel = grip.parentElement as HTMLElement, side = panel.parentElement as HTMLElement, KEY = "kosmos-logp-h";
  const set = (px: number | null) => {
    if (px === null) { panel.style.removeProperty("--logp-h"); try { localStorage.removeItem(KEY); } catch { /* */ } return; }
    const max = side.clientHeight - 220, h = Math.max(150, Math.min(max, px)); // the dossier keeps room for its keys
    panel.style.setProperty("--logp-h", `${h}px`);
    try { localStorage.setItem(KEY, String(Math.round(h))); } catch { /* storage unavailable */ }
  };
  try { const v = Number(localStorage.getItem(KEY)); if (v) panel.style.setProperty("--logp-h", `${v}px`); } catch { /* */ }
  grip.addEventListener("pointerdown", (e) => {
    e.preventDefault(); grip.setPointerCapture(e.pointerId); grip.classList.add("on");
    const y0 = e.clientY, h0 = panel.getBoundingClientRect().height, z = panel.getBoundingClientRect().height / (panel.offsetHeight || 1);
    const move = (ev: PointerEvent) => set(h0 / z + (y0 - ev.clientY) / z);
    const up = () => { grip.classList.remove("on"); grip.removeEventListener("pointermove", move); grip.removeEventListener("pointerup", up); };
    grip.addEventListener("pointermove", move); grip.addEventListener("pointerup", up);
  });
  grip.addEventListener("dblclick", () => set(null));
}

export function initLogPanel() {
  initGrip();
  $("log").addEventListener("click", (e) => { const b = (e.target as HTMLElement).closest<HTMLElement>("[data-log]"); const r = b && logRefs[+b.dataset.log!]; if (r) go(r, b!); });
  $("liked").addEventListener("click", (e) => {
    const u = (e.target as HTMLElement).closest<HTMLElement>("[data-y]");
    if (u) { beacons.remove(u.dataset.y!); return; }
    const b = (e.target as HTMLElement).closest<HTMLElement>("[data-bk]"), bk = b && beacons.all[+b.dataset.bk!];
    if (bk) go({ s: bk.s, i: bk.i, y: bk.y, st: bk.st }, b!);
  });
  $("tabLog").onclick = () => showTab("log");
  $("tabLiked").onclick = () => showTab("liked");
  $("tabComms").onclick = () => showTab("comms");
}
