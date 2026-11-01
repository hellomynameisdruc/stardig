// COMMS commands, the same in the observatory's COMMS and on the founder's console (comms.html):
// /help and /ranks for everyone, /avatar for a pilot's own portrait, and the founder's — the closed beta
// (/waiting, /approve, /approve all, /revoke, /invite), ranks (/rank) and SYSTEM (/sys, /tip, /pilots,
// /welcome). The map is loaded only for a command that needs it (/tip, /pilots).
import { grantRank, systemSay } from "../cloud/comms";
import { approveAll, crewCount, grantAccess, makeInvite, newPortrait, pilot, waitingPilots } from "../cloud/pilots";
import { EARNED, GIVEN, rankKey, RANKS } from "./ranks";

export type Io = { tell: (text: string, kind?: "err" | "info") => void; done: (said?: string) => void };

/** the founder's list of pilots waiting for access, as a note */
export async function waitingNote(): Promise<[string, "err" | "info"]> {
  const list = await waitingPilots();
  if (!list) return ["Could not read the registry (has the closed-beta SQL been run?)", "err"];
  const ago = (t: string) => { const m = Math.round((Date.now() - Date.parse(t)) / 60000); return m < 60 ? `${m}m` : m < 2880 ? `${Math.round(m / 60)}h` : `${Math.round(m / 1440)}d`; };
  return [list.length ? `Waiting for access (${list.length}): ${list.map((p) => `${p.nick} · ${ago(p.created_at)}`).join(" / ")}. Let one in: /approve CALLSIGN, or all: /approve all` : "Nobody is waiting for access", "info"];
}

/** run a command typed in COMMS; io says how it went (tell: a note over the input; done: clear the input,
 *  and a line on the rail if there's one to say) */
