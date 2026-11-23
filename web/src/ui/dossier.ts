// The dossier panel on the right: sector overview, star, planet or track, each with its own scope.
import type { PType, Sel } from "../core/types";
import { esc, fmt, hash, pad } from "../core/util";
import { $, reduce } from "../core/dom";
import { beacons, chunk, galaxy, isNowPlaying, ore, state, tracks } from "../app/state";
import { PTYPE_INFO, spanOf } from "../model/galaxy";
import { tempoLabel } from "../model/tempo";
import { beltSize, digBelt, reshuffle, satelliteOrder, flyToNebula, nearestTracks, playLightYears, playOrbit, playSystem, select, startPick, toggleBeacon, trackCode } from "../app/actions";
import { BG, sc } from "../render/palette";
import { drawPlanetBody } from "../render/planets";
import { onFrame } from "../render/scene";
import { drawPulsarHero, drawRadar, drawSphere, drawWave, fitCanvas, fitted } from "./scopes";
import { ICON, player, scrub } from "./dock";
import { decodeDossier, scramble } from "./glitch";
import { shareTrack } from "./share";
import { provide } from "../app/ports";
import { say } from "./rail";
import { lockDossier } from "./beta";
import { listPickerFor } from "./listPicker";
import { loadSetCounts, loadStarSets, setCountsNow, setsNow, type SetRec } from "../data/sets";
import { hms, onMap, playSet } from "./sets";

let dosAnim: ((t: number) => void) | null = null;
/** objects behind data-r buttons of the current render */
const refs: Sel[] = [];
const R = (o: Sel) => { refs.push(o); return refs.length - 1; };
/** a fact: label over value; a long value takes the whole width */
const row = (k: string, v: string) => `<div class="row${v.replace(/<[^>]*>/g, "").length > 20 ? " wide" : ""}"><span>${k}</span><span>${v}</span></div>`;
const meter = (k: string, frac: number, val: string, ref?: number, color?: string) =>
  `<div class="bar-r${ref !== undefined ? " click" : ""}"${ref !== undefined ? ` data-r="${ref}"` : ""}${color ? ` style="--c:${color}"` : ""}><span>${esc(k)}</span><span class="meter"><i style="width:${Math.max(2, Math.min(100, frac * 100)).toFixed(1)}%"></i></span><span>${val}</span></div>`;
const heroCanvas = () => document.querySelector<HTMLCanvasElement>("#hero canvas");
const hist = (cnt: number[], y0: number, title: string) => {
  const mx = Math.max(1, ...cnt), y1 = y0 + cnt.length - 1;
  return `<div class="hist"><div class="ph-sub">${title}</div><div class="cols">${cnt.map((c, k) => `<i style="height:${(c / mx * 100).toFixed(1)}%" title="${y0 + k}: ${c}"></i>`).join("")}</div><div class="axis"><span>${y0}</span><span>${y0 + Math.round((y1 - y0) / 2)}</span><span>${y1}</span></div></div>`;
};
/** the same beacon mark as on the player's key */
const beaconLabel = (on: boolean) => (on ? `${ICON.beaconOn}<span>BEACON ON</span>` : `${ICON.beacon}<span>SET BEACON</span>`);

