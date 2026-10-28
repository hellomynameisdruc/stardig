// The pilot card and the header key: SIGN IN (Google, or a link sent to the email — no passwords),
// or the pilot's portrait and call sign; in the card, the call sign, the portrait and its traits,
// signing out and deleting the account. The data lives in cloud/pilots.ts.
import { esc } from "../core/util";
import { $ } from "../core/dom";
import { beacons, ore } from "../app/state";
import { flightsTotal, onPromoted } from "../cloud/sync";
import { cloudWanted } from "../cloud/client";
import { deleteAccount, newPortrait, onPilot, onSignInReturn, pilot, redeemInvite, sendSignInLink, setNick, signInGoogle, signOut, wake } from "../cloud/pilots";
import { beta, openName } from "../app/beta";
import { avatarSvg, avatarTraits } from "./avatar";
import { EARNED, rankTag, RANKS } from "./ranks";
import { say } from "./rail";
import { closeModal, openModal } from "./modal";

let note = "", sentTo = "", confirmDelete = false, busy = false;
const GOOGLE_G = `<svg viewBox="0 0 14 14" aria-hidden="true" shape-rendering="crispEdges"><path fill="currentColor" d="M5 1h5v1h2v1h-2v1H9V3H5v1H4v1H3v4h1v1h1v1h4v-1h1V9H7V7h5v4h-1v1h-1v1H5v-1H3v-1H2v-1H1V4h1V3h1V2h2z"/></svg>`;

function paintButton() {
  const b = $("pilotBtn"), me = pilot.me;
  b.innerHTML = me ? `${avatarSvg(me.avatar, 16)}<span>${esc(me.nick.toUpperCase())}</span>` : `<span>SIGN IN</span>`;
  b.title = me ? "Your pilot profile" : "Sign in to chat in COMMS";
}

/** the next earned rank and how far off it is */
function nextRank(rank?: string) {
  const at = EARNED.findIndex((e) => e.rank === rank);
  if (rank && rank !== "cadet" && at < 0) return ""; // a given rank
  const nx = EARNED[at + 1]; if (!nx) return `<p class="pl-small">TOP OF THE LADDER. RESPECT.</p>`;
  const f = flightsTotal(), o = ore.size, k = Math.min(1, Math.max(f / nx.flights, o / nx.ore));
  return `<div class="pl-next"><span>NEXT: <b style="color:${RANKS[nx.rank].color}">${RANKS[nx.rank].badge} ${RANKS[nx.rank].label}</b> · ${f}/${nx.flights} FLIGHTS OR ${o}/${nx.ore} ORE</span><i style="--k:${(k * 100).toFixed(0)}%"></i></div>`;
}

function body() {
  const me = pilot.me;
  if (me) return `<div class="pl-id">${avatarSvg(me.avatar, 96, "ava big")}
      <div class="pl-f">
        <label for="plNick">CALL SIGN ${rankTag(me.rank)}</label>
        <div class="row-in"><input class="field" id="plNick" value="${esc(me.nick)}" maxlength="20" autocomplete="off" spellcheck="false"><button type="button" class="key" id="plSave">SAVE</button></div>
        <button type="button" class="key" id="plFace">↻ NEW PORTRAIT</button>
        <p class="pl-traits">${avatarTraits(me.avatar).map((t) => esc(t.toUpperCase())).join(" · ")}</p>
      </div></div>
    ${nextRank(me.rank)}
    <dl class="pl-stats"><dt>BEACONS</dt><dd>${beacons.size}</dd><dt>FLIGHTS LOGGED</dt><dd>${flightsTotal()}</dd><dt>ORE MINED</dt><dd>${ore.size}</dd>${beta.on ? `<dt>ACCESS</dt><dd>${me.access || me.admin ? "OPEN" : "WAITING"}</dd>` : ""}<dt>EMAIL</dt><dd>${esc(pilot.session?.user.email ?? "")}</dd></dl>
    ${beta.on && !me.access && !me.admin ? `<div class="pl-beta"><p class="pl-text">CLOSED BETA · WAITING FOR ACCESS</p>
      <p class="pl-small">The ${esc(openName())} star is open to everyone. The rest of the map, COMMS and broadcasting open once the founder lets you in, or with an invite code:</p>
      <form class="row-in" id="plInv"><input class="field" id="plCode" placeholder="INVITE CODE" maxlength="16" autocomplete="off" spellcheck="false" autocapitalize="characters"><button class="key hot" ${busy ? "disabled" : ""}>ENTER ▸</button></form></div>` : ""}
    <p class="pl-small">Beacons, the flight log and your ore are kept with your account, on every device you sign in on.</p>
    <div class="pl-foot"><button type="button" class="key" id="plOut">SIGN OUT</button>
      <button type="button" class="key danger" id="plDel">${confirmDelete ? "CONFIRM: DELETE FOREVER" : "DELETE ACCOUNT"}</button></div>`;
  if (pilot.session) return `<p class="pl-text">CONNECTING TO THE PILOT REGISTRY…</p>`;
  if (sentTo) return `<p class="pl-text">A SIGN-IN LINK IS ON ITS WAY TO <b>${esc(sentTo)}</b>.</p><p class="pl-small">Open it in this browser. No mail? Check spam, or wait a minute and try again.</p>
    <div class="pl-foot"><button type="button" class="key" id="plAgain">USE ANOTHER EMAIL</button></div>`;
  return `${beta.on ? `<p class="pl-small pl-betanote">CLOSED BETA: sign in, then wait for the founder to let you in, or enter an invite code.</p>` : ""}<button type="button" class="key hot pl-google" id="plGoogle" ${busy ? "disabled" : ""}>${GOOGLE_G}SIGN IN WITH GOOGLE</button>
    <p class="pl-or">OR A LINK SENT TO YOUR EMAIL, NO PASSWORD</p>
    <form class="row-in" id="plForm"><input class="field" id="plMail" type="email" required placeholder="you@example.com" autocomplete="email" spellcheck="false"><button class="key hot" ${busy ? "disabled" : ""}>SEND LINK ▸</button></form>`;
}

