// Ranks. The ladder (cadet → admiral) is earned by digging: flights logged or ore mined (see EARNED; the
// database checks it, supabase/ranks-earned.sql). DJ, DIGGER and WARDEN are given by the founder
// (/rank CALLSIGN RANK in COMMS); the founder's own (ARCHITECT) is nobody else's. Each has its own colour
// and badge; colours are fixed, the same in every phosphor, so a rank reads the same for everyone.
export const RANKS: Record<string, { label: string; color: string; badge: string }> = {
  cadet: { label: "CADET", color: "", badge: "" },
  pilot: { label: "PILOT", color: "#d9d2ff", badge: "▲" },
  navigator: { label: "NAVIGATOR", color: "#6ee7ff", badge: "◇" },
  captain: { label: "CAPTAIN", color: "#7dff9b", badge: "◆" },
  commander: { label: "COMMANDER", color: "#ffd166", badge: "✦" },
  admiral: { label: "STAR ADMIRAL", color: "#ff9f43", badge: "★" },
  dj: { label: "DJ", color: "#ff6ad5", badge: "♫" },
  digger: { label: "DIGGER", color: "#b8f35a", badge: "◎" },
  warden: { label: "WARDEN", color: "#ff5c5c", badge: "⚑" },
  founder: { label: "ARCHITECT", color: "#ffe066", badge: "✸" },
};
/** the earned ladder: each rank and what it takes — flights logged OR ore mined */
export const EARNED: { rank: string; flights: number; ore: number }[] = [
  { rank: "pilot", flights: 25, ore: 5 }, { rank: "navigator", flights: 100, ore: 25 }, { rank: "captain", flights: 300, ore: 75 },
  { rank: "commander", flights: 750, ore: 200 }, { rank: "admiral", flights: 2000, ore: 500 },
];
/** ranks only the founder gives */
export const GIVEN = ["dj", "digger", "warden"];
export const rankOf = (r?: string | null) => RANKS[r ?? "cadet"] ?? RANKS.cadet;
export const isStaff = (p?: { admin?: boolean; rank?: string } | null) => !!p && (!!p.admin || p.rank === "warden" || p.rank === "founder");
/** the rank as a coloured tag, for the chat and the profile */
export function rankTag(r?: string | null) {
  const k = rankOf(r); if (!k.color) return "";
  return `<span class="rk" style="--rk:${k.color}" title="${k.label}">${k.badge} ${k.label}</span>`;
}
/** the chat accepts the rank's key or its name, any case: captain, CAPTAIN, star admiral */
export function rankKey(s: string) {
  const v = s.trim().toLowerCase();
  if (RANKS[v]) return v;
  return Object.keys(RANKS).find((k) => RANKS[k].label.toLowerCase() === v) ?? null;
}
