// The panel under the dossier: FLIGHT LOG and BEACONS tabs.
import { esc, pad } from "../core/util";
import { $ } from "../core/dom";
import { beacons, chunk, flightLog, galaxy, tracks } from "../app/state";
import { type Beacon, MAX_LISTS } from "../store/beacons";
import { openListPicker } from "./listPicker";
import { saveToYouTube, youtubeReady } from "../cloud/youtube";
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
// The log on screen is this visit's: it starts empty each time the page opens (what was played before
// still counts towards the flights total and the ranks).
const visitStart = Date.now();
let logRefs: ReturnType<typeof flightLog.refs> = [];
export function renderLog() {
  const el = $("log"); logRefs = flightLog.refs().filter((r) => r.t >= visitStart);
  el.innerHTML = logRefs.length
    ? logRefs.map((r, k) => {
      // older entries saved no title: use it if their star happens to be loaded already
      const d = new Date(r.t), sn = galaxy.starIndex(r.st), s = sn >= 0 ? sn : r.s, ch = r.ti ? null : chunk(s);
      const i = !ch ? -1 : r.y ? ch.yt.indexOf(r.y) : r.b === galaxy.meta.build && r.i < ch.t.length ? r.i : -1;
      const title = r.ti ?? (i >= 0 ? ch!.t[i] : "Signal"), artist = r.ar ?? (i >= 0 ? ch!.an[ch!.a[i]] : ""), style = r.st ?? galaxy.stars[r.s]?.name ?? "";
      return `<button data-log="${k}"><time>${pad(d.getHours(), 2)}:${pad(d.getMinutes(), 2)}</time><span title="${esc(artist ? `${artist} — ${title}` : title)}">▸ ${esc(title)} · ${esc(style.toUpperCase())}</span></button>`;
    }).join("")
    : `<p class="note">NOTHING PLAYED ON THIS FLIGHT YET. SIGNALS YOU PLAY WILL SHOW UP HERE.</p>`;
}

