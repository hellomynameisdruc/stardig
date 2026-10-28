// Saving a beacon list as a real playlist in the visitor's own YouTube account.
// Google's sign-in window (a popup: the music keeps playing) asks once for leave to manage their YouTube;
// the access it gives lasts an hour and is kept only in memory. The playlist's id and the tracks already
// sent are kept with the list, so saving again only adds what's new.
// YouTube allows the whole site ~10 000 units a day; adding a track costs 50. When they run out, what's
// sent so far stays, and the rest goes next time.
import { beacons } from "../app/state";

/** the site's Google sign-in client (a public id, not a secret). Empty: the feature stays hidden. */
const GOOGLE_CLIENT_ID = "2800189413-srtqe3cg5ba844u7u247nsrmquh6iubd.apps.googleusercontent.com";
const SCOPE = "https://www.googleapis.com/auth/youtube";
const API = "https://www.googleapis.com/youtube/v3";

export const youtubeReady = () => !!GOOGLE_CLIENT_ID;

type TokenClient = { requestAccessToken: (o?: { prompt?: string }) => void };
type GIS = { accounts: { oauth2: { initTokenClient: (c: { client_id: string; scope: string; callback: (r: { access_token?: string; expires_in?: number; error?: string }) => void; error_callback?: (e: { type?: string }) => void }) => TokenClient } } };
let token = "", until = 0, gis: Promise<GIS> | null = null;

function loadGis(): Promise<GIS> {
  return gis ??= new Promise((ok, no) => {
    const w = window as unknown as { google?: GIS };
    if (w.google?.accounts?.oauth2) { ok(w.google); return; }
    const s = document.createElement("script"); s.src = "https://accounts.google.com/gsi/client"; s.async = true;
    s.onload = () => (w.google?.accounts?.oauth2 ? ok(w.google) : no(new Error("google")));
    s.onerror = () => { gis = null; no(new Error("google")); };
    document.head.appendChild(s);
  });
}
/** call from a click (the popup needs one) */
async function access(): Promise<string> {
  if (token && Date.now() < until - 60_000) return token;
  const g = await loadGis();
  return new Promise((ok, no) => {
    const c = g.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID, scope: SCOPE,
      callback: (r) => { if (!r.access_token) { no(new Error(r.error || "denied")); return; } token = r.access_token; until = Date.now() + (r.expires_in ?? 3600) * 1000; ok(token); },
      error_callback: (e) => no(new Error(e.type === "popup_closed" ? "denied" : e.type || "denied")),
    });
    c.requestAccessToken();
  });
}

class YtError extends Error { constructor(public status: number, public reason: string) { super(reason); } }
async function call(path: string, init: RequestInit = {}) {
  const r = await fetch(`${API}/${path}`, { ...init, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init.headers ?? {}) } });
  if (r.ok) return r.json();
  const j = await r.json().catch(() => ({})) as { error?: { errors?: { reason?: string }[]; status?: string } };
  throw new YtError(r.status, j.error?.errors?.[0]?.reason ?? j.error?.status ?? String(r.status));
}

export type SaveResult = { ok: true; url: string; added: number; left: number } | { ok: false; why: "denied" | "quota" | "nochannel" | "failed"; url?: string; added?: number; left?: number };
/** send a list to YouTube: make its playlist if it has none (or it was deleted there), then add what's new */
export async function saveToYouTube(id: string, progress: (done: number, total: number) => void): Promise<SaveResult> {
  try { await access(); } catch { return { ok: false, why: "denied" }; }
  const l = beacons.getList(id); if (!l) return { ok: false, why: "failed" };
  let yt = l.yt, sent = new Set(l.sent ?? []);
  try {
    if (yt) { const r = await call(`playlists?part=id&id=${encodeURIComponent(yt)}`) as { items?: unknown[] }; if (!r.items?.length) { yt = undefined; sent = new Set(); } }
    if (!yt) {
      const r = await call("playlists?part=snippet,status", { method: "POST", body: JSON.stringify({ snippet: { title: `stardig · ${l.name}`, description: "Beacons from stardig.app, a map of electronic music." }, status: { privacyStatus: "private" } }) }) as { id: string };
      yt = r.id; beacons.setYouTube(id, yt, []);
    }
  } catch (e) {
    const why = e instanceof YtError ? (e.reason === "quotaExceeded" ? "quota" : e.reason === "youtubeSignupRequired" || e.reason === "channelNotFound" ? "nochannel" : e.status === 401 ? "denied" : "failed") : "failed";
    if (e instanceof YtError && e.status === 401) token = "";
    return { ok: false, why };
  }
  const url = `https://www.youtube.com/playlist?list=${yt}`;
  const todo = l.items.map((b) => b.y).filter((y) => !sent.has(y)); // in the list's order, newest first
  let added = 0;
  for (const y of todo) {
    progress(added, todo.length);
    try {
      await call("playlistItems?part=snippet", { method: "POST", body: JSON.stringify({ snippet: { playlistId: yt, resourceId: { kind: "youtube#video", videoId: y } } }) });
      added++; sent.add(y);
    } catch (e) {
      if (e instanceof YtError && (e.status === 404 || e.reason === "videoNotFound" || e.reason === "forbidden")) { sent.add(y); continue; } // gone or private on YouTube: skip it for good
      beacons.setYouTube(id, yt, [...sent]);
      return { ok: false, why: e instanceof YtError && e.reason === "quotaExceeded" ? "quota" : "failed", url, added, left: todo.length - added };
    }
    if (added % 5 === 0) beacons.setYouTube(id, yt, [...sent]);
  }
  beacons.setYouTube(id, yt, [...sent]);
  return { ok: true, url, added, left: 0 };
}
