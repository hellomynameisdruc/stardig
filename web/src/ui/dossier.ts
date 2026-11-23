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
const trackItem = (s: number, i: number, n: number) => {
  const ch = chunk(s)!;
  return `<button data-r="${R({ kind: "track", s, i })}" class="${isNowPlaying(s, i) ? "now" : ""}"><span class="n">${pad(n, 3)}</span><span class="t">${esc(ch.an[ch.a[i]])} — ${esc(ch.t[i])}</span><span class="y">${ch.yr[i] || "----"}</span></button>`;
};
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

/** a star's shelves: what's live, DJ sets and labels as rows of covers; ALL → opens one as a full list */
const SETS_STEP = 30;
/** how many of a star's sets the full list shows (SHOW MORE adds a step) */
const setsShown = new Map<number, number>();
/** the shelf opened as a full list, if any */
let opened: { si: number; what: "sets" | "labels" } | null = null;
const SHELF = 12;
/** the DJ, from a set's title: the part before the venue */
const setHead = (t: string) => t.split(/\s*(?:\||@|\/\/|\s[-–—]\s|\sfor\s|\sat\s|\sin the lab|\slive\b)/i)[0] || t;
const shelfHead = (title: string, n: number, what?: "sets" | "labels", red = false) =>
  `<div class="ph-sub shelf-h${red ? " red" : ""}"><span>${title}</span>${what ? `<button type="button" class="out" data-all="${what}">ALL ${fmt(n)} →</button>` : `<span>${fmt(n)}</span>`}</div>`;

function liveShelf(si: number) {
  const live = state.live.get(si) ?? []; if (!live.length) return "";
  return `<div>${shelfHead("● LIVE NOW", live.length, undefined, true)}<div class="list sets">${live.map((x, k) => `<button class="live-row" data-live="${k}" title="Tune in, in SET MODE"><span class="n">●</span><span class="t">${esc(x.t)}<small>${esc(x.c)}${x.viewers ? ` · ${fmt(x.viewers)} WATCHING` : ""}</small></span><span class="y">TUNE IN</span></button>`).join("")}</div></div>`;
}

function setsShelf(si: number) {
  const name = galaxy.stars[si].name, again = () => { if (state.sel?.kind === "star" && state.sel.s === si) renderDossier(); };
  if (setCountsNow === null) { loadSetCounts().then((n) => { if (n[name]) again(); }); return ""; }
  const n = setCountsNow[name] ?? 0; if (!n) return "";
  const list = setsNow.get(name); if (!list) { loadStarSets(name).then(again); return `<div>${shelfHead("DJ SETS", n)}<p class="note">LOADING…</p></div>`; }
  if (opened?.si === si && opened.what === "sets") {
    const shown = setsShown.get(si) ?? SETS_STEP;
    return `<div><div class="ph-sub shelf-h"><span>DJ SETS · ${fmt(list.length)}</span><button type="button" class="out" data-back="1">← BACK</button></div><div class="list sets">${list.slice(0, shown).map((r, k) => { const m = onMap(r); return `<button data-set="${k}" title="Play in SET MODE"><span class="n">${pad(k + 1, 3)}</span><span class="t">${esc(r.t)}<small>${esc(r.c)} · ${r.y}${m ? ` · ${m} ON THE MAP` : ""}</small></span><span class="y">${hms(r.d)}</span></button>`; }).join("")}</div>
      ${list.length > shown ? `<button type="button" class="out more-sets" data-more-sets="${si}">SHOW ${Math.min(SETS_STEP, list.length - shown)} MORE · ${fmt(list.length - shown)} LEFT</button>` : ""}</div>`;
  }
  return `<div>${shelfHead("DJ SETS", list.length, "sets")}<div class="shelf">${list.slice(0, SHELF).map((r, k) => `<button class="shelf-i" data-set="${k}" title="${esc(r.t)}"><span class="cover"><img alt="" loading="lazy" referrerpolicy="no-referrer" src="https://i.ytimg.com/vi/${esc(r.v)}/default.jpg"><b>${hms(r.d)}</b></span><span class="nm">${esc(setHead(r.t))}</span><small>${esc(r.c)}${onMap(r) ? ` · ${onMap(r)} ON MAP` : ""}</small></button>`).join("")}</div></div>`;
}