function sector() {
  const { stars, planets, meta, ptype } = galaxy;
  const top = stars.map((s, i) => ({ s, i })).sort((a, b) => b.s.tracks - a.s.tracks);
  const mx = top[0]?.s.tracks || 1;
  dosAnim = (t) => { const c = heroCanvas(); if (c) { const f = fitted(c); drawRadar(f.g, f.w, f.h, t); } };
  const neb = galaxy.nebulae, many = neb.length > 1;
  const gm = Math.max(1, ...neb.map((n) => n.tracks));
  return {
    code: many ? `UNIVERSE // ${meta.sector.toUpperCase()}` : `SECTOR // ${meta.sector.toUpperCase()}`,
    title: many ? `${meta.sector.toUpperCase()} UNIVERSE` : `SECTOR ${meta.sector.toUpperCase()}`,
    html: `<div class="hero"><div class="frame" id="hero"><canvas></canvas></div>
        <div class="ident"><span class="code">OBSERVATORY // DISCOGS ${meta.years ? `${meta.years[0]}–${meta.years[1]}` : ""}</span><h2 id="dosTitle"></h2><span class="stamp">${meta.sample ? "TEST SIGNAL" : "LIVE CATALOGUE"}</span></div></div>
      <div class="rows">${many ? row("GALAXIES / GENRES", fmt(neb.length)) : ""}${row("STARS / STYLES", fmt(stars.length))}${row("PLANETS / LABELS", fmt(planets.length))}${row("SATELLITES / TRACKS", fmt(meta.tracks))}${row("RELEASES", fmt(meta.releases))}${row("SOURCE", "DISCOGS · CC0")}</div>
      <p class="lede">${many ? `A map of electronic music from the Discogs catalogue. <b>Galaxies</b> are ${neb.length} families of genres. ` : ""}Every <b>star</b> is a style, its orbits hold <b>label planets</b>, and the <b>satellites</b> around them are tracks, older ones closer in. ${many ? "Galaxies that share many releases sit side by side, and so do styles that often meet on one release." : "Styles that often meet on one release sit side by side."}</p>
      ${many ? `<div class="bars"><div class="ph-sub">GALAXIES // TRACKS · CLICK TO FLY THERE</div>${neb.map((n, k) => meter(`${n.name.toUpperCase()} ${n.stars}★`, n.tracks / gm, fmt(n.tracks), undefined, n.color).replace('class="bar-r"', `class="bar-r gal click" data-neb="${k}"`)).join("")}</div>` : ""}
      <div><div class="ph-sub">HOW TO EXPLORE</div><ul class="howto">
        <li><b>Zoom</b> in: ${many ? "galaxies → " : ""}styles → labels → tracks → titles.</li>
        <li><b>Click</b> a star, planet or track to open its dossier.</li>
        <li><b>Time warp</b> on a planet: the label's story in order, one track a year from its first release to its last.</li>
        <li><b>Solaris station</b> on a planet: park a radio station in its orbit and listen to that label, track after unheard track.</li>
        <li><b>Start an odyssey</b> from a star: 20+ tracks across five star systems.</li>
        <li><b>Hitchhike the system</b> on a star: thumb a ride round ten of its labels, 42 tracks, a new ride every time.</li>
        <li><b>Wormhole</b> jumps to a random track anywhere on the map.</li>
        <li><b>Beacon</b> is a like: it saves the track to the BEACONS tab, which plays them as a YouTube playlist.</li>
        <li><b>?</b> opens the safety briefing: the whole observatory on one card.</li></ul></div>
      <div class="bars"><div class="ph-sub">PLANET TYPES</div>${(Object.keys(PTYPE_INFO) as PType[]).map((k) => { const c = ptype.filter((x) => x === k).length; return meter(PTYPE_INFO[k][0], c / Math.max(1, planets.length), fmt(c)); }).join("")}<p class="note">Giants are the biggest labels, ringed worlds are long-runners (15+ years), cratered ones went quiet before 2001, ice worlds started after 2010.</p></div>
      <div class="bars"><div class="ph-sub">STAR SYSTEMS // BY TRACK COUNT</div>${top.map(({ s, i }) => meter(s.name.toUpperCase(), s.tracks / mx, fmt(s.tracks), R({ kind: "star", s: i }), s.color)).join("")}</div>`,
  };
}

/* —— the dossiers as a directory on the ship's disk: a star, a label or a track listed like folders
   (live/, sets/, labels/, tracks/…) with the first few entries showing; a folder opens and closes, "… more"
   lists more. */