// BEACONS: every track you set a beacon on, and your lists of them. The chips switch between the beacons and
// a list. A list is its own thing: tracks go in through the list key, and stay when a beacon is removed.
let saving = "", saveNote = "", saveMsg = "";
async function saveList(id: string) {
  saving = id; saveNote = "CONNECTING TO YOUTUBE…"; saveMsg = ""; renderBeacons();
  const r = await saveToYouTube(id, (d, n) => { saveNote = `SAVING TO YOUTUBE · ${d}/${n}…`; renderBeacons(); });
  saving = "";
  saveMsg = r.ok ? (r.added ? `Saved: ${r.added} ${r.added === 1 ? "track" : "tracks"} added to your YouTube playlist.` : "Your YouTube playlist is up to date.")
    : r.why === "denied" ? "YouTube wasn't connected (the Google window was closed or said no)."
    : r.why === "quota" ? `YouTube's limit for today is used up${r.added ? ` after ${r.added} tracks` : ""}. The rest can be added tomorrow.`
    : r.why === "nochannel" ? "Your Google account has no YouTube channel yet: make one on YouTube, then try again."
    : "Something went wrong with YouTube. Try again.";
  renderBeacons();
}
let shown: Beacon[] = [], edit: "" | "new" | "rename" | "delete" = "";
export function renderBeacons() {
  drawBeacons();
  if (edit === "new" || edit === "rename") { const i = $("liked").querySelector<HTMLInputElement>(".bl-name input"); if (i && document.activeElement !== i) { i.focus(); i.select(); } }
}
function drawBeacons() {
  const el = $("liked");
  $("likedN").textContent = String(beacons.size);
  if (el.hidden) return;
  const cur = beacons.current, list = beacons.getList(cur);
  const chip = (id: string, name: string, n: number) => `<button type="button" class="bl-c${id === cur ? " on" : ""}" data-bl="${esc(id)}" aria-pressed="${id === cur}">${esc(name.toUpperCase())} <b>${n}</b></button>`;
  const naming = edit === "new" || edit === "rename";
  const chips = `<div class="bl-tabs" role="toolbar" aria-label="Lists">${chip("", "♥ BEACONS", beacons.size)}${beacons.lists.map((l) => chip(l.id, l.name, beacons.of(l.id).length)).join("")}` +
    (naming ? "" : beacons.lists.length < MAX_LISTS ? `<button type="button" class="bl-c add" data-blnew title="Start a new list">＋ NEW LIST</button>` : "") + `</div>` +
    (naming ? `<form class="bl-name"><input maxlength="32" value="${edit === "rename" && list ? esc(list.name) : ""}" placeholder="${edit === "new" ? "NAME THE LIST: NIGHT DRIVE, WARM-UP…" : "NEW NAME"}" aria-label="List name"><button type="submit" class="key sm">${edit === "new" ? "CREATE" : "RENAME"}</button><button type="button" class="key sm" data-blcancel>CANCEL</button></form>` : "") +
    (list && !naming ? `<div class="bl-bar"><span>LIST · ${list?.items.length ?? 0} ${list?.items.length === 1 ? "TRACK" : "TRACKS"}</span>${edit === "delete"
      ? `<button type="button" class="link warn" data-bldel>DELETE “${esc(list.name.toUpperCase())}”? YES</button><button type="button" class="link" data-blcancel>NO</button>`
      : `<button type="button" class="link" data-blren>✎ RENAME</button><button type="button" class="link" data-bldel>× DELETE LIST</button>`}</div>` : "");
  shown = beacons.of(cur);
  if (!cur && !beacons.size) { el.innerHTML = chips + `<p class="note">NO BEACONS YET. SET ONE ON A TRACK YOU LOVE: THE BEACON KEY OR <kbd>L</kbd>. <kbd>⇧L</kbd> PUTS IT IN A LIST.</p>`; return; }
  if (!shown.length) { el.innerHTML = chips + `<p class="note">THIS LIST IS EMPTY. ADD TRACKS WITH THE LIST KEY ≡ IN THE PLAYER, “ADD TO LIST” ON A TRACK, OR <kbd>⇧L</kbd>.</p>`; return; }
  let links: string;
  if (list && youtubeReady()) {
    // a real playlist in the pilot's own YouTube
    const fresh = list.items.filter((b) => !(list.sent ?? []).includes(b.y)).length, busy = saving === list.id;
    links = (list.yt ? `<a class="ytlist" href="https://www.youtube.com/playlist?list=${esc(list.yt)}" target="_blank" rel="noopener">▶ OPEN “${esc(list.name.toUpperCase())}” ON YOUTUBE ↗</a>` : "") +
      (busy ? `<button type="button" class="ytlist" disabled>${esc(saveNote)}</button>`
        : !list.yt ? `<button type="button" class="ytlist" data-ytsave>⇪ SAVE TO MY YOUTUBE AS A PLAYLIST</button>`
        : fresh ? `<button type="button" class="ytlist" data-ytsave>⇪ ADD ${fresh} NEW ${fresh === 1 ? "TRACK" : "TRACKS"} TO THE YOUTUBE PLAYLIST</button>` : "") +
      `<p class="note ythint">${saveMsg ? esc(saveMsg) : list.yt ? "A private playlist in your YouTube. Tracks taken out here stay there." : "Makes a private playlist in your own YouTube account (Google asks once)."}</p>`;
  } else {
    const parts = beacons.playlistLinks(cur);
    links = parts.map((href, k) => `<a class="ytlist" href="${href}" target="_blank" rel="noopener">▶ PLAY ${list ? `“${esc(list.name.toUpperCase())}”` : "YOUR BEACONS"} ON YOUTUBE${parts.length > 1 ? ` · PART ${k + 1}/${parts.length}` : ""} ↗</a>`).join("") +
      `<p class="note ythint">${list ? "Opens on YouTube as a quick, temporary list." : "A quick, temporary list on YouTube. To keep one, make a list and save it to your YouTube."}</p>`;
  }
  el.innerHTML = chips + links +
    shown.map((b, k) => {
      const style = b.st ?? galaxy.stars[b.s]?.name ?? "", n = beacons.listsWith(b.y);
      return `<div class="lk"><button data-bk="${k}"><time>${pad(k + 1, 2)}</time><span title="${esc(`${b.a ?? ""} — ${b.t ?? ""}`)}">▸ ${esc(b.a ?? "")} — ${esc(b.t ?? "")}${style ? ` · ${esc(style.toUpperCase())}` : ""}</span></button>` +
        `<button class="unlike addl${n ? " on" : ""}" data-lp="${esc(b.y)}" aria-haspopup="true" aria-label="Lists" title="${n ? `In ${n} ${n === 1 ? "list" : "lists"}. ` : ""}Put it in a list">${n ? "■" : "＋"}</button>` +
        `<button class="unlike" data-y="${esc(b.y)}" aria-label="${list ? "Take out of this list" : "Remove beacon"}" title="${list ? "Take out of this list" : "Remove the beacon (your lists keep it)"}">×</button></div>`;
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
    const t = e.target as HTMLElement, cur = beacons.current;
    const c = t.closest<HTMLElement>("[data-bl]"); if (c) { edit = ""; saveMsg = ""; beacons.setCurrent(c.dataset.bl!); return; }
    if (t.closest("[data-blnew]")) { edit = "new"; renderBeacons(); return; }
    if (t.closest("[data-blren]")) { edit = "rename"; renderBeacons(); return; }
    if (t.closest("[data-blcancel]")) { edit = ""; renderBeacons(); return; }
    if (t.closest("[data-bldel]")) { if (edit === "delete") { edit = ""; beacons.deleteList(cur); } else { edit = "delete"; renderBeacons(); } return; }
    if (t.closest("[data-ytsave]")) { if (cur && !saving) saveList(cur); return; }
    const lp = t.closest<HTMLElement>("[data-lp]"), it = lp && shown.find((b) => b.y === lp.dataset.lp); if (lp && it) { openListPicker(lp, it); return; }
    const u = t.closest<HTMLElement>("[data-y]");
    if (u) { const it = shown.find((b) => b.y === u.dataset.y); if (cur) { if (it) beacons.toggleIn(cur, it); } else beacons.remove(u.dataset.y!); return; }
    const b = (e.target as HTMLElement).closest<HTMLElement>("[data-bk]"), bk = b && beacons.all[+b.dataset.bk!];
    if (bk) go({ s: bk.s, i: bk.i, y: bk.y, st: bk.st }, b!);
  });
  $("liked").addEventListener("submit", (e) => {
    e.preventDefault();
    const v = (e.target as HTMLElement).querySelector<HTMLInputElement>("input")?.value ?? "";
    if (edit === "new") { const id = beacons.createList(v); if (!id) return; edit = ""; beacons.setCurrent(id); }
    else if (edit === "rename") { if (!v.trim()) return; edit = ""; beacons.renameList(beacons.current, v); }
  });
  $("liked").addEventListener("keydown", (e) => { if (e.key === "Escape" && edit) { e.stopPropagation(); edit = ""; renderBeacons(); } });
  $("tabLog").onclick = () => showTab("log");
  $("tabLiked").onclick = () => showTab("liked");
  $("tabComms").onclick = () => showTab("comms");
}
