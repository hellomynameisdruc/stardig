// Supabase Edge Function "live-sets": which of the set channels (pipeline/set_channels.json) is streaming
// right now, and in which styles. Called every 5 minutes by pg_cron (supabase/live-sets.sql); writes the
// table live_sets, which the map reads (web/src/cloud/live.ts) to light up those stars.
// Needs the function secret YT_API_KEY (Edge Functions → Secrets): the same YouTube Data API key as on GitHub.
// Uses per run: each channel's public feed (no quota) and one videos call per 50 of their newest videos —
// about 4 quota units for 50 channels.
import { createClient } from "jsr:@supabase/supabase-js@2";

const SITE = "https://stardig.app/data/sets/";
const API = "https://www.googleapis.com/youtube/v3/";

type Djs = { stars: string[]; a: Record<string, [number, number][]> };
let djs: Djs | null = null, djsAt = 0;

const deaccent = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "");
const norm = (s: string) => deaccent(s).replace(/[^0-9a-z]+/g, "");
const spaced = (s: string) => deaccent(s.replace(/&/g, " and ")).replace(/[^0-9a-z]+/g, " ").trim();
// who plays: the head of the title, before the venue, split into names (as djs() in build_sets.py)
const HEAD = /\s*(?:\||@|\/|:|\(|\[|\s(?:at|for|live|in the lab|returns to|takeover)\b)\s*/i;
const NAMES = /\s*(?:\bb2b\b|\bx\b|&|,|\s[-–—]\s|\bw\/|\bwith\b|\band\b)\s*/i;
const NOT_DJ = new Set(["boilerroom", "djset", "liveset", "fullset", "set", "mix", "live", "dj", "hr", "hor", "hoer", "cercle", "mixmag", "intro", "outro"]);

function place(title: string, channel: string, fallback: string | undefined, d: Djs): string[] {
  const score = new Map<number, number>(), add = (si: number, w: number) => score.set(si, (score.get(si) ?? 0) + w);
  const head = title.split(HEAD)[0].replace(/\b(?:dj set|live set|full set|techno set|house set|set)\b.*$/i, "");
  for (const n of head.split(NAMES).map(norm)) {
    if (n.length < 3 || NOT_DJ.has(n) || n === norm(channel)) continue;
    for (const [si, w] of d.a[n] ?? []) add(si, w);
  }
  const t = ` ${spaced(title)} `;
  d.stars.forEach((name, si) => { const n = spaced(name); if (norm(name).length >= 4 && t.includes(` ${n} `)) add(si, 3 + n.length / 10); });
  const top = [...score.entries()].sort((a, b) => b[1] - a[1]);
  if (top.length && top[0][1] >= 2) return top.filter(([, s], k) => k < 2 && s >= top[0][1] * 0.5).map(([si]) => d.stars[si]);
  return fallback ? [fallback] : [];
}

const yt = async (path: string, q: Record<string, string>) => {
  const r = await fetch(`${API}${path}?${new URLSearchParams({ ...q, key: Deno.env.get("YT_API_KEY")! })}`);
  return r.ok ? await r.json() : { items: [] };
};

Deno.serve(async () => {
  const index = await (await fetch(SITE + "index.json")).json() as { channels: Record<string, string>; style?: Record<string, string> };
  if (!djs || Date.now() - djsAt > 6 * 3600e3) { djs = await (await fetch(SITE + "djs.json")).json() as Djs; djsAt = Date.now(); }
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}").default;
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, key);
  // a stream on air is among a channel's newest videos: read from its public feed (free, no quota), and the
  // streams already on the map are looked at again
  const chanOf = new Map<string, string>();
  await Promise.all(Object.entries(index.channels).map(async ([name, cid]) => {
    try {
      const r = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${cid}`);
      if (!r.ok) return;
      const ids = [...(await r.text()).matchAll(/<yt:videoId>([\w-]{11})<\/yt:videoId>/g)].slice(0, 4).map((m) => m[1]);
      for (const id of ids) chanOf.set(id, name);
    } catch { /* that channel next time */ }
  }));
  const { data: onAir } = await sb.from("live_sets").select("v");
  for (const r of onAir ?? []) if (!chanOf.has(r.v)) chanOf.set(r.v, "");
  const ids = [...chanOf.keys()];
  const now = new Date().toISOString(), rows = [];
  for (let k = 0; k < ids.length; k += 50) {
    const r = await yt("videos", { part: "snippet,liveStreamingDetails,status", id: ids.slice(k, k + 50).join(",") });
    for (const v of r.items ?? []) {
      if (v.snippet?.liveBroadcastContent !== "live" || v.status?.embeddable === false) continue;
      const ch = chanOf.get(v.id) || v.snippet.channelTitle;
      const stars = place(v.snippet.title, ch, index.style?.[ch], djs!);
      if (!stars.length) continue;
      rows.push({ v: v.id, t: v.snippet.title, c: v.snippet.channelTitle, stars, viewers: +(v.liveStreamingDetails?.concurrentViewers ?? 0), started: v.liveStreamingDetails?.actualStartTime ?? now, seen: now });
    }
  }
  if (rows.length) { const { error } = await sb.from("live_sets").upsert(rows); if (error) return new Response(error.message, { status: 500 }); }
  await sb.from("live_sets").delete().lt("seen", now); // off air
  return Response.json({ checked: ids.length, live: rows.map((r) => `${r.c}: ${r.t} → ${r.stars.join(", ")}`) });
});