const MORE_STEP = 20;
/** the DJ, from a set's title: the part before the venue */
const setHead = (t: string) => t.split(/\s*(?:\||@|\/\/|\s[-–—]\s|\sfor\s|\sat\s|\sin the lab|\slive\b)/i)[0] || t;
const slugPath = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
/** which folders are open and how much of each is listed, per object */
const treeOpen = new Map<string, Set<string>>(), treeSeen = new Map<string, Set<string>>(), treeShown = new Map<string, number>();
let treeKey = "";
type Entry = { name: string; meta?: string; attrs: string; cls?: string; title?: string };
type Folder = { id: string; name: string; meta?: string; red?: boolean; open?: boolean; items?: Entry[]; total?: number; note?: string; attrs?: string; body?: string; first?: number };
const isOpen = (f: Folder) => { const s = treeOpen.get(treeKey); return s ? s.has(f.id) : !!f.open; };
function tree(path: string, folders: Folder[]) {
  // a folder seen for the first time (sets arrive, a stream goes live) opens or not as it's meant to
  const open = treeOpen.get(treeKey) ?? new Set<string>(), seen = treeSeen.get(treeKey) ?? new Set<string>();
  for (const f of folders) if (!seen.has(f.id)) { seen.add(f.id); if (f.open) open.add(f.id); }
  treeOpen.set(treeKey, open); treeSeen.set(treeKey, seen);
  const out = [`<div class="tree"><div class="t-cmd">&gt; ls ${esc(path)}</div>`];
  for (const f of folders) {
    const leaf = !f.items && !f.body, open = !leaf && isOpen(f);
    const mark = leaf ? "·" : open ? "▾" : "▸";
    out.push(`<button type="button" class="t-row t-dir${f.red ? " red" : ""}" ${f.attrs ?? (leaf ? "" : `data-tree="${f.id}"`)}><span class="t-p">${mark}</span><span class="t-n">${esc(f.name)}</span><span class="t-m">${f.meta ?? ""}</span></button>`);
    if (!open) continue;
    if (f.body) { out.push(`<div class="t-body">${f.body}</div>`); continue; }
    const items = f.items!, shown = Math.min(items.length, treeShown.get(`${treeKey}/${f.id}`) ?? f.first ?? 3), left = (f.total ?? items.length) - shown;
    if (!items.length) out.push(`<div class="t-row t-note"><span class="t-p">│ └─</span><span class="t-n">${f.note ?? "empty"}</span></div>`);
    items.slice(0, shown).forEach((e, k) => {
      const last = k === shown - 1 && left <= 0;
      out.push(`<button type="button" class="t-row${e.cls ? ` ${e.cls}` : ""}${f.red ? " red" : ""}" ${e.attrs}${e.title ? ` title="${esc(e.title)}"` : ""}><span class="t-p">│ ${last ? "└─" : "├─"}</span><span class="t-n">${esc(e.name)}</span><span class="t-m">${e.meta ?? ""}</span></button>`);
    });
    if (left > 0) out.push(`<button type="button" class="t-row t-more" ${shown < items.length ? `data-tmore="${f.id}"` : ""}><span class="t-p">│ └─</span><span class="t-n">… ${fmt(left)} more</span></button>`);
  }
  out.push(`<div class="t-cmd">&gt; <span class="t-cur">_</span></div></div>`);
  return out.join("");
}
/** a track as an entry: artist — title, its year */
const trackEntry = (s: number, i: number): Entry => {
  const ch = chunk(s)!;
  return { name: `${ch.an[ch.a[i]]} — ${ch.t[i]}`, meta: ch.yr[i] ? String(ch.yr[i]) : "", attrs: `data-r="${R({ kind: "track", s, i })}"`, cls: isNowPlaying(s, i) ? "now" : "" };
};
/** the star's DJ sets that play any of these tracks: the set, its index in the star's list, the line */
function setsWith(si: number, yts: Set<string>, again: () => void) {
  const name = galaxy.stars[si].name;
  if (setCountsNow === null) { loadSetCounts().then((n) => { if (n[name]) again(); }); return []; }
  if (!setCountsNow[name]) return [];
  const list = setsNow.get(name); if (!list) { loadStarSets(name).then(again); return []; }
  const out: { r: SetRec; k: number; line: SetRec["tl"][number] }[] = [];
  list.forEach((r, k) => { const line = r.tl.find((x) => x[2] && yts.has(x[2])); if (line) out.push({ r, k, line }); });
  return out;
}
const inSetsFolder = (hits: ReturnType<typeof setsWith>, id = "in-sets"): Folder | null => !hits.length ? null : {
  id, name: `${id}/`, meta: String(hits.length), open: true,
  items: hits.map(({ r, k, line }) => ({ name: setHead(r.t), meta: line[0] >= 0 ? `▶ ${hms(line[0])}` : hms(r.d), attrs: `data-set="${k}" data-at="${Math.max(0, line[0])}"`, title: `${r.t} · ${r.c}${line[0] >= 0 ? ` — plays it at ${hms(line[0])}` : ""}` })),
};
const pathOf = (si: number) => { const neb = galaxy.nebulaOf(si); return `/${neb ? `${slugPath(neb.name)}/` : ""}${slugPath(galaxy.stars[si].name)}`; };

