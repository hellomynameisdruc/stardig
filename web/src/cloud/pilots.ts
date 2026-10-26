// The pilot registry, as data: who is signed in (the session and their pilot row), other pilots by id
// as the registry has them, and what a pilot can do to their account. No drawing here: the pilot card
// and the header key (ui/pilot.ts) show it, COMMS and fleets read it.
import type { Session } from "@supabase/supabase-js";
import { cloud } from "./client";

/** access: the closed beta lets this pilot in */
export type Pilot = { id: string; nick: string; avatar: number; rank?: string; admin?: boolean; access?: boolean };
export const NICK = /^[A-Za-z0-9_.-]{3,20}$/;

/** the pilot columns to read; without ranks if the database hasn't got them yet */
let COLS = "id,nick,avatar,rank,admin,access";
export async function readPilots<T>(q: (cols: string) => PromiseLike<{ data: T; error: { message: string } | null }>) {
  let r = await q(COLS);
  if (r.error && /access/.test(r.error.message) && COLS.endsWith(",access")) { COLS = "id,nick,avatar,rank,admin"; r = await q(COLS); }
  if (r.error && /rank|admin/.test(r.error.message) && COLS !== "id,nick,avatar") { COLS = "id,nick,avatar"; r = await q(COLS); }
  return r;
}

export const pilot = { session: null as Session | null, me: null as Pilot | null };
/** pilots seen so far, by id: names, portraits and ranks as the registry has them (never as a client claims) */
export const roster = new Map<string, Pilot>();
export async function lookup(ids: string[]) {
  const need = [...new Set(ids)].filter((id) => id && !roster.has(id) && /^[0-9a-f-]{36}$/.test(id)); if (!need.length) return;
  const sb = await cloud(), { data } = await readPilots((c) => sb.from("pilots").select(c).in("id", need));
  for (const p of (data ?? []) as unknown as Pilot[]) roster.set(p.id, p);
}

const listeners: (() => void)[] = [];
/** the signed-in pilot changed (signed in or out, renamed, new portrait) */
export const onPilot = (fn: () => void) => { listeners.push(fn); };
export const pilotChanged = () => listeners.forEach((f) => f());
let returned: (failure: string | null) => void = () => {};
/** coming back from a sign-in link or Google: null if it worked, else why not */
export const onSignInReturn = (fn: (failure: string | null) => void) => { returned = fn; };

async function loadMe() {
  const s = pilot.session; if (!s) { pilot.me = null; return; }
  const sb = await cloud();
  // the pilot row is made by the database on sign-up; give it a moment on the very first sign-in
  for (let k = 0; k < 4; k++) {
    const { data } = await readPilots((c) => sb.from("pilots").select(c).eq("id", s.user.id).maybeSingle());
    if (data) { pilot.me = data as unknown as Pilot; roster.set(pilot.me.id, pilot.me); return; }
    await new Promise((r) => setTimeout(r, 600));
  }
}

let woke: Promise<void> | null = null;
/** connect once: restore the session, follow sign-ins and sign-outs */
export const wake = () => (woke ??= connect());
async function connect() {
  const sb = await cloud();
  const { data } = await sb.auth.getSession();
  pilot.session = data.session; await loadMe(); pilotChanged();
  sb.auth.onAuthStateChange((_e, s) => {
    if ((s?.user.id ?? null) === (pilot.session?.user.id ?? null)) { pilot.session = s; return; }
    pilot.session = s; loadMe().then(pilotChanged);
  });
  // a sign-in link brought us here: tidy the address, and say how it went
  const q = new URLSearchParams(location.search);
  if (q.has("code") || q.has("error_description")) {
    const err = q.get("error_description");
    history.replaceState(null, "", location.pathname + location.hash);
    returned(err ?? (pilot.session ? null : "no-session"));
  }
}

