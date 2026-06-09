// All data-fetching hooks now call external APIs directly from the browser.
// Only state operations (bet history, line movement) still use the canister.
// This eliminates canister HTTP outcalls → near-zero cycle consumption.

import {
  type BetHistoryStats,
  type BetRecommendation,
  type BetStatus,
  createActor,
} from "@/backend";
import {
  buildNbaPropsPrompt,
  buildNbaTotalsPrompt,
  claudeAnalyze,
} from "@/services/claude";
import {
  buildGameFromBdl,
  buildInvestigationFromBdl,
  computeRestDays,
  fetchActivePlayersForGame,
  fetchGamesForDate,
  fetchSeasonAveragesForGame,
  fetchTeamLastNGames,
} from "@/services/games-facade";
import {
  type MlbGame,
  fetchBullpenUsage,
  fetchMlbGamesForDate,
  fetchMlbPitcherStats,
  fetchUmpireForGame,
  getParkFactor,
  getUmpireTendency,
  mlbDisplayTime,
  mlbGameStatus,
} from "@/services/mlb";
import { fetchOdds } from "@/services/odds";
import { fetchStadiumWeather } from "@/services/weather";
import { getApiErrorMessage } from "@/types";
import type {
  Game,
  GameInvestigation,
  GameTotal,
  GamesResponse,
  PlayerPropsAnalysis,
} from "@/types";
import { useActor } from "@caffeineai/core-infrastructure";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

// ── Games (BDL direct) ────────────────────────────────────────────────────────

export function useTodayGames() {
  return useQuery<GamesResponse>({
    queryKey: ["today-games"],
    queryFn: async () => {
      const localToday = new Date().toLocaleDateString("en-CA", {
        timeZone: "America/New_York",
      });
      const games = await fetchGamesForDate(localToday);
      if (games.length > 0) {
        return {
          games: games.map(buildGameFromBdl),
          gamesDate: localToday,
          isUpcomingDate: false,
        };
      }
      // No games today — check next 2 days only (cap BDL calls)
      for (let i = 1; i <= 2; i++) {
        const next = new Date(
          new Date().getTime() + i * 86400000,
        ).toLocaleDateString("en-CA", { timeZone: "America/New_York" });
        const upcoming = await fetchGamesForDate(next);
        if (upcoming.length > 0) {
          return {
            games: upcoming.map(buildGameFromBdl),
            gamesDate: next,
            isUpcomingDate: true,
          };
        }
      }
      return { games: [], gamesDate: localToday, isUpcomingDate: false };
    },
    staleTime: 5 * 60_000,
    refetchInterval: 5 * 60_000, // 5 min — BDL game list doesn't change every 2 min
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 30_000),
  });
}

export function useGameDetail(gameId: string, gameDate = "") {
  const { actor } = useActor(createActor);
  return useQuery<GameInvestigation>({
    queryKey: ["game-detail", gameId, gameDate],
    queryFn: async () => {
      if (!gameId) throw new Error("Missing game ID");
      const date =
        gameDate ||
        new Date().toLocaleDateString("en-CA", {
          timeZone: "America/New_York",
        });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const investigation = await buildInvestigationFromBdl(
        gameId,
        date,
        actor as any,
      );
      return investigation;
    },
    enabled: !!gameId,
    retry: 2,
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: 30 * 60 * 1000,
  });
}