function star(si: number) {
  const g = galaxy, s = g.stars[si], pl = g.planetsByStar[si], nb = g.neighbours(si), neb = g.nebulaOf(si), name = s.name;
  treeKey = `s${si}`;
  const again = () => { if (state.sel?.kind === "star" && state.sel.s === si) renderDossier(); };
  dosAnim = (t) => { const c = heroCanvas(); if (!c) return; const f = fitted(c); drawPulsarHero(f.g, f.w, f.h, si, t); };
  const live = state.live.get(si) ?? [];
  if (setCountsNow === null) loadSetCounts().then((n) => { if (n[name]) again(); });
  const nSets = setCountsNow?.[name] ?? 0, list = nSets ? setsNow.get(name) : [];
  if (nSets && !list) loadStarSets(name).then(again);
  const folders: (Folder | null)[] = [
    live.length ? { id: "live", name: "● live/", red: true, open: true, meta: `${live.length} ON AIR`, first: 5,
      items: live.map((x, k) => ({ name: `${setHead(x.t)} · ${x.c}`, meta: `${x.viewers ? fmt(x.viewers) : ""} ▶`, attrs: `data-live="${k}"`, title: `${x.t} — tune in` })) } : null,
    nSets ? { id: "sets", name: "sets/", meta: list ? fmt(list.length) : "…", open: true,
      items: (list ?? []).map((r, k) => ({ name: setHead(r.t), meta: hms(r.d), attrs: `data-set="${k}"`, title: `${r.t} · ${r.c} · ${r.y}${onMap(r) ? ` · ${onMap(r)} tracks on the map` : ""}` })), note: "loading…" } : null,
    pl.length ? { id: "labels", name: "labels/", meta: fmt(pl.length), open: true,
      items: pl.map((p) => ({ name: g.planets[p].name, meta: fmt(g.planets[p].n), attrs: `data-r="${R({ kind: "planet", p })}"`, title: `${g.planets[p].name}: ${fmt(g.planets[p].n)} releases` })) } : null,
    !g.meta.sample && beltSize(si) > 0 ? { id: "belt", name: "belt/", meta: `${fmt(beltSize(si))} rocks · ⛏ dig`, attrs: `data-dig="${si}" title="Drill into a random asteroid: a track with no label at all"` } : null,
    nb.length ? { id: "links", name: "links/", meta: nb.slice(0, 3).map((n) => g.stars[n.s].name).join(" · "),
      items: nb.map((n) => ({ name: g.stars[n.s].name, meta: `${Math.round(n.w * 100)}%`, attrs: `data-r="${R({ kind: "star", s: n.s })}"` })), first: 10 } : null,
    { id: "about", name: "about.txt", body: `<div class="rows">${neb ? `<div class="row"><span>GALAXY</span><button class="link" data-neb="${g.nebulae.indexOf(neb)}">${esc(neb.name.toUpperCase())}</button></div>` : ""}${row("RELEASES", fmt(s.n))}${row("PLANETS / LABELS", fmt(pl.length))}${row("TRACKS", fmt(s.tracks))}${row("CLASS", `${g.sclass[si]} · ${g.starClassName(si)}`)}${row("LUMINOSITY", `${Math.round(g.recentShare[si] * 100)}% IN LAST 10 YRS`)}${row("TYPICAL TEMPO", tempoLabel(g.tempo[si]))}${row("PEAK YEAR", String(g.peakYear[si]))}${s.belts ? row("ASTEROID BELTS", s.belts.map(([a, b]) => `${a}–${b}`).join(" · ")) : ""}</div>
        ${s.yh?.length ? hist(s.yh, g.Y0, "ACTIVITY // RELEASES PER YEAR") : ""}
        <p class="note">Size shows how many releases the style has; glow shows how alive it is today. The star pulses at the tempo typical for its style (styles without a steady beat just breathe slowly) and sheds a shell once every bar. Tempo is the usual range for the style, not measured from the tracks.</p>` },
  ];
  return {
    code: `STAR // ST-${pad(si, 2)}`, title: s.name.toUpperCase(),
    html: `<div class="hero"><div class="frame" id="hero"><canvas></canvas></div>
        <div class="ident"><span class="code">ST-${pad(si, 2)} // ${neb ? esc(neb.name.toUpperCase()) : "STYLE"}</span><h2 id="dosTitle"></h2><span class="stamp">${tempoLabel(g.tempo[si])} · ${fmt(s.tracks)} TRACKS</span></div></div>
      ${tree(pathOf(si), folders.filter((f): f is Folder => !!f))}
      ${!g.meta.sample && pl.length ? `<button class="play" data-system="${si}">▶ HITCHHIKE THE SYSTEM<small class="sub">a ride round ten of its labels, 42 tracks</small></button>` : ""}
      ${!g.meta.sample && beltSize(si) > 0 ? `<button class="plot crt dig" data-dig="${si}" title="Drill into a random asteroid: a track with no label at all — self-released, white labels, the unknown. Every new one you hear is ore."><span>⛏ DIG THE BELT · ${fmt(beltSize(si))} ROCKS</span><small class="sub">a random track with no label</small></button>` : ""}
      ${pl.length ? `<button class="plot crt" data-route-star="${si}"><span>⟶ START THE ODYSSEY FROM HERE</span><small class="sub">a trip to another style, pick where</small></button>` : ""}`,
  };
}

