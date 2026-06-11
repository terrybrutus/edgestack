import { CONFIG } from "./config";

export interface OddsMarket {
  key: string;
  last_update: string;
  outcomes: Array<{ name: string; price: number; point?: number }>;
}

export interface OddsBookmaker {
  key: string;
  title: string;
  markets: OddsMarket[];
}

export interface OddsEvent {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: OddsBookmaker[];
}

export interface ParsedOdds {
  homeSpread: number | null;
  awaySpread: number | null;
  homeSpreadOdds: number | null;
  awaySpreadOdds: number | null;
  total: number | null;
  overOdds: number | null;
  underOdds: number | null;
  homeML: number | null;
  awayML: number | null;
}

export async function fetchOdds(
  sportKey: "basketball_nba" | "baseball_mlb",
  markets = "spreads,totals,h2h",
): Promise<OddsEvent[]> {
  const url =
    `${CONFIG.ODDS_BASE}/sports/${sportKey}/odds` +
    `?apiKey=${CONFIG.ODDS_API_KEY}&regions=us&markets=${markets}&oddsFormat=american`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Odds API failed: ${res.status}`);
  return res.json();
}

// Extract clean odds from a single event, preferring DraftKings then FanDuel then first available
export function parseOddsEvent(event: OddsEvent): ParsedOdds {
  const preferred = ["draftkings", "fanduel", "betmgm", "williamhill_us"];
  const sorted = [...event.bookmakers].sort((a, b) => {
    const ai = preferred.indexOf(a.key);
    const bi = preferred.indexOf(b.key);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  let homeSpread: number | null = null;
  let awaySpread: number | null = null;
  let homeSpreadOdds: number | null = null;
  let awaySpreadOdds: number | null = null;
  let total: number | null = null;
  let overOdds: number | null = null;
  let underOdds: number | null = null;
  let homeML: number | null = null;
  let awayML: number | null = null;

  for (const bm of sorted) {
    for (const market of bm.markets) {
      if (market.key === "spreads" && homeSpread === null) {
        for (const o of market.outcomes) {
          if (o.name === event.home_team) {
            homeSpread = o.point ?? null;
            homeSpreadOdds = o.price;
          } else {
            awaySpread = o.point ?? null;
            awaySpreadOdds = o.price;
          }
        }
      }
      if (market.key === "totals" && total === null) {
        for (const o of market.outcomes) {
          if (o.name === "Over") {
            total = o.point ?? null;
            overOdds = o.price;
          } else {
            underOdds = o.price;
          }
        }
      }
      if (market.key === "h2h" && homeML === null) {
        for (const o of market.outcomes) {
          if (o.name === event.home_team) homeML = o.price;
          else awayML = o.price;
        }
      }
    }
    if (homeSpread !== null && total !== null && homeML !== null) break;
  }

  return {
    homeSpread,
    awaySpread,
    homeSpreadOdds,
    awaySpreadOdds,
    total,
    overOdds,
    underOdds,
    homeML,
    awayML,
  };
}

export function formatAmerican(odds: number | null): string {
  if (odds === null) return "N/A";
  return odds > 0 ? `+${odds}` : `${odds}`;
}

// ── Player prop lines ─────────────────────────────────────────────────────────

export interface OddsPlayerProp {
  playerName: string;
  market: "points" | "rebounds" | "assists";
  line: number;
  overOdds: number; // American
  underOdds: number; // American
  bookmaker: string;
}

const propsCache = new Map<string, { data: OddsPlayerProp[]; at: number }>();
const PROPS_CACHE_TTL = 30 * 60 * 1000; // 30 min

interface PlayerPropsOutcome {
  name: string;
  description?: string;
  price: number;
  point?: number;
}

interface PlayerPropsMarket {
  key: string;
  outcomes: PlayerPropsOutcome[];
}

interface PlayerPropsBookmaker {
  key: string;
  title: string;
  markets: PlayerPropsMarket[];
}

interface PlayerPropsEvent {
  bookmakers: PlayerPropsBookmaker[];
}

export async function fetchPlayerPropsFromOdds(
  homeTeam: string,
  awayTeam: string,
  sport = "basketball_nba",
): Promise<OddsPlayerProp[]> {
  // 1. Get all events (cached by fetchOdds internally if called before)
  const events = await fetchOdds(
    sport as "basketball_nba" | "baseball_mlb",
    "spreads,totals,h2h",
  );

  // 2. Find matching event using fuzzy last-word matching
  const lastWord = (s: string) =>
    s.trim().split(/\s+/).pop()?.toLowerCase() ?? "";
  const homeLast = lastWord(homeTeam);
  const awayLast = lastWord(awayTeam);

  const event = events.find((e) => {
    const eventHome = e.home_team.toLowerCase();
    const eventAway = e.away_team.toLowerCase();
    return (
      (eventHome.includes(homeLast) && eventAway.includes(awayLast)) ||
      (eventHome.includes(awayLast) && eventAway.includes(homeLast))
    );
  });

  if (!event) return [];

  const cacheKey = `${event.id}`;
  const cached = propsCache.get(cacheKey);
  if (cached && Date.now() - cached.at < PROPS_CACHE_TTL) {
    return cached.data;
  }

  // 3. Fetch player props for this event
  const url =
    `${CONFIG.ODDS_BASE}/sports/${sport}/events/${event.id}/odds` +
    `?apiKey=${CONFIG.ODDS_API_KEY}&regions=us&markets=player_points,player_rebounds,player_assists&oddsFormat=american`;

  const res = await fetch(url);
  if (!res.ok) return [];

  const propsEvent: PlayerPropsEvent = await res.json();

  // 4. Parse outcomes — prefer FanDuel then DraftKings
  const PREFERRED = ["fanduel", "draftkings"];
  const sorted = [...(propsEvent.bookmakers ?? [])].sort((a, b) => {
    const ai = PREFERRED.indexOf(a.key);
    const bi = PREFERRED.indexOf(b.key);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  const marketKeyMap: Record<string, OddsPlayerProp["market"]> = {
    player_points: "points",
    player_rebounds: "rebounds",
    player_assists: "assists",
  };

  // Keep one line per player, market, and book for line shopping.
  const seen = new Set<string>();
  const results: OddsPlayerProp[] = [];

  for (const bm of sorted) {
    for (const market of bm.markets) {
      const marketType = marketKeyMap[market.key];
      if (!marketType) continue;

      // Group outcomes by player description
      const byPlayer = new Map<
        string,
        { over?: PlayerPropsOutcome; under?: PlayerPropsOutcome }
      >();
      for (const outcome of market.outcomes) {
        const playerName = outcome.description ?? outcome.name;
        if (!byPlayer.has(playerName)) byPlayer.set(playerName, {});
        const entry = byPlayer.get(playerName)!;
        if (outcome.name === "Over") entry.over = outcome;
        else if (outcome.name === "Under") entry.under = outcome;
      }

      for (const [playerName, { over, under }] of byPlayer) {
        if (!over || !under || over.point === undefined) continue;
        const dedupeKey = `${playerName}|${marketType}|${bm.key}`;
        if (seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);

        results.push({
          playerName,
          market: marketType,
          line: over.point,
          overOdds: over.price,
          underOdds: under.price,
          bookmaker: bm.title,
        });
      }
    }
  }

  propsCache.set(cacheKey, { data: results, at: Date.now() });
  return results;
}