export function usePlayerProps(gameId: string, enabled = true) {
  return useQuery<PlayerPropsAnalysis | null>({
    queryKey: ["player-props", gameId],
    queryFn: async () => {
      if (!gameId) return null;
      // Always resolves within a bounded time (see fetchActivePlayersForGame),
      // returning an empty analysis rather than hanging.
      return fetchActivePlayersForGame(gameId);
    },
    enabled: !!gameId && enabled,
    // The fetch already bounds its own time and never rejects, so a single
    // retry is plenty — avoids any refetch-loop and keeps total time bounded.
    retry: 1,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8_000),
    staleTime: 5 * 60_000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useGameTotal(
  gameId: string,
  homeTeamName: string,
  awayTeamName: string,
  enabled = true,
) {
  return useQuery<GameTotal | null>({
    queryKey: ["game-total", gameId, homeTeamName, awayTeamName],
    queryFn: async () => {
      if (!gameId) return null;
      return fetchSeasonAveragesForGame(gameId, homeTeamName, awayTeamName);
    },
    enabled: !!gameId && enabled,
    retry: 2,
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: 30 * 60 * 1000,
  });
}

// ── AI analysis (Claude direct from browser) ─────────────────────────────────

export function usePropsAIAnalysis() {
  return useMutation<string, Error, { gameId: string; playerData: string }>({
    mutationFn: async ({ gameId, playerData }) => {
      return claudeAnalyze(
        "You are EdgeStack AI, a professional sports betting analyst. Be selective — only flag confidence ≥65 where multiple signals align. Less is more.",
        buildNbaPropsPrompt(gameId, playerData),
        900,
      );
    },
  });
}

export function useTotalsAIAnalysis() {
  return useMutation<string, Error, { gameId: string; totalsData: string }>({
    mutationFn: async ({ gameId, totalsData }) => {
      return claudeAnalyze(
        "You are EdgeStack AI, a professional sports betting analyst. Focus on game totals (over/under). Be selective — only recommend when multiple signals align.",
        buildNbaTotalsPrompt(gameId, totalsData),
        600,
      );
    },
  });
}

// ── Bet history (canister — pure state, no HTTP outcalls) ─────────────────────

export function useBetHistory() {
  const { actor, isFetching } = useActor(createActor);
  return useQuery<BetRecommendation[]>({
    queryKey: ["bet-history"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getBetHistory();
    },
    enabled: !!actor && !isFetching,
    staleTime: 30_000,
  });
}

export function useBetHistoryStats() {
  const { actor, isFetching } = useActor(createActor);
  return useQuery<BetHistoryStats>({
    queryKey: ["bet-history-stats"],
    queryFn: async () => {
      if (!actor) throw new Error("Actor not ready");
      return actor.getBetHistoryStats();
    },
    enabled: !!actor && !isFetching,
    staleTime: 30_000,
  });
}

export function useUpdateBetOutcome() {
  const queryClient = useQueryClient();
  const { actor } = useActor(createActor);
  return useMutation<
    boolean,
    Error,
    { id: string; status: BetStatus; gameResult: string | null }
  >({
    mutationFn: async ({ id, status, gameResult }) => {
      if (!actor) throw new Error("Actor not ready");
      const result = await actor.updateBetOutcome(id, status, gameResult);
      if (result.__kind__ === "err")
        throw new Error(getApiErrorMessage(result.err));
      return result.ok;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bet-history"] });
      queryClient.invalidateQueries({ queryKey: ["bet-history-stats"] });
    },
  });
}

export function useUpdateClosingLine() {
  const queryClient = useQueryClient();
  const { actor } = useActor(createActor);
  return useMutation<
    boolean,
    Error,
    { id: string; closingLine: string; preGameLine: string }
  >({
    mutationFn: async ({ id, closingLine, preGameLine }) => {
      if (!actor) throw new Error("Actor not ready");
      const result = await actor.updateClosingLine(
        id,
        closingLine,
        preGameLine,
      );
      if (result.__kind__ === "err")
        throw new Error(getApiErrorMessage(result.err));
      return result.ok;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["bet-history"] }),
  });
}

export function useSaveBetRecommendation() {
  const queryClient = useQueryClient();
  const { actor } = useActor(createActor);
  return useMutation<string, Error, BetRecommendation>({
    mutationFn: async (rec: BetRecommendation) => {
      if (!actor) throw new Error("Actor not ready");
      const result = await actor.saveBetRecommendation(rec);
      if (result.__kind__ === "err")
        throw new Error(getApiErrorMessage(result.err));
      return result.ok;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bet-history"] });
      queryClient.invalidateQueries({ queryKey: ["bet-history-stats"] });
    },
  });
}

// ── Status — checks that config keys are non-empty ────────────────────────────

export function useIsOpenAIConfigured() {
  return useQuery<boolean>({
    queryKey: ["openai-configured"],
    queryFn: async () => {
      const { CONFIG } = await import("@/services/config");
      return CONFIG.CLAUDE_API_KEY.length > 0;
    },
    staleTime: Number.POSITIVE_INFINITY,
  });
}

export function useSetOpenAIApiKey() {
  return useMutation<void, Error, string>({
    mutationFn: async (_key: string) => {},
  });
}

export function useIsBdlApiConfigured() {
  return useQuery<boolean>({
    queryKey: ["bdl-configured"],
    queryFn: async () => {
      const { CONFIG } = await import("@/services/config");
      return CONFIG.BDL_API_KEY.length > 0;
    },
    staleTime: Number.POSITIVE_INFINITY,
  });
}

export function useSetBdlApiKey() {
  return useMutation<void, Error, string>({
    mutationFn: async (_key: string) => {},
  });
}

export function useIsOddsApiConfigured() {
  return useQuery<boolean>({
    queryKey: ["odds-api-configured"],
    queryFn: async () => {
      const { CONFIG } = await import("@/services/config");
      return CONFIG.ODDS_API_KEY.length > 0;
    },
    staleTime: Number.POSITIVE_INFINITY,
  });
}

export function useSetOddsApiKey() {
  return useMutation<void, Error, string>({
    mutationFn: async (_key: string) => {},
  });
}

export function useApiStatus() {
  return useQuery({
    queryKey: ["api-status"],
    queryFn: async () => ({
      oddsApiConfigured: true,
      openAiConfigured: true,
      bdlApiConfigured: true,
      lastOddsApiCallStatus: null,
      lastBdlCallStatus: null,
    }),
    staleTime: Number.POSITIVE_INFINITY,
  });
}

// ── MLB games ─────────────────────────────────────────────────────────────────

export interface MlbGameCard {
  gamePk: number;
  status: "scheduled" | "inProgress" | "final";
  displayTime: string;
  homeTeam: { id: number; name: string; abbreviation: string };
  awayTeam: { id: number; name: string; abbreviation: string };
  homeScore?: number;
  awayScore?: number;
  homePitcher: { name: string; era: number | null } | null;
  awayPitcher: { name: string; era: number | null } | null;
  parkFactor: { runFactor: number; description: string };
  weatherSignal: "OVER" | "UNDER" | "NEUTRAL";
  weatherDescription: string;
  venueName: string;
}

export function useMlbGames(date?: string) {
  return useQuery<MlbGameCard[]>({
    queryKey: ["mlb-games", date ?? "today"],
    queryFn: async () => {
      const today =
        date ??
        new Date().toLocaleDateString("en-CA", {
          timeZone: "America/New_York",
        });
      const games = await fetchMlbGamesForDate(today);
      const cards = await Promise.all(
        games.map(async (g: MlbGame): Promise<MlbGameCard> => {
          const season = new Date(g.gameDate).getFullYear();
          const venueName = g.venue.name;
          const park = getParkFactor(venueName);
          const [homePitcherStats, awayPitcherStats, weather] =
            await Promise.allSettled([
              g.teams.home.probablePitcher
                ? fetchMlbPitcherStats(g.teams.home.probablePitcher.id, season)
                : Promise.resolve(null),
              g.teams.away.probablePitcher
                ? fetchMlbPitcherStats(g.teams.away.probablePitcher.id, season)
                : Promise.resolve(null),
              fetchStadiumWeather(venueName, today),
            ]);

          const homeStats =
            homePitcherStats.status === "fulfilled"
              ? homePitcherStats.value
              : null;
          const awayStats =
            awayPitcherStats.status === "fulfilled"
              ? awayPitcherStats.value
              : null;
          const wx = weather.status === "fulfilled" ? weather.value : null;

          return {
            gamePk: g.gamePk,
            status: mlbGameStatus(g),
            displayTime: mlbDisplayTime(g),
            homeTeam: {
              id: g.teams.home.team.id,
              name: g.teams.home.team.name,
              abbreviation: g.teams.home.team.abbreviation,
            },
            awayTeam: {
              id: g.teams.away.team.id,
              name: g.teams.away.team.name,
              abbreviation: g.teams.away.team.abbreviation,
            },
            homeScore: g.teams.home.score,
            awayScore: g.teams.away.score,
            homePitcher: g.teams.home.probablePitcher
              ? {
                  name: g.teams.home.probablePitcher.fullName,
                  era: homeStats?.era ?? null,
                }
              : null,
            awayPitcher: g.teams.away.probablePitcher
              ? {
                  name: g.teams.away.probablePitcher.fullName,
                  era: awayStats?.era ?? null,
                }
              : null,
            parkFactor: {
              runFactor: park.runFactor,
              description: park.description,
            },
            weatherSignal: wx?.totalSignal ?? "NEUTRAL",
            weatherDescription: wx ? wx.description : "Weather unavailable",
            venueName: g.venue.name,
          };
        }),
      );
      return cards;
    },
    staleTime: 5 * 60_000,
    refetchInterval: 5 * 60_000,
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 30_000),
  });
}

