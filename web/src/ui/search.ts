// The command line: search galaxies, styles, labels, artists and track titles. Titles (on the map and in
// the vault) are in small files by their first letters (search/), fetched only while someone types.
import { esc } from "../core/util";
import { $ } from "../core/dom";
import { galaxy, tracks } from "../app/state";
import { dataUrl, loadArtists } from "../data/loader";
import { adopt } from "../app/vault";
import { normT, titleKey, titleShelf } from "../data/titles";
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

// —— track titles (data/titles.ts)
function trackHits(s: string, room: number, then: () => void): Hit[] {
  const key = titleKey(s, then); if (key === null) return [];
  if (key === "") return [{ label: "keep typing to find tracks by title…", kind: "TRACK", go: () => undefined }];
  const sh = titleShelf(key, then); if (!sh) return [];
  // the closest titles first: an exact one, then the shortest that start with what's typed
  const n = normT(s), raw = s.toLowerCase(), got: number[] = [], out: Hit[] = [];
  for (let j = 0; j < sh.t.length && got.length < 400; j++) if (key === "_" ? sh.t[j].toLowerCase().includes(raw) : sh.norm[j].startsWith(n)) got.push(j);
  got.sort((x, y) => sh.norm[x].length - sh.norm[y].length);
  for (const j of got.slice(0, room)) {
    const st = sh.s[j], i = sh.i[j], star = galaxy.stars[st];
    out.push({ label: `${sh.t[j]} — ${sh.n[sh.a[j]]}`, kind: i < 0 ? "TRACK · VAULT" : "TRACK", color: star?.color,
      go: () => (i >= 0 ? tracks.load(st).then(() => select({ kind: "track", s: st, i }, true, true)) : adopt(st, -1 - i).then((ti) => select({ kind: "track", s: st, i: ti }, true, true))) });
  }
  return out;
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
    const again = () => q.dispatchEvent(new Event("input"));
    hits.push(...trackHits(s, 10, again));
    if (artists) for (let i = 0; i < artists.length && hits.length < 30; i++) {
      const [name, st, ti] = artists[i];
      if (name.toLowerCase().includes(s)) hits.push({ label: name, kind: "ARTIST", go: () => tracks.load(st).then(() => select({ kind: "track", s: st, i: ti })) });
    }
    const shelf = vaultShelf(letterOf(s), again);
    if (shelf) for (let i = 0; i < shelf.length && hits.length < 36; i++) {
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
