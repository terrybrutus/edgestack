import { CONFIG } from "./config";

const headers = () => ({ Authorization: `Bearer ${CONFIG.BDL_API_KEY}` });

// ── Rate-limited fetch with in-memory cache ───────────────────────────────────
// BDL free tier: 60 req/min. We throttle to ≤1 req/sec to stay safe.
const cache = new Map<string, { data: unknown; at: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 min — games don't change that fast
const queue: Array<() => void> = [];
let lastReqAt = 0;
const MIN_INTERVAL = 1050; // ~57 req/min, safe margin

function scheduleNext() {
  if (queue.length === 0) return;
  const now = Date.now();
  const wait = Math.max(0, lastReqAt + MIN_INTERVAL - now);
  setTimeout(() => {
    const next = queue.shift();
    if (next) {
      lastReqAt = Date.now();
      next();
      scheduleNext();
    }
  }, wait);
}

async function bdlFetch(url: string): Promise<unknown> {
  const cached = cache.get(url);
  if (cached && Date.now() - cached.at < CACHE_TTL) return cached.data;

  return new Promise((resolve, reject) => {
    queue.push(async () => {
      for (let attempt = 0; attempt < 4; attempt++) {
        try {
          const res = await fetch(url, { headers: headers() });
          if (res.status === 429) {
            // Back off: 2s, 4s, 8s
            await new Promise((r) => setTimeout(r, 1000 * 2 ** (attempt + 1)));
            continue;
          }
          if (!res.ok) {
            reject(
              new Error(
                `BDL ${url.split("?")[0].split("/").pop()} failed: ${res.status}`,
              ),
            );
            return;
          }
          const json = await res.json();
          cache.set(url, { data: json, at: Date.now() });
          resolve(json);
          return;
        } catch (e) {
          if (attempt === 3) {
            reject(e);
            return;
          }
          await new Promise((r) => setTimeout(r, 500));
        }
      }
      reject(new Error("BDL max retries exceeded"));
    });
    if (queue.length === 1) scheduleNext();
  });
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface BdlTeam {
  id: number;
  abbreviation: string;
  city: string;
  conference: string;
  division: string;
  full_name: string;
  name: string;
}

export interface BdlGame {
  id: number;
  date: string;
  home_team: BdlTeam;
  visitor_team: BdlTeam;
  home_team_score: number;
  visitor_team_score: number;
  period: number;
  postseason: boolean;
  season: number;
  status: string;
  time: string | null;
}

export interface BdlPlayer {
  id: number;
  first_name: string;
  last_name: string;
  position: string;
  team: BdlTeam;
}

export interface BdlSeasonAvg {
  player_id: number;
  season: number;
  pts: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  min: string;
  games_played: number;
}

// ── API calls ─────────────────────────────────────────────────────────────────

export async function fetchGamesForDate(date: string): Promise<BdlGame[]> {
  const url = `${CONFIG.BDL_BASE}/games?dates[]=${date}&per_page=100`;
  const json = (await bdlFetch(url)) as { data?: BdlGame[] };
  return json.data ?? [];
}

export async function fetchTeamLastNGames(
  teamId: number,
  season: number,
  n = 10,
): Promise<BdlGame[]> {
  const url = `${CONFIG.BDL_BASE}/games?team_ids[]=${teamId}&seasons[]=${season}&per_page=${n}`;
  const json = (await bdlFetch(url)) as { data?: BdlGame[] };
  return (json.data ?? []) as BdlGame[];
}

export async function fetchSeasonAverages(
  playerIds: number[],
  season: number,
): Promise<BdlSeasonAvg[]> {
  const ids = playerIds.map((id) => `player_ids[]=${id}`).join("&");
  const url = `${CONFIG.BDL_BASE}/season_averages?season=${season}&${ids}`;
  const json = (await bdlFetch(url)) as { data?: BdlSeasonAvg[] };
  return json.data ?? [];
}

export async function fetchActivePlayers(
  teamId: number,
  season: number,
): Promise<BdlPlayer[]> {
  // Filter by season so we only get the current-year roster, not all-time history.
  const url = `${CONFIG.BDL_BASE}/players?team_ids[]=${teamId}&seasons[]=${season}&per_page=100`;
  const json = (await bdlFetch(url)) as { data?: BdlPlayer[] };
  return json.data ?? [];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// BDL status → our status type
export function parseBdlStatus(
  status: string,
): "scheduled" | "inProgress" | "final" {
  if (!status) return "scheduled";
  const s = status.toLowerCase();
  if (s === "final" || s.startsWith("final")) return "final";
  if (s.includes("t") && s.includes("z") && s.length >= 19) return "scheduled"; // ISO UTC
  if (s.includes("halftime") || s.match(/^\d+:\d+\s*(q\d|ot)/i))
    return "inProgress";
  if (s.match(/^q\d|^\d+(st|nd|rd|th)/i)) return "inProgress";
  return "scheduled";
}

// BDL ISO UTC timestamp → "8:30 PM ET" display
export function bdlStatusToDisplayTime(status: string): string {
  if (!status) return "TBD";
  // ISO UTC string like "2026-06-09T00:30:00Z"
  if (status.includes("T") && status.includes("Z") && status.length >= 19) {
    const d = new Date(status);
    if (Number.isNaN(d.getTime())) return status;
    return d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      timeZone: "America/New_York",
      timeZoneName: "short",
    });
  }
  // Already a display string like "7:30 pm ET"
  if (status.toLowerCase().includes("et")) return status;
  return status;
}

// BDL ISO UTC timestamp → "YYYY-MM-DD" in ET
export function bdlStatusToEtDate(
  status: string,
  fallbackDate: string,
): string {
  if (status.includes("T") && status.includes("Z") && status.length >= 19) {
    const d = new Date(status);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString("en-CA", { timeZone: "America/New_York" });
    }
  }
  return fallbackDate;
}