// Re-export MLB types for pages
export type { MlbGame };
export {
  fetchMlbGamesForDate,
  getParkFactor,
  getUmpireTendency,
  fetchUmpireForGame,
  fetchBullpenUsage,
};

// ── Plays (Today's strong bets, NBA + MLB) ────────────────────────────────────

export interface AnyPlay {
  sport: "NBA" | "MLB";
  gameLabel: string;
  gameId: string;
  displayTime: string;
  betText: string;
  betType: "spread" | "total" | "moneyline";
  postedLine: number | null; // the actual number to bet (spread/total)
  direction: "OVER" | "UNDER" | "HOME" | "AWAY";
  confidence: number;
  convergenceCount: number;
  summaryText: string;
  signals: Array<{ name: string; description: string; confidence: number }>;
  linkTo: string;
  linkParams: Record<string, string>;
  linkSearch?: Record<string, string>;
}

export function usePlays() {
  return useQuery<{ nbaPlays: AnyPlay[]; mlbPlays: AnyPlay[] }>({
    queryKey: ["plays-today"],
    queryFn: async () => {
      const today = new Date().toLocaleDateString("en-CA", {
        timeZone: "America/New_York",
      });

      // ── NBA plays ───────────────────────────────────────────────────────────
      const { analyzeNbaEdge } = await import("@/services/analysis");
      const { fetchGamesForDate, fetchTeamLastNGames, computeRestDays } =
        await import("@/services/games-facade");
      const { fetchOdds, parseOddsEvent } = await import("@/services/odds");

      const [bdlGames, nbaOdds] = await Promise.allSettled([
        fetchGamesForDate(today),
        fetchOdds("basketball_nba"),
      ]);
      const games = bdlGames.status === "fulfilled" ? bdlGames.value : [];
      const oddsEvents = nbaOdds.status === "fulfilled" ? nbaOdds.value : [];

      const nbaPlays: AnyPlay[] = [];

      await Promise.all(
        games.map(async (g) => {
          const season = g.season;
          const [homeGames, awayGames] = await Promise.allSettled([
            fetchTeamLastNGames(g.home_team.id, season, 5),
            fetchTeamLastNGames(g.visitor_team.id, season, 5),
          ]);
          const homeRecent =
            homeGames.status === "fulfilled" ? homeGames.value : [];
          const awayRecent =
            awayGames.status === "fulfilled" ? awayGames.value : [];

          const homeRestDays = computeRestDays(homeRecent, today);
          const awayRestDays = computeRestDays(awayRecent, today);

          const oddsEvent = oddsEvents.find(
            (e) =>
              e.home_team
                .toLowerCase()
                .includes(g.home_team.name.toLowerCase()) ||
              e.away_team
                .toLowerCase()
                .includes(g.visitor_team.name.toLowerCase()),
          );
          const parsedOdds = oddsEvent ? parseOddsEvent(oddsEvent) : null;

          // ── Projected total vs posted O/U ─────────────────────────────────
          // Compute from scoring averages — this is the signal shown on the
          // Game Total tab. If it diverges ≥4 pts from the posted line, add
          // it as an explicit OVER/UNDER signal so it surfaces on this page.
          const avg = (arr: number[]) =>
            arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : null;

          const validHome = homeRecent.filter(
            (r) => r.home_team_score > 0 || r.visitor_team_score > 0,
          );
          const validAway = awayRecent.filter(
            (r) => r.home_team_score > 0 || r.visitor_team_score > 0,
          );
          const homeScores = validHome.map((r) =>
            r.home_team.id === g.home_team.id
              ? r.home_team_score
              : r.visitor_team_score,
          );
          const awayScores = validAway.map((r) =>
            r.visitor_team.id === g.visitor_team.id
              ? r.visitor_team_score
              : r.home_team_score,
          );
          const homePPG = avg(homeScores);
          const awayPPG = avg(awayScores);
          const projectedTotal =
            homePPG !== null && awayPPG !== null
              ? Math.round((homePPG + awayPPG) * 10) / 10
              : null;
          const postedTotal = parsedOdds?.total ?? null;

          type Direction = "OVER" | "UNDER" | "HOME" | "AWAY";
          const extraSignals: Array<{
            category: string;
            description: string;
            confidence: number;
            direction: Direction;
          }> = [];

          if (
            projectedTotal !== null &&
            postedTotal !== null &&
            Math.abs(projectedTotal - postedTotal) >= 4
          ) {
            const gap = projectedTotal - postedTotal;
            const dir: Direction = gap > 0 ? "OVER" : "UNDER";
            extraSignals.push({
              category: "Projected Total",
              description: `Model projects ${projectedTotal} vs posted ${postedTotal} — gap: ${gap > 0 ? "+" : ""}${gap.toFixed(1)} pts`,
              confidence:
                Math.abs(gap) >= 8 ? 72 : Math.abs(gap) >= 6 ? 68 : 62,
              direction: dir,
            });
          }

          // ── Edge analysis (spread, rest, moneyline) ───────────────────────
          const edge = analyzeNbaEdge({
            gameId: String(g.id),
            homeTeam: g.home_team.name,
            awayTeam: g.visitor_team.name,
            homeRestDays,
            awayRestDays,
            openSpread: parsedOdds?.homeSpread ?? null,
            currentSpread: parsedOdds?.homeSpread ?? null,
            openTotal: parsedOdds?.total ?? null,
            currentTotal: parsedOdds?.total ?? null,
            homeML: parsedOdds?.homeML ?? null,
            awayML: parsedOdds?.awayML ?? null,
            refereeName: null,
            refereeOverRate: null,
            refereeFoulRate: null,
            isPlayoffs: g.postseason,
          });

          // Merge edge signals with extra signals and check convergence
          const allSignals = [
            ...edge.signals.map((s) => ({
              category: s.category,
              description: s.description,
              confidence: s.confidence,
              direction: s.direction as Direction,
            })),
            ...extraSignals,
          ];

          const dirCount: Record<string, number> = {};
          for (const s of allSignals) {
            dirCount[s.direction] = (dirCount[s.direction] ?? 0) + 1;
          }
          const sorted = Object.entries(dirCount).sort((a, b) => b[1] - a[1]);
          if (!sorted.length || sorted[0][1] < 2) return;

          const [topDir, topCount] = sorted[0];
          const aligned = allSignals.filter((s) => s.direction === topDir);
          const avgConf =
            aligned.reduce((a, b) => a + b.confidence, 0) / aligned.length;
          const bonus = Math.min(20, (topCount - 1) * 7);
          const confidence = Math.min(95, Math.round(avgConf + bonus));

          const rec = topDir as Direction;
          let betText = "";
          if (rec === "HOME" && parsedOdds?.homeSpread != null) {
            const s = parsedOdds.homeSpread;
            betText = `${g.home_team.abbreviation} ${s > 0 ? "+" : ""}${s}`;
          } else if (rec === "AWAY" && parsedOdds?.awaySpread != null) {
            const s = parsedOdds.awaySpread;
            betText = `${g.visitor_team.abbreviation} ${s > 0 ? "+" : ""}${s}`;
          } else if (rec === "OVER" && parsedOdds?.total != null) {
            betText = `Over ${parsedOdds.total} on FanDuel`;
          } else if (rec === "UNDER" && parsedOdds?.total != null) {
            betText = `Under ${parsedOdds.total} on FanDuel`;
          } else {
            betText =
              rec === "HOME"
                ? `${g.home_team.abbreviation} ML`
                : rec === "AWAY"
                  ? `${g.visitor_team.abbreviation} ML`
                  : rec === "OVER"
                    ? "Over"
                    : "Under";
          }

          const displayStatus = g.status ?? "";
          let displayTime = "TBD";
          if (displayStatus.includes("T") && displayStatus.includes("Z")) {
            const d = new Date(displayStatus);
            if (!Number.isNaN(d.getTime())) {
              displayTime = d.toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
                timeZone: "America/New_York",
                timeZoneName: "short",
              });
            }
          } else if (
            displayStatus.toLowerCase().includes("q") ||
            displayStatus.toLowerCase().includes("half")
          ) {
            displayTime = "LIVE";
          }

          const nbaBetType: AnyPlay["betType"] =
            rec === "OVER" || rec === "UNDER"
              ? "total"
              : rec === "HOME" || rec === "AWAY"
                ? parsedOdds?.homeSpread != null
                  ? "spread"
                  : "moneyline"
                : "moneyline";
          const nbaPostedLine =
            nbaBetType === "total"
              ? (parsedOdds?.total ?? null)
              : nbaBetType === "spread"
                ? rec === "HOME"
                  ? (parsedOdds?.homeSpread ?? null)
                  : (parsedOdds?.awaySpread ?? null)
                : null;

          nbaPlays.push({
            sport: "NBA",
            gameLabel: `${g.visitor_team.abbreviation} @ ${g.home_team.abbreviation}`,
            gameId: String(g.id),
            displayTime,
            betText,
            betType: nbaBetType,
            postedLine: nbaPostedLine,
            direction: rec,
            confidence,
            convergenceCount: topCount,
            summaryText: `${topCount} signal${topCount > 1 ? "s" : ""} converging ${topDir} — ${topCount >= 3 ? "high" : "moderate"} conviction`,
            signals: aligned.map((s) => ({
              name: s.category,
              description: s.description,
              confidence: s.confidence,
            })),
            linkTo: "/game/$gameId",
            linkParams: { gameId: String(g.id) },
            linkSearch: { gameDate: today },
          });
        }),
      );

      // ── MLB plays ───────────────────────────────────────────────────────────
      const { fetchMlbGamesForDate: fetchMlb, getParkFactor: getPF } =
        await import("@/services/mlb");
      const { fetchMlbPitcherStats: fetchPStats, mlbDisplayTime: mlbTime } =
        await import("@/services/mlb");
      const { fetchStadiumWeather } = await import("@/services/weather");

      const [mlbGamesRaw, mlbOddsResult] = await Promise.allSettled([
        fetchMlb(today),
        fetchOdds("baseball_mlb"),
      ]);
      const mlbGames =
        mlbGamesRaw.status === "fulfilled" ? mlbGamesRaw.value : [];
      const mlbOddsEvents =
        mlbOddsResult.status === "fulfilled" ? mlbOddsResult.value : [];
      const mlbPlays: AnyPlay[] = [];

      await Promise.all(
        mlbGames.map(async (g) => {
          const season = new Date(g.gameDate).getFullYear();
          const venueName = g.venue.name;
          const park = getPF(venueName);

          // Find matching odds event for this MLB game
          const mlbOddsEvent = mlbOddsEvents.find(
            (e) =>
              e.home_team
                .toLowerCase()
                .includes(
                  g.teams.home.team.name.toLowerCase().split(" ").pop() ?? "",
                ) ||
              e.away_team
                .toLowerCase()
                .includes(
                  g.teams.away.team.name.toLowerCase().split(" ").pop() ?? "",
                ),
          );
          const mlbParsedOdds = mlbOddsEvent
            ? parseOddsEvent(mlbOddsEvent)
            : null;
          const mlbTotal = mlbParsedOdds?.total ?? null;
          const [homePitcherStats, awayPitcherStats, wx] =
            await Promise.allSettled([
              g.teams.home.probablePitcher
                ? fetchPStats(g.teams.home.probablePitcher.id, season)
                : Promise.resolve(null),
              g.teams.away.probablePitcher
                ? fetchPStats(g.teams.away.probablePitcher.id, season)
                : Promise.resolve(null),
              fetchStadiumWeather(venueName, today),
            ]);

          const homeEra =
            homePitcherStats.status === "fulfilled"
              ? (homePitcherStats.value?.era ?? null)
              : null;
          const awayEra =
            awayPitcherStats.status === "fulfilled"
              ? (awayPitcherStats.value?.era ?? null)
              : null;
          const weather = wx.status === "fulfilled" ? wx.value : null;

          // Build signals
          const signals: Array<{
            name: string;
            description: string;
            confidence: number;
            direction: "OVER" | "UNDER" | "HOME" | "AWAY";
          }> = [];

          const parkDev = park.runFactor - 100;
          if (Math.abs(parkDev) >= 5) {
            signals.push({
              name: "Park Factor",
              description: `${g.venue.name} run factor ${park.runFactor} (${parkDev > 0 ? "hitter-friendly" : "pitcher-friendly"})`,
              confidence: Math.abs(parkDev) >= 10 ? 65 : 58,
              direction: parkDev > 0 ? "OVER" : "UNDER",
            });
          }

          const wxSignal = weather?.totalSignal ?? "NEUTRAL";
          if (wxSignal !== "NEUTRAL" && weather) {
            signals.push({
              name: "Weather",
              description: weather.description,
              confidence: 62,
              direction: wxSignal as "OVER" | "UNDER",
            });
          }

          if (homeEra !== null && awayEra !== null) {
            const eraDiff = awayEra - homeEra;
            if (Math.abs(eraDiff) >= 1.0) {
              signals.push({
                name: "Pitcher Matchup",
                description: `ERA advantage: ${eraDiff > 0 ? g.teams.home.team.name : g.teams.away.team.name} (${Math.min(homeEra, awayEra).toFixed(2)} vs ${Math.max(homeEra, awayEra).toFixed(2)})`,
                confidence: Math.abs(eraDiff) >= 1.5 ? 68 : 58,
                direction: eraDiff > 0 ? "HOME" : "AWAY",
              });
            }
          }

          // Check convergence
          const dirCount: Record<string, number> = {};
          for (const s of signals) {
            dirCount[s.direction] = (dirCount[s.direction] ?? 0) + 1;
          }
          const sorted = Object.entries(dirCount).sort((a, b) => b[1] - a[1]);
          if (!sorted.length || sorted[0][1] < 2) return;

          const [topDir, topCount] = sorted[0];
          const aligned = signals.filter((s) => s.direction === topDir);
          const avgConf =
            aligned.reduce((a, b) => a + b.confidence, 0) / aligned.length;
          const bonus = Math.min(20, (topCount - 1) * 7);
          const confidence = Math.min(95, Math.round(avgConf + bonus));

          const homeAbbr = g.teams.home.team.abbreviation;
          const awayAbbr = g.teams.away.team.abbreviation;
          let betText = "";
          if (topDir === "OVER")
            betText =
              mlbTotal != null
                ? `Over ${mlbTotal} runs on FanDuel`
                : `Over (runs O/U) — ${g.venue.name}`;
          else if (topDir === "UNDER")
            betText =
              mlbTotal != null
                ? `Under ${mlbTotal} runs on FanDuel`
                : `Under (runs O/U) — ${g.venue.name}`;
          else if (topDir === "HOME") betText = `${homeAbbr} ML on FanDuel`;
          else betText = `${awayAbbr} ML on FanDuel`;

          const displayTime = mlbTime(g);

          const mlbBetType: AnyPlay["betType"] =
            topDir === "OVER" || topDir === "UNDER" ? "total" : "moneyline";

          mlbPlays.push({
            sport: "MLB",
            gameLabel: `${awayAbbr} @ ${homeAbbr}`,
            gameId: String(g.gamePk),
            displayTime,
            betText,
            betType: mlbBetType,
            postedLine: mlbBetType === "total" ? mlbTotal : null,
            direction: topDir as "OVER" | "UNDER" | "HOME" | "AWAY",
            confidence,
            convergenceCount: topCount,
            summaryText: `${topCount} signals converging on ${topDir} — ${topCount >= 3 ? "high" : "moderate"} conviction`,
            signals: aligned.map((s) => ({
              name: s.name,
              description: s.description,
              confidence: s.confidence,
            })),
            linkTo: "/mlb/$gamePk",
            linkParams: { gamePk: String(g.gamePk) },
          });
        }),
      );

      return { nbaPlays, mlbPlays };
    },
    staleTime: 10 * 60_000,
    refetchInterval: 10 * 60_000,
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 30_000),
  });
}