function render() {
  const el = $("pilotBox");
  if (!el.firstChild) {
    el.innerHTML = `<div class="card pl-card" role="document">
      <div class="card-head"><span class="inv">PILOT</span><span id="plTitle"></span><button type="button" class="key icon sm" id="plClose" aria-label="Close">×</button></div>
      <div class="modal-rail" role="status" aria-live="polite" hidden></div>
      <div class="pl-body" id="plBody"></div>
      <p class="pl-small pl-priv">We keep your email (to sign you in), your call sign, portrait number and the messages you send. Deleting the account removes all of it. <a href="./privacy.html" target="_blank" rel="noopener">Privacy</a></p>
    </div>`;
    $("plClose").onclick = closePilot;
  }
  $("plTitle").textContent = pilot.me ? "REGISTRY // PROFILE" : "REGISTRY // SIGN IN";
  $("plBody").innerHTML = body() + (note ? `<p class="fmsg err" role="alert">${esc(note)}</p>` : "");
  const on = (id: string, f: () => void) => { const b = document.getElementById(id); if (b) b.onclick = f; };
  on("plAgain", () => { sentTo = ""; note = ""; render(); });
  on("plSave", saveNick);
  on("plFace", async () => { const e = await newPortrait(); if (e) fail(`Could not save: ${e}`); else { note = ""; say("New portrait saved"); } });
  on("plOut", async () => { await signOut(); note = ""; sentTo = ""; say("Signed out"); });
  on("plDel", removeAccount);
  on("plGoogle", google);
  const inv = document.getElementById("plInv") as HTMLFormElement | null;
  if (inv) inv.onsubmit = (e) => { e.preventDefault(); invite(); };
  const f = document.getElementById("plForm") as HTMLFormElement | null;
  if (f) f.onsubmit = (e) => { e.preventDefault(); sendLink(); };
  const n = document.getElementById("plNick") as HTMLInputElement | null;
  if (n) n.onkeydown = (e) => { if (e.key === "Enter") saveNick(); };
}
const fail = (text: string) => { note = text.toUpperCase(); render(); };

async function google() {
  busy = true; note = ""; render();
  const e = await signInGoogle(); busy = false;
  if (e) fail(e === "google-off" ? "Google sign-in is not switched on yet" : `Could not sign in: ${e}`);
}
async function sendLink() {
  const mail = ($("plMail") as HTMLInputElement).value.trim(); if (!mail || busy) return;
  busy = true; note = ""; render();
  const e = await sendSignInLink(mail); busy = false;
  if (e) fail(e.startsWith("busy:") ? `The mail service is busy: ${e.slice(5)}` : `Could not send: ${e}`);
  else { sentTo = mail; render(); }
}
async function invite() {
  const code = ($("plCode") as HTMLInputElement).value.trim(); if (!code || busy) return;
  busy = true; note = ""; render();
  const r = await redeemInvite(code); busy = false;
  if (r === true) { note = ""; render(); say("Access granted. Welcome aboard"); return; }
  fail(r === false ? "That code doesn't work: used up or mistyped" : `Could not check the code: ${r}`);
}
async function saveNick() {
  const me = pilot.me; if (!me) return;
  const v = ($("plNick") as HTMLInputElement).value.trim(); if (v === me.nick) return;
  const e = await setNick(v);
  if (!e) { note = ""; say(`Call sign saved: ${v}`); return; }
  fail(e === "invalid" ? "Call sign: 3–20 letters, digits, . _ or -" : e === "taken" ? "That call sign is taken" : `Could not save: ${e}`);
}
async function removeAccount() {
  if (!confirmDelete) { confirmDelete = true; render(); return; }
  confirmDelete = false;
  const e = await deleteAccount();
  if (e) fail(`Could not delete: ${e}`); else { note = ""; say("Account deleted"); }
}

export function openPilot() {
  confirmDelete = false; render();
  openModal($("pilotBox"), closePilot, { focus: document.getElementById("plMail") ?? document.getElementById("plGoogle") });
  wake(); // connect while the email is typed
}
function closePilot() { closeModal($("pilotBox")); note = ""; confirmDelete = false; }
const pilotOpen = () => !$("pilotBox").hidden;

export function initPilot() {
  paintButton();
  onPilot(() => { paintButton(); if (pilotOpen()) render(); });
  onPromoted((r) => say(`Promoted: you're ${RANKS[r]?.label ?? r.toUpperCase()} now`));
  onSignInReturn((failure) => {
    if (!failure) { say(`Signed in. Welcome aboard, ${pilot.me?.nick ?? "pilot"}`); return; }
    note = failure === "no-session" ? "SIGN-IN FAILED. OPEN THE LINK IN THE SAME BROWSER YOU ASKED FOR IT IN, OR ASK FOR A NEW ONE." : `SIGN-IN FAILED: ${failure}`.toUpperCase();
    openPilot();
  });
  $("pilotBtn").onclick = () => (pilotOpen() ? closePilot() : openPilot());
  if (cloudWanted()) wake();
}