const ordinal = (k: number) => { const t = k % 100, e = k % 10; return k + (t >= 11 && t <= 13 ? "th" : e === 1 ? "st" : e === 2 ? "nd" : e === 3 ? "rd" : "th"); };
/** what kind of world it is, shown on hover over the TYPE row */
function planetType(pi: number) {
  const g = galaxy, ty = g.ptype[pi], [tn, td] = PTYPE_INFO[ty];
  return `${tn[0]}${tn.slice(1).toLowerCase()}: ${td}${ty === "giant" && g.ringed[pi] ? `, with rings: ${PTYPE_INFO.ringed[1]}` : ""}.`;
}

function planet(pi: number, o: Sel) {
  const g = galaxy, p = g.planets[pi], s = g.stars[p.s], ch = chunk(p.s), ty = g.ptype[pi];
  treeKey = `p${pi}`;
  const again = () => { if (state.sel === o) renderDossier(); };
  if (!ch) tracks.load(p.s).then(again);
  const n = p.t1 - p.t0, sys = g.planetsByStar[p.s], rank = sys.indexOf(pi) + 1;
  let activity = "", ly: [number, number] | null = null;
  if (ch && n) {
    const ys = ch.yr.slice(p.t0, p.t1).filter(Boolean);
    if (ys.length >= 3 && !g.meta.sample) ly = [Math.min(...ys), Math.max(...ys)];
    if (ys.length) { const y0 = Math.min(...ys), cnt = new Array(Math.max(...ys) - y0 + 1).fill(0); ys.forEach((y) => cnt[y - y0]++); activity = hist(cnt, y0, "ACTIVITY PER YEAR"); }
  }
  const order = ch ? satelliteOrder(pi) : [];
  const hits = ch ? setsWith(p.s, new Set(order.map((i) => ch.yt[i])), again) : [];
  const others = sys.filter((q) => q !== pi).sort((a, b) => Math.abs(sys.indexOf(a) - rank) - Math.abs(sys.indexOf(b) - rank));
  const sd = hash(p.name) % 100;
  let drawn = false, last = -1;
  dosAnim = (t) => {
    if (reduce && drawn) return;
    const c = heroCanvas(); if (!c) return; const f = fitted(c);
    if (((t / 66) | 0) === last) return; last = (t / 66) | 0;
    f.g.fillStyle = BG; f.g.fillRect(0, 0, f.w, f.h);
    const r = Math.min(f.h, f.w) * 0.4; // every planet at one size; rings may run off the frame
    drawPlanetBody(f.g, pi, f.w / 2, f.h / 2, r, reduce ? 0.4 : t / 4000 + sd, 1); drawn = true;
  };
  const folders: (Folder | null)[] = [
    { id: "tracks", name: "tracks/", meta: `${fmt(n + (p.v?.[1] ?? 0))} · <span class="out t-act" role="button" data-shuffle="${pi}" title="Another random order">↻ shuffle</span>`, open: true, first: 5,
      items: order.slice(0, 150).map((i) => trackEntry(p.s, i)), total: n, note: ch ? "no tracks on the map" : "loading…" },
    inSetsFolder(hits),
    others.length ? { id: "neighbours", name: "neighbours/", meta: `${fmt(others.length)} in ${s.name}`, items: others.map((q) => ({ name: g.planets[q].name, meta: fmt(g.planets[q].n), attrs: `data-r="${R({ kind: "planet", p: q })}"` })) } : null,
    p.v ? { id: "vault", name: "vault/", meta: `+${fmt(p.v[1])} off the map · SOLARIS plays them` } : null,
    { id: "about", name: "about.txt", body: `<div class="rows"><div class="row"><span>ORBIT</span><button class="link" data-r="${R({ kind: "star", s: p.s })}">${esc(s.name.toUpperCase())}</button></div>${row("TYPE", `<span title="${esc(planetType(pi))}">${PTYPE_INFO[ty][0] + (ty === "giant" && g.ringed[pi] ? " · RINGED" : "")}</span>`)}${row("SIZE RANK", `#${rank} OF ${fmt(sys.length)}`)}${row("POSITION", `${ordinal(g.orbitNo[pi]).toUpperCase()} FROM THE STAR`)}${row("RELEASES", fmt(p.n))}${row("TRACKS", p.v ? `${fmt(n + p.v[1])} · ${fmt(n)} ON THE MAP` : fmt(n))}${row("ACTIVE", p.ay ? `${p.ay} OF ${spanOf(p) + 1} YEARS` : `${spanOf(p) + (p.yr[0] ? 1 : 0)} YEARS`)}</div>${activity}` },
  ];
  return {
    code: `PLANET // PL-${pad(pi, 4)}`, title: p.name.toUpperCase(),
    html: `<div class="hero"><div class="frame" id="hero"><canvas></canvas></div>
        <div class="ident"><span class="code">PL-${pad(pi, 4)} // <button class="link" data-r="${R({ kind: "star", s: p.s })}">${esc(s.name.toUpperCase())}</button></span><h2 id="dosTitle"></h2><span class="stamp">${p.yr[0] || "????"}–${p.yr[1] || "????"} · ${fmt(p.n)} REL</span></div></div>
      ${tree(`${pathOf(p.s)}/${slugPath(p.name)}`, folders.filter((f): f is Folder => !!f))}
      ${ch && n && !g.meta.sample ? `<button class="play" data-orbit="${pi}">▶ SOLARIS STATION<small class="sub">this label as an endless radio</small></button>` : ""}
      ${ly ? `<button class="plot crt" data-years="${pi}"><span>⟶ TIME WARP · ${ly[0]}–${ly[1]}</span><small class="sub">the label’s story, a track a year</small></button>` : ""}`,
  };
}

function track(o: { kind: "track"; s: number; i: number }) {
  const g = galaxy, ch = chunk(o.s)!, s = g.stars[o.s], pi = ch.p[o.i], p = pi >= 0 ? g.planets[pi] : null, yt = ch.yt[o.i];
  treeKey = `t${o.s}-${o.i}`;
  const near = nearestTracks(o, 40), on = beacons.has(o);
  const again = () => { if (state.sel === o) renderDossier(); };
  const hits = setsWith(o.s, new Set([yt]), again);
  const mates = p ? satelliteOrder(pi).filter((i) => i !== o.i) : [];
  const sd = hash(yt) % 97;
  let done = false;
  dosAnim = (t) => {
    const c = document.getElementById("wave") as HTMLCanvasElement | null; if (!c) return;
    const f = fitted(c);
    const mine = isNowPlaying(o.s, o.i), live = mine && player.playing;
    const scrubbing = mine && performance.now() - scrub.t < 420, sync = mine && !scrubbing && player.buffering;
    if (reduce && done && !scrubbing) return; done = true;
    const tc = $("tCur").textContent;
    const label = scrubbing ? (scrub.dir < 0 ? `◂◂ SEEK ${tc}` : `SEEK ${tc} ▸▸`) : sync ? "SYNC…" : undefined;
    drawWave(f.g, f.w, f.h, t, sd, live, (a = 1) => sc(o.s, a), { scrub: scrubbing ? (scrub.dir || 1) : 0, sync, label });
  };
  const folders: (Folder | null)[] = [
    { id: "links", name: "links/", open: true, first: 5, items: [
      p ? { name: `label → ${p.name}`, meta: `${fmt(p.n)} rel`, attrs: `data-r="${R({ kind: "planet", p: pi })}"` } : { name: `asteroid belt${ore.has(yt) ? " · ore mined" : ""}`, meta: "no label", attrs: `data-r="${R({ kind: "star", s: o.s })}"` },
      { name: `style → ${s.name}`, meta: fmt(s.tracks), attrs: `data-r="${R({ kind: "star", s: o.s })}"` },
      { name: "youtube ↗", meta: "", attrs: `data-yt="${esc(yt)}"` },
    ] },
    inSetsFolder(hits),
    mates.length ? { id: "same-label", name: "same-label/", meta: fmt(mates.length), items: mates.slice(0, 150).map((i) => trackEntry(o.s, i)), total: mates.length } : null,
    near.length ? { id: "nearby", name: "nearby/", meta: "nearest signals", open: !hits.length, items: near.map((r) => trackEntry(r.s, r.i)) } : null,
    { id: "about", name: "about.txt", body: `<div class="rows">${row("ARTIST", esc(ch.an[ch.a[o.i]]))}${row("YEAR", ch.yr[o.i] ? String(ch.yr[o.i]) : "----")}${row("COORDINATES", `${ch.x[o.i].toFixed(0)} / ${ch.y[o.i].toFixed(0)}`)}${row("SIGNAL", trackCode(o.s, o.i))}</div>` },
  ];
  return {
    code: `OBJECT // ${trackCode(o.s, o.i)}`, title: ch.t[o.i].toUpperCase(),
    html: `<div class="hero"><div class="frame thumb" id="hero"><img alt="" src="https://i.ytimg.com/vi/${esc(yt)}/default.jpg" referrerpolicy="no-referrer"><span class="raster"></span></div>
        <div class="ident"><span class="code">${trackCode(o.s, o.i)} // TRACK</span><h2 id="dosTitle"></h2><span class="by">${esc(ch.an[ch.a[o.i]])}${ch.yr[o.i] ? ` · ${ch.yr[o.i]}` : ""}</span></div></div>
      <div class="scope-c"><canvas id="wave"></canvas></div>
      ${tree(`${pathOf(o.s)}/${p ? slugPath(p.name) : "belt"}/${slugPath(ch.t[o.i]).slice(0, 28) || "track"}`, folders.filter((f): f is Folder => !!f))}
      ${g.meta.sample ? `<p class="note">TEST SIGNAL: videos won't play.</p>` : `<button class="play" data-r="${R(o)}" data-play="1">${isNowPlaying(o.s, o.i) ? "◉ ON AIR" : "▶ PLAY"}</button>`}
      <button class="plot like${on ? " on" : ""}" data-like="1">${beaconLabel(on)}</button>
      <button class="plot like lists" data-lists="1" aria-haspopup="true" title="Put this track in one of your lists (⇧L)">${ICON.list}<span>ADD TO LIST</span></button>
      <div class="outs"><button type="button" class="out" data-share="copy" title="Copy a link to this track">COPY LINK ⧉</button><button type="button" class="out" data-share="send" title="Post this track to COMMS, as a card">SEND TO COMMS ⇪</button><a class="out" href="https://www.youtube.com/watch?v=${esc(yt)}" target="_blank" rel="noopener">OPEN ON YOUTUBE ↗</a></div>`,
  };
}

/** redraw the dossier where it was (a folder opened, more listed), without the decode */
function keepScroll() { const d = $("detail"), top = d.scrollTop; renderDossier(true); d.scrollTop = top; }

export function renderDossier(quiet = false) {
  refs.length = 0; dosAnim = null;
  const o = state.sel, d = $("detail");
  const accSi = !o ? -1 : o.kind === "planet" ? galaxy.planets[o.p].s : o.s;
  document.querySelector<HTMLElement>(".dossier")!.style.setProperty("--acc", accSi >= 0 ? galaxy.stars[accSi].color : "");
  const v = !o ? sector() : o.kind === "star" ? star(o.s) : o.kind === "planet" ? planet(o.p, o) : track(o);
  d.innerHTML = v.html; d.scrollTop = 0;
  // the keys (play, stations, routes, beacon, links) live in a bar under the dossier, always in view
  const acts = $("dosActs"); acts.innerHTML = "";
  d.querySelectorAll<HTMLElement>(":scope > .play, :scope > .plot, :scope > .outs").forEach((el) => acts.appendChild(el));
  lockDossier(acts); // closed beta
  // all meters of a dossier share one label column, as wide as its longest label
  const labs = d.querySelectorAll<HTMLElement>(".bar-r > span:first-child");
  if (labs.length) { d.style.setProperty("--lbl", "max-content"); const w = Math.max(...[...labs].map((e) => e.scrollWidth)); d.style.setProperty("--lbl", w > 20 ? `${Math.min(w + 2, 170)}px` : ""); }
  // the label shelf: each planet drawn once, still
  d.querySelectorAll<HTMLCanvasElement>("canvas[data-pl]").forEach((c) => {
    const f = fitCanvas(c), pi = +c.dataset.pl!;
    f.g.fillStyle = BG; f.g.fillRect(0, 0, f.w, f.h);
    drawPlanetBody(f.g, pi, f.w / 2, f.h / 2, Math.min(f.w, f.h) * 0.3, hash(galaxy.planets[pi].name) % 100);
  });
  if (quiet) { $("dosId").textContent = v.code; const h = document.getElementById("dosTitle"); if (h) h.textContent = v.title; }
  else { scramble($("dosId"), v.code); scramble(document.getElementById("dosTitle"), v.title); }
  const img = d.querySelector<HTMLImageElement>(".thumb img");
  if (img) img.onerror = () => {
    img.remove(); const f = $("hero"); f.classList.remove("thumb"); f.insertAdjacentHTML("afterbegin", "<canvas></canvas>"); f.querySelector(".raster")?.remove();
    const ff = fitCanvas(heroCanvas()!), si = state.sel?.kind === "track" ? state.sel.s : 0;
    drawSphere(ff.g, ff.w, ff.h, 7, 0, (a = 1) => sc(si, a), "rocky", false);
  };
}

/** refresh just the beacon button of a track dossier */
export function paintDossierBeacon() {
  const b = document.querySelector<HTMLElement>(".dossier [data-like]"), sel = state.sel;
  if (b && sel?.kind === "track") { const on = beacons.has(sel); b.innerHTML = beaconLabel(on); b.classList.toggle("on", on); }
}

export function initDossier() {
  provide({
    showSelection: (ms) => { renderDossier(); if (ms) decodeDossier(ms); },
    // a star on screen whose streams changed: its DJ SETS again
    liveChanged: () => { if (state.sel?.kind === "star" && (state.live.has(state.sel.s) || document.querySelector(".dossier .t-row.red"))) keepScroll(); },
    oreFound: (n) => { say(`ORE MINED · ${n} ${n === 1 ? "ROCK" : "ROCKS"} DUG UP SO FAR`); renderDossier(); },
  });
  const click = (e: Event) => {
    const t = e.target as HTMLElement;
    const ps = t.closest<HTMLElement>("[data-route-star]"); if (ps) { startPick(+ps.dataset.routeStar!, "star"); return; }
    const sy = t.closest<HTMLElement>("[data-system]"); if (sy) { playSystem(+sy.dataset.system!); return; }
    const yr = t.closest<HTMLElement>("[data-years]"); if (yr) { playLightYears(+yr.dataset.years!); return; }
    const nb = t.closest<HTMLElement>("[data-neb]"); if (nb) { flyToNebula(+nb.dataset.neb!); return; }
    const po = t.closest<HTMLElement>("[data-orbit]"); if (po) { playOrbit(+po.dataset.orbit!); return; }
    const sf = t.closest<HTMLElement>("[data-shuffle]"); if (sf) { reshuffle(+sf.dataset.shuffle!); keepScroll(); return; }
    const tf = t.closest<HTMLElement>("[data-tree]");
    if (tf) { const set = treeOpen.get(treeKey) ?? new Set<string>(); const id = tf.dataset.tree!; if (set.has(id)) set.delete(id); else set.add(id); treeOpen.set(treeKey, set); keepScroll(); return; }
    const tm = t.closest<HTMLElement>("[data-tmore]");
    if (tm) { const k = `${treeKey}/${tm.dataset.tmore}`; treeShown.set(k, (treeShown.get(k) ?? 3) + MORE_STEP); keepScroll(); return; }
    const yv = t.closest<HTMLElement>("[data-yt]"); if (yv) { open(`https://www.youtube.com/watch?v=${yv.dataset.yt}`, "_blank", "noopener"); return; }
    const lv = t.closest<HTMLElement>("[data-live]");
    if (lv && state.sel?.kind === "star") {
      const nm = galaxy.stars[state.sel.s].name, x = state.live.get(state.sel.s)?.[+lv.dataset.live!];
      if (x) playSet({ v: x.v, t: x.t, c: x.c, d: 0, y: new Date(x.started).getFullYear(), w: x.viewers, tl: [], live: true }, nm);
      return;
    }
    const st = t.closest<HTMLElement>("[data-set]");
    if (st && state.sel) {
      const sel = state.sel, si = sel.kind === "planet" ? galaxy.planets[sel.p].s : sel.s, nm = galaxy.stars[si].name, r = setsNow.get(nm)?.[+st.dataset.set!];
      if (r) playSet(r, nm, +(st.dataset.at ?? 0)); return;
    }
    const dg = t.closest<HTMLElement>("[data-dig]"); if (dg) { digBelt(+dg.dataset.dig!); return; }
    const ls = t.closest<HTMLElement>("[data-lists]"); if (ls) { if (state.sel?.kind === "track") listPickerFor(ls, state.sel); return; }
    if (t.closest("[data-like]")) { if (state.sel?.kind === "track") toggleBeacon(state.sel); return; }
    const sh = t.closest<HTMLElement>("[data-share]"); if (sh) { if (state.sel?.kind === "track") shareTrack(state.sel, sh.dataset.share as "copy" | "send", sh); return; }
    const b = t.closest<HTMLElement>("[data-r]"); if (!b) return;
    const o = refs[+b.dataset.r!];
    if (o?.kind === "track") { select(o, true, !!b.dataset.play); return; }
    select(o);
  };
  $("detail").addEventListener("click", click);
  $("dosActs").addEventListener("click", click);
  onFrame((t) => dosAnim?.(t));
}