export async function runCommand(text: string, io: Io) {
  const { tell } = io, [cmd, nick, ...rest] = text.slice(1).trim().split(/\s+/);
  if (cmd === "ranks" || cmd === "help") { io.done(); tell(`Earned by digging: ${EARNED.map((e) => RANKS[e.rank].label).join(" › ")}. Given by the founder: ${GIVEN.map((k) => RANKS[k].label).join(" · ")} (/rank CALLSIGN RANK). Closed beta: /waiting · /approve CALLSIGN · /approve all · /revoke CALLSIGN · /invite [PILOTS]. SYSTEM: /sys TEXT · /tip [STYLE] · /pilots · /welcome CALLSIGN. Your portrait: /avatar beard · /avatar back`, "info"); return; }
  // the closed beta (the founder): let a pilot in or out, make an invite code
  if (cmd === "waiting") { io.done(); const w = await waitingNote(); tell(w[0], w[1]); return; }
  if (cmd === "approve" && nick?.toLowerCase() === "all") {
    const res = await approveAll();
    if ("error" in res) { tell(res.error === "not-authorised" ? "Only the founder lets pilots in" : res.error === "missing" ? "/approve all needs stardig-system.sql run in Supabase" : `Failed: ${res.error}`); return; }
    io.done(res.n ? `${res.n} ${res.n === 1 ? "pilot is" : "pilots are"} in: full access` : "Nobody is waiting"); return;
  }
  if (cmd === "approve" || cmd === "revoke") {
    if (!nick) { tell(`Who? /${cmd} CALLSIGN`); return; }
    const res = await grantAccess(nick, cmd === "approve");
    if ("error" in res) { tell(res.error === "not-authorised" ? "Only the founder lets pilots in" : res.error === "no-such-pilot" ? `No pilot called ${nick}` : `Failed: ${res.error}`); return; }
    io.done(cmd === "approve" ? `${res.nick} is in: full access` : `${res.nick} is back to the open galaxy only`); return;
  }
  if (cmd === "invite") {
    const n = Math.max(1, Math.min(1000, parseInt(nick ?? "1", 10) || 1)), res = await makeInvite(n);
    if ("error" in res) { tell(res.error === "not-authorised" ? "Only the founder makes invites" : `Failed: ${res.error}`); return; }
    io.done(); await navigator.clipboard.writeText(res.code).catch(() => {});
    tell(`Invite code ${res.code} · good for ${n} ${n === 1 ? "pilot" : "pilots"} · copied`, "info"); return;
  }
  // SYSTEM, the station's voice (the founder's): an announcement, a track, the crew, a welcome
  if (cmd === "sys" || cmd === "tip" || cmd === "pilots" || cmd === "welcome") {
    const arg = text.slice(1).trim().slice(cmd.length).trim();
    let out = "";
    if (cmd === "sys") { if (!arg) { tell("What should SYSTEM say? /sys TEXT"); return; } out = arg; }
    else if (cmd === "welcome") { if (!arg) { tell("Who? /welcome CALLSIGN"); return; } out = `◆ NEW PILOT IN THE RANKS: ${arg.toUpperCase()}. WELCOME ABOARD, CLEAR SKIES AND GOOD DIGGING.`; }
    else if (cmd === "pilots") { const { galaxy } = await import("../app/state"); const n = await crewCount().catch(() => null); if (n === null) { tell("The registry didn't answer. Try again"); return; } out = `◆ ${n} ${n === 1 ? "PILOT" : "PILOTS"} IN THE RANKS. THE MAP HAS ${galaxy.stars.length} STARS TO DIG.`; }
    else {
      // a random track: from the style named, or from anywhere (bigger styles more often)
      const { galaxy, tracks } = await import("../app/state"), { signalLink } = await import("../app/signal");
      let s = arg ? galaxy.stars.findIndex((x) => x.name.toLowerCase() === arg.toLowerCase()) : -1;
      if (arg && s < 0) { tell(`No style called ${arg}`); return; }
      if (s < 0) { const tot = galaxy.stars.reduce((a, x) => a + x.tracks, 0); let r = Math.random() * tot; s = galaxy.stars.findIndex((x) => (r -= x.tracks) < 0); if (s < 0) s = 0; }
      const ch = await tracks.load(s).catch(() => null); const n = ch ? ch.n0 ?? ch.yt.length : 0;
      if (!ch || !n) { tell("Couldn't reach that style's tracks. Try again"); return; }
      const i = Math.floor(Math.random() * n), who = ch.an[ch.a[i]];
      out = `${`♪ ${ch.t[i]}${who ? ` — ${who}` : ""}`.slice(0, 200)}\n${signalLink(s, i)}`;
    }
    const e = await systemSay(out);
    if (e) { tell(e === "not-authorised" ? "Only the founder speaks as SYSTEM" : e === "missing" ? "SYSTEM can't speak yet: run stardig-system.sql in Supabase" : `Failed: ${e}`); return; }
    io.done(); return;
  }
  // a pilot's own look: the same portrait with black hair and a beard (a negative avatar number), or back
  if (cmd === "avatar") {
    const me = pilot.me!, want = (nick ?? "").toLowerCase(), cur = me.avatar || 1;
    if (want !== "beard" && want !== "back") { tell("/avatar beard: black hair and a beard · /avatar back: as it was", "info"); return; }
    const e = await newPortrait(want === "beard" ? -Math.abs(cur) : Math.abs(cur));
    if (e) { tell(`Failed: ${e}`); return; }
    io.done(want === "beard" ? "New look: black hair and a beard" : "Your portrait is as it was"); return;
  }
  if (cmd !== "rank" || !nick || !rest.length) { tell("Unknown command. Try /ranks"); return; }
  const r = rankKey(rest.join(" ")); if (!r) { tell(`No such rank. ${Object.keys(RANKS).join(" · ")}`); return; }
  if (r === "founder") { tell("ARCHITECT is yours alone: it's not given to anyone"); return; }
  const res = await grantRank(nick, r);
  if ("error" in res) { tell(res.error === "not-authorised" ? "Only the founder gives ranks" : res.error === "no-such-pilot" ? `No pilot called ${nick} (or it's you)` : `Failed: ${res.error}`); return; }
  io.done(`${res.nick} is now ${RANKS[r].label}`);
}