const back = () => location.origin + location.pathname;
/** each returns null when it worked, or the reason it didn't */
export async function signInGoogle() {
  const { error } = await (await cloud()).auth.signInWithOAuth({ provider: "google", options: { redirectTo: back() } });
  return error ? (/not enabled|provider/i.test(error.message) ? "google-off" : error.message) : null;
}
export async function sendSignInLink(email: string) {
  const { error } = await (await cloud()).auth.signInWithOtp({ email, options: { emailRedirectTo: back() } });
  return error ? (/rate|seconds/i.test(error.message) ? `busy:${error.message}` : error.message) : null;
}
export async function setNick(nick: string) {
  const me = pilot.me; if (!me) return "signed-out";
  if (!NICK.test(nick)) return "invalid";
  const { error } = await (await cloud()).from("pilots").update({ nick }).eq("id", me.id);
  if (error) return error.code === "23505" ? "taken" : error.message;
  me.nick = nick; pilotChanged(); return null;
}
export async function newPortrait() {
  const me = pilot.me; if (!me) return "signed-out";
  const avatar = Math.floor(Math.random() * 2147483647);
  const { error } = await (await cloud()).from("pilots").update({ avatar }).eq("id", me.id);
  if (error) return error.message;
  me.avatar = avatar; pilotChanged(); return null;
}
/** an invite code: true if it let this pilot in */
export async function redeemInvite(code: string): Promise<boolean | string> {
  const { data, error } = await (await cloud()).rpc("redeem_invite", { code: code.trim() });
  if (error) return error.message;
  if (data) { await loadMe(); pilotChanged(); }
  return !!data;
}
/** the founder lets a pilot in (or out): their call sign, or why not */
export async function grantAccess(nick: string, allow: boolean): Promise<{ nick: string } | { error: string }> {
  const { data, error } = await (await cloud()).rpc("grant_access", { target: nick, allow });
  if (error) return { error: /NOT AUTHORISED/.test(error.message) ? "not-authorised" : /NO SUCH PILOT/.test(error.message) ? "no-such-pilot" : error.message };
  for (const p of roster.values()) if (p.nick.toLowerCase() === nick.toLowerCase()) p.access = allow;
  return { nick: String(data) };
}
/** the founder makes an invite code good for `uses` pilots */
export async function makeInvite(uses: number): Promise<{ code: string } | { error: string }> {
  const { data, error } = await (await cloud()).rpc("make_invite", { uses });
  if (error) return { error: /NOT AUTHORISED/.test(error.message) ? "not-authorised" : error.message };
  return { code: String(data) };
}

/** pilots still waiting for access, newest first (the founder's list) */
export async function waitingPilots(): Promise<{ nick: string; created_at: string }[] | null> {
  const { data, error } = await (await cloud()).from("pilots").select("nick,created_at").eq("access", false).eq("admin", false).order("created_at", { ascending: false }).limit(50);
  return error ? null : (data as { nick: string; created_at: string }[]);
}
/** the founder's ear on the registry: a pilot signed up (INSERT) or was let in (UPDATE, access on) */
export async function watchPilots(fn: (kind: "new" | "in", nick: string) => void) {
  const sb = await cloud();
  return sb.channel("comms:pilots", { config: { private: true } })
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "pilots" }, (e) => fn("new", String((e.new as Pilot).nick)))
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "pilots" }, (e) => { const p = e.new as Pilot; if (p.access) fn("in", String(p.nick)); })
    .subscribe();
}

export async function signOut() {
  await (await cloud()).auth.signOut();
  pilot.session = null; pilot.me = null; pilotChanged();
}
export async function deleteAccount() {
  const sb = await cloud(), { error } = await sb.rpc("delete_me");
  if (error) return error.message;
  await sb.auth.signOut().catch(() => {});
  pilot.session = null; pilot.me = null; pilotChanged(); return null;
}

/** how many pilots are in the ranks (let into the beta, or staff); null when the registry can't say */
export async function crewCount(): Promise<number | null> {
  const sb = await cloud(), { count, error } = await sb.from("pilots").select("id", { count: "exact", head: true }).or("access.eq.true,admin.eq.true");
  return error ? null : count ?? null;
}