function labelsShelf(si: number, pl: number[]) {
  if (!pl.length) return "";
  const g = galaxy;
  if (opened?.si === si && opened.what === "labels")
    return `<div><div class="ph-sub shelf-h"><span>LABELS · ${fmt(pl.length)}</span><button type="button" class="out" data-back="1">← BACK</button></div><div class="list">${pl.map((p, k) => `<button data-r="${R({ kind: "planet", p })}"><span class="n">${pad(k + 1, 3)}</span><span class="t">${esc(g.planets[p].name)}</span><span class="y">${fmt(g.planets[p].n)} REL</span></button>`).join("")}</div></div>`;
  return `<div>${shelfHead("LABELS", pl.length, "labels")}<div class="shelf">${pl.slice(0, SHELF).map((p) => `<button class="shelf-i pl" data-r="${R({ kind: "planet", p })}"><canvas data-pl="${p}"></canvas><span class="nm">${esc(g.planets[p].name)}</span><small>${fmt(g.planets[p].n)} REL</small></button>`).join("")}</div></div>`;
}

function star(si: number) {
  const g = galaxy, s = g.stars[si], pl = g.planetsByStar[si], nb = g.neighbours(si), neb = g.nebulaOf(si);
  if (opened && opened.si !== si) opened = null;
  dosAnim = (t) => { const c = heroCanvas(); if (!c) return; const f = fitted(c); drawPulsarHero(f.g, f.w, f.h, si, t); };
  return {
    code: `STAR // ST-${pad(si, 2)}`, title: s.name.toUpperCase(),
    html: `<div class="hero"><div class="frame" id="hero"><canvas></canvas></div>
        <div class="ident"><span class="code">ST-${pad(si, 2)} // ${neb ? esc(neb.name.toUpperCase()) : "STYLE"}</span><h2 id="dosTitle"></h2><span class="stamp">${tempoLabel(g.tempo[si])} · ${fmt(s.tracks)} TRACKS</span></div></div>
      ${liveShelf(si)}
      ${setsShelf(si)}
      ${labelsShelf(si, pl)}
      ${nb.length ? `<div><div class="ph-sub shelf-h"><span>NEIGHBOURS</span><span>${nb.length}</span></div><div class="chips">${nb.map((n) => `<button data-r="${R({ kind: "star", s: n.s })}" style="--c:${g.stars[n.s].color}">${esc(g.stars[n.s].name)} <i>${Math.round(n.w * 100)}%</i></button>`).join("")}</div></div>` : ""}
      <details class="about star-about"><summary>ABOUT THE STAR</summary>
        <div class="rows">${neb ? `<div class="row"><span>GALAXY</span><button class="link" data-neb="${g.nebulae.indexOf(neb)}">${esc(neb.name.toUpperCase())}</button></div>` : ""}${row("RELEASES", fmt(s.n))}${row("PLANETS / LABELS", fmt(pl.length))}${row("TRACKS", fmt(s.tracks))}${row("CLASS", `${g.sclass[si]} · ${g.starClassName(si)}`)}${row("LUMINOSITY", `${Math.round(g.recentShare[si] * 100)}% IN LAST 10 YRS`)}${row("TYPICAL TEMPO", tempoLabel(g.tempo[si]))}${row("PEAK YEAR", String(g.peakYear[si]))}${s.belts ? row("ASTEROID BELTS", s.belts.map(([a, b]) => `${a}–${b}`).join(" · ")) : ""}</div>
        ${s.yh?.length ? hist(s.yh, g.Y0, "ACTIVITY // RELEASES PER YEAR") : ""}
        <p class="note">Size shows how many releases the style has; glow shows how alive it is today. The star pulses at the tempo typical for its style (styles without a steady beat just breathe slowly) and sheds a shell once every bar. Tempo is the usual range for the style, not measured from the tracks.</p></details>
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

/** a track as a cover on a shelf: its YouTube preview in the tube's look, the title, the artist and year */
const trackCover = (s: number, i: number) => {
  const ch = chunk(s)!;
  return `<button class="shelf-i${isNowPlaying(s, i) ? " now" : ""}" data-r="${R({ kind: "track", s, i })}" title="${esc(ch.an[ch.a[i]])} — ${esc(ch.t[i])}"><span class="cover"><img alt="" loading="lazy" referrerpolicy="no-referrer" src="https://i.ytimg.com/vi/${esc(ch.yt[i])}/default.jpg">${ch.yr[i] ? `<b>${ch.yr[i]}</b>` : ""}</span><span class="nm">${esc(ch.t[i])}</span><small>${esc(ch.an[ch.a[i]])}</small></button>`;
};
/** the star's DJ sets that play any of these tracks: [set, the line, its index in the star's list] */
function setsWith(si: number, yts: Set<string>, again: () => void) {
  const name = galaxy.stars[si].name;
  if (setCountsNow === null) { loadSetCounts().then((n) => { if (n[name]) again(); }); return []; }
  if (!setCountsNow[name]) return [];
  const list = setsNow.get(name); if (!list) { loadStarSets(name).then(again); return []; }
  const out: { r: SetRec; k: number; line: SetRec["tl"][number] }[] = [];
  list.forEach((r, k) => { const line = r.tl.find((x) => x[2] && yts.has(x[2])); if (line) out.push({ r, k, line }); });
  return out;
}
const inSetsShelf = (hits: ReturnType<typeof setsWith>, title: string) => !hits.length ? "" :
  `<div>${shelfHead(title, hits.length)}<div class="shelf">${hits.slice(0, SHELF).map(({ r, k, line }) => `<button class="shelf-i" data-set="${k}" data-at="${Math.max(0, line[0])}" title="${esc(r.t)}${line[0] >= 0 ? ` — from ${hms(line[0])}` : ""}"><span class="cover"><img alt="" loading="lazy" referrerpolicy="no-referrer" src="https://i.ytimg.com/vi/${esc(r.v)}/default.jpg"><b>${line[0] >= 0 ? `▶ ${hms(line[0])}` : hms(r.d)}</b></span><span class="nm">${esc(setHead(r.t))}</span><small>${esc(line[1])}</small></button>`).join("")}</div></div>`;

let planetOpen = -1;
function planet(pi: number, o: Sel) {
  const g = galaxy, p = g.planets[pi], s = g.stars[p.s], ch = chunk(p.s), ty = g.ptype[pi];
  const again = () => { if (state.sel === o) renderDossier(); };
  if (!ch) tracks.load(p.s).then(again);
  if (planetOpen !== pi) planetOpen = -1;
  const n = p.t1 - p.t0, sys = g.planetsByStar[p.s], rank = sys.indexOf(pi) + 1;
  let activity = "", ly: [number, number] | null = null;
  if (ch && n) {
    const ys = ch.yr.slice(p.t0, p.t1).filter(Boolean);
    if (ys.length >= 3 && !g.meta.sample) ly = [Math.min(...ys), Math.max(...ys)];
    if (ys.length) { const y0 = Math.min(...ys), cnt = new Array(Math.max(...ys) - y0 + 1).fill(0); ys.forEach((y) => cnt[y - y0]++); activity = hist(cnt, y0, "ACTIVITY PER YEAR"); }
  }
  const order = ch ? satelliteOrder(pi) : [];
  const hits = ch ? setsWith(p.s, new Set(order.map((i) => ch.yt[i])), again) : [];
  // the labels round it: the next ones out from this one in the star's list
  const others = sys.filter((q) => q !== pi).sort((a, b) => Math.abs(sys.indexOf(a) - rank) - Math.abs(sys.indexOf(b) - rank)).slice(0, SHELF);
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
  const tracksPart = !ch ? `<div>${shelfHead("TRACKS", n + (p.v?.[1] ?? 0))}<p class="note">LOADING…</p></div>`
    : planetOpen === pi
      ? `<div><div class="ph-sub shelf-h"><span>TRACKS · SHUFFLED</span><span><button type="button" class="out" data-shuffle="${pi}" title="Another random order">↻ SHUFFLE</button> <button type="button" class="out" data-back="1">← BACK</button></span></div><div class="list">${order.slice(0, 150).map((i, k) => trackItem(p.s, i, k + 1)).join("")}</div>
        ${n > 150 ? `<div class="more">150 of ${fmt(n)} at random: ↻ for others, or zoom in on the planet to see them all.</div>` : ""}${p.v ? `<div class="more">+ ${fmt(p.v[1])} more in the vault, off the map: SOLARIS STATION plays them too.</div>` : ""}</div>`
      : `<div><div class="ph-sub shelf-h"><span>TRACKS</span><span><button type="button" class="out" data-shuffle="${pi}" title="Others at random">↻</button> <button type="button" class="out" data-all="tracks">ALL ${fmt(n + (p.v?.[1] ?? 0))} →</button></span></div><div class="shelf">${order.slice(0, SHELF).map((i) => trackCover(p.s, i)).join("")}</div></div>`;
  return {
    code: `PLANET // PL-${pad(pi, 4)}`, title: p.name.toUpperCase(),
    html: `<div class="hero"><div class="frame" id="hero"><canvas></canvas></div>
        <div class="ident"><span class="code">PL-${pad(pi, 4)} // <button class="link" data-r="${R({ kind: "star", s: p.s })}">${esc(s.name.toUpperCase())}</button></span><h2 id="dosTitle"></h2><span class="stamp">${p.yr[0] || "????"}–${p.yr[1] || "????"} · ${fmt(p.n)} REL</span></div></div>
      ${tracksPart}
      ${inSetsShelf(hits, "IN DJ SETS")}
      ${others.length ? `<div>${shelfHead(`MORE IN ${s.name.toUpperCase()}`, sys.length - 1)}<div class="shelf">${others.map((q) => `<button class="shelf-i pl" data-r="${R({ kind: "planet", p: q })}"><canvas data-pl="${q}"></canvas><span class="nm">${esc(g.planets[q].name)}</span><small>${fmt(g.planets[q].n)} REL</small></button>`).join("")}</div></div>` : ""}
      <details class="about star-about"><summary>ABOUT THE LABEL</summary>
        <div class="rows"><div class="row"><span>ORBIT</span><button class="link" data-r="${R({ kind: "star", s: p.s })}">${esc(s.name.toUpperCase())}</button></div>${row("TYPE", `<span title="${esc(planetType(pi))}">${PTYPE_INFO[ty][0] + (ty === "giant" && g.ringed[pi] ? " · RINGED" : "")}</span>`)}${row("SIZE RANK", `#${rank} OF ${fmt(sys.length)}`)}${row("POSITION", `${ordinal(g.orbitNo[pi]).toUpperCase()} FROM THE STAR`)}${row("RELEASES", fmt(p.n))}${row("TRACKS", p.v ? `${fmt(n + p.v[1])} · ${fmt(n)} ON THE MAP` : fmt(n))}${row("ACTIVE", p.ay ? `${p.ay} OF ${spanOf(p) + 1} YEARS` : `${spanOf(p) + (p.yr[0] ? 1 : 0)} YEARS`)}</div>
        ${activity}</details>
      ${ch && n && !g.meta.sample ? `<button class="play" data-orbit="${pi}">▶ SOLARIS STATION<small class="sub">this label as an endless radio</small></button>` : ""}
      ${ly ? `<button class="plot crt" data-years="${pi}"><span>⟶ TIME WARP · ${ly[0]}–${ly[1]}</span><small class="sub">the label’s story, a track a year</small></button>` : ""}`,
  };
}

function track(o: { kind: "track"; s: number; i: number }) {
  const g = galaxy, ch = chunk(o.s)!, s = g.stars[o.s], pi = ch.p[o.i], p = pi >= 0 ? g.planets[pi] : null, yt = ch.yt[o.i];
  const near = nearestTracks(o, SHELF), on = beacons.has(o);
  const again = () => { if (state.sel === o) renderDossier(); };
  const hits = setsWith(o.s, new Set([yt]), again);
  const mates = p ? satelliteOrder(pi).filter((i) => i !== o.i).slice(0, SHELF) : [];
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
  return {
    code: `OBJECT // ${trackCode(o.s, o.i)}`, title: ch.t[o.i].toUpperCase(),
    html: `<div class="hero"><div class="frame thumb" id="hero"><img alt="" src="https://i.ytimg.com/vi/${esc(yt)}/default.jpg" referrerpolicy="no-referrer"><span class="raster"></span></div>
        <div class="ident"><span class="code">${trackCode(o.s, o.i)} // TRACK</span><h2 id="dosTitle"></h2><span class="by">${esc(ch.an[ch.a[o.i]])}${ch.yr[o.i] ? ` · ${ch.yr[o.i]}` : ""}</span></div></div>
      <div class="chips trail">${p ? `<button data-r="${R({ kind: "planet", p: pi })}" style="--c:${s.color}">◍ ${esc(p.name)}</button>` : `<span class="chip-s">ASTEROID BELT${ore.has(yt) ? " · ORE MINED" : ""}</span>`}<button data-r="${R({ kind: "star", s: o.s })}" style="--c:${s.color}">✶ ${esc(s.name)}</button></div>
      <div class="scope-c"><canvas id="wave"></canvas></div>
      ${inSetsShelf(hits, "PLAYED IN DJ SETS")}
      ${mates.length ? `<div>${shelfHead(`MORE ON ${p!.name.toUpperCase()}`, p!.t1 - p!.t0 - 1)}<div class="shelf">${mates.map((i) => trackCover(o.s, i)).join("")}</div></div>` : ""}
      ${near.length ? `<div>${shelfHead("NEAREST SIGNALS", near.length)}<div class="shelf">${near.map((r) => trackCover(r.s, r.i)).join("")}</div></div>` : ""}
      ${g.meta.sample ? `<p class="note">TEST SIGNAL: videos won't play.</p>` : `<button class="play" data-r="${R(o)}" data-play="1">${isNowPlaying(o.s, o.i) ? "◉ ON AIR" : "▶ PLAY"}</button>`}
      <button class="plot like${on ? " on" : ""}" data-like="1">${beaconLabel(on)}</button>
      <button class="plot like lists" data-lists="1" aria-haspopup="true" title="Put this track in one of your lists (⇧L)">${ICON.list}<span>ADD TO LIST</span></button>
      <div class="outs"><button type="button" class="out" data-share="copy" title="Copy a link to this track">COPY LINK ⧉</button><button type="button" class="out" data-share="send" title="Post this track to COMMS, as a card">SEND TO COMMS ⇪</button><a class="out" href="https://www.youtube.com/watch?v=${esc(yt)}" target="_blank" rel="noopener">OPEN ON YOUTUBE ↗</a></div>`,
  };
}

export function renderDossier() {
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
  scramble($("dosId"), v.code); scramble(document.getElementById("dosTitle"), v.title);
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
    liveChanged: () => { if (state.sel?.kind === "star" && (state.live.has(state.sel.s) || document.querySelector(".dossier .live-row"))) renderDossier(); },
    oreFound: (n) => { say(`ORE MINED · ${n} ${n === 1 ? "ROCK" : "ROCKS"} DUG UP SO FAR`); renderDossier(); },
  });
  const click = (e: Event) => {
    const t = e.target as HTMLElement;
    const ps = t.closest<HTMLElement>("[data-route-star]"); if (ps) { startPick(+ps.dataset.routeStar!, "star"); return; }
    const sy = t.closest<HTMLElement>("[data-system]"); if (sy) { playSystem(+sy.dataset.system!); return; }
    const yr = t.closest<HTMLElement>("[data-years]"); if (yr) { playLightYears(+yr.dataset.years!); return; }
    const nb = t.closest<HTMLElement>("[data-neb]"); if (nb) { flyToNebula(+nb.dataset.neb!); return; }
    const po = t.closest<HTMLElement>("[data-orbit]"); if (po) { playOrbit(+po.dataset.orbit!); return; }
    const sf = t.closest<HTMLElement>("[data-shuffle]"); if (sf) { reshuffle(+sf.dataset.shuffle!); renderDossier(); return; }
    const al = t.closest<HTMLElement>("[data-all]");
    if (al && al.dataset.all === "tracks" && state.sel?.kind === "planet") { planetOpen = state.sel.p; renderDossier(); return; }
    if (al && state.sel?.kind === "star") { opened = { si: state.sel.s, what: al.dataset.all as "sets" | "labels" }; renderDossier(); return; }
    if (t.closest("[data-back]")) { opened = null; planetOpen = -1; renderDossier(); return; }
    const ms = t.closest<HTMLElement>("[data-more-sets]");
    if (ms) {
      const si = +ms.dataset.moreSets!, d = $("detail"), top = d.scrollTop;
      setsShown.set(si, (setsShown.get(si) ?? SETS_STEP) + SETS_STEP); renderDossier(); d.scrollTop = top; return;
    }
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
