// The command line: search styles, labels and artists.
import { esc } from "../core/util";
import { $ } from "../core/dom";
import { galaxy, tracks } from "../app/state";
import { dataUrl, loadArtists } from "../data/loader";
import { adopt } from "../app/vault";
import { flyToNebula, select } from "../app/actions";

type Hit = { label: string; kind: string; color?: string; go: () => void };
let q: HTMLInputElement, res: HTMLElement;
let artists: [string, number, number][] | null = null;
let hits: Hit[] = [], cur = 0;
// artists who are only in the vault (off the map), one file per first letter, fetched as typed
const vaultArtists = new Map<string, [string, number, number][] | null>();
const letterOf = (name: string) => { for (const c of name.toLowerCase()) if (/[\p{L}\p{N}]/u.test(c)) return /[a-z0-9]/.test(c) ? c : "_"; return "_"; };
function vaultShelf(c: string, then: () => void) {
  if (vaultArtists.has(c) || !galaxy.meta.vault) return vaultArtists.get(c) ?? null;
  vaultArtists.set(c, null);
  fetch(dataUrl(`vault/artists/${c}.json`)).then((r) => (r.ok ? r.json() : [])).then((rows) => { vaultArtists.set(c, rows); then(); }).catch(() => {});
  return null;
}

function choose(i: number) { hits[i]?.go(); res.hidden = true; q.value = ""; q.blur(); }
export const searchInput = () => q;
export function closeSearch() { q.blur(); res.hidden = true; }

export function initSearch() {
  q = $<HTMLInputElement>("q"); res = $("results");
  if (matchMedia("(max-width: 600px)").matches) q.setAttribute("placeholder", "search…");
  q.addEventListener("focus", () => { if (!artists) loadArtists().then((a) => { artists = a; }); }, { once: true });
  q.addEventListener("input", () => {
    const s = q.value.trim().toLowerCase(), { stars, planets } = galaxy;
    if (s.length < 2) { res.hidden = true; return; }
    hits = [];
    galaxy.nebulae.forEach((n, k) => { if (n.name.toLowerCase().includes(s)) hits.push({ label: n.name, kind: "GALAXY", color: n.color, go: () => flyToNebula(k) }); });
    stars.forEach((st, i) => { if (st.name.toLowerCase().includes(s)) hits.push({ label: st.name, kind: "STAR", color: st.color, go: () => select({ kind: "star", s: i }) }); });
    for (let i = 0; i < planets.length && hits.length < 14; i++) if (planets[i].name.toLowerCase().includes(s)) hits.push({ label: planets[i].name, kind: "PLANET", color: stars[planets[i].s].color, go: () => select({ kind: "planet", p: i }) });
    if (artists) for (let i = 0; i < artists.length && hits.length < 24; i++) {
      const [name, st, ti] = artists[i];
      if (name.toLowerCase().includes(s)) hits.push({ label: name, kind: "ARTIST", go: () => tracks.load(st).then(() => select({ kind: "track", s: st, i: ti })) });
    }
    const shelf = vaultShelf(letterOf(s), () => q.dispatchEvent(new Event("input")));
    if (shelf) for (let i = 0; i < shelf.length && hits.length < 30; i++) {
      const [name, st, k] = shelf[i];
      if (name.toLowerCase().includes(s)) hits.push({ label: name, kind: "ARTIST · VAULT", go: () => adopt(st, k).then((ti) => select({ kind: "track", s: st, i: ti })) });
    }
    cur = 0; res.hidden = false;
    res.innerHTML = hits.length ? hits.map((h, i) => `<button data-h="${i}" class="${i === 0 ? "on" : ""}"><span class="k">${h.kind}</span>${h.color ? `<i class="sw" style="background:${h.color}"></i>` : ""}<span>${esc(h.label)}</span></button>`).join("") : `<p class="note" style="padding:8px 10px">NOTHING FOUND.</p>`;
  });
  q.addEventListener("keydown", (e) => {
    if (res.hidden || !hits.length) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); cur = (cur + (e.key === "ArrowDown" ? 1 : -1) + hits.length) % hits.length; [...res.children].forEach((b, i) => b.classList.toggle("on", i === cur)); }
    if (e.key === "Enter") choose(cur);
  });
  res.addEventListener("click", (e) => { const b = (e.target as HTMLElement).closest<HTMLElement>("[data-h]"); if (b) choose(+b.dataset.h!); });
}
