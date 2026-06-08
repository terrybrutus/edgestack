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
      // No games today — find next slate
      for (let i = 1; i <= 7; i++) {
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
    staleTime: 60_000,
    refetchInterval: 120_000,
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10_000),
  });
}

export function useGameDetail(gameId: string, gameDate = "") {
  return useQuery<GameInvestigation>({
    queryKey: ["game-detail", gameId, gameDate],
    queryFn: async () => {
      if (!gameId) throw new Error("Missing game ID");
      const date =
        gameDate ||
        new Date().toLocaleDateString("en-CA", {
          timeZone: "America/New_York",
        });
      return buildInvestigationFromBdl(gameId, date);
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
      return fetchActivePlayersForGame(gameId);
    },
    enabled: !!gameId && enabled,
    retry: 2,
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: 30 * 60 * 1000,
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

// ── Status (always true — keys are in frontend config) ────────────────────────

export function useIsOpenAIConfigured() {
  return useQuery<boolean>({
    queryKey: ["openai-configured"],
    queryFn: async () => true,
    staleTime: Number.POSITIVE_INFINITY,
    initialData: true,
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
    queryFn: async () => true,
    staleTime: Number.POSITIVE_INFINITY,
    initialData: true,
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
    queryFn: async () => true,
    staleTime: Number.POSITIVE_INFINITY,
    initialData: true,
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
  venueId: number;
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
          const venueId = g.venue.id;
          const park = getParkFactor(venueId);
          const [homePitcherStats, awayPitcherStats, weather] =
            await Promise.allSettled([
              g.teams.home.probablePitcher
                ? fetchMlbPitcherStats(g.teams.home.probablePitcher.id, season)
                : Promise.resolve(null),
              g.teams.away.probablePitcher
                ? fetchMlbPitcherStats(g.teams.away.probablePitcher.id, season)
                : Promise.resolve(null),
              fetchStadiumWeather(venueId, today),
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
            venueId,
            venueName: g.venue.name,
          };
        }),
      );
      return cards;
    },
    staleTime: 60_000,
    refetchInterval: 120_000,
    retry: 2,
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
