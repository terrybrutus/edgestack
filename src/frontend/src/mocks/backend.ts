import type { backendInterface } from "../backend";

// Minimal mock — only canister methods (bet history + line movement).
// Game data, odds, props, and AI analysis all come from external APIs in the browser.
export const mockBackend: backendInterface = {
  getApiStatus: async () => ({
    oddsApiConfigured: true,
    openAiConfigured: true,
    bdlApiConfigured: true,
    lastOddsApiCallStatus: undefined,
    lastBdlCallStatus: undefined,
  }),

  getBetHistory: async () => [],

  getBetHistoryStats: async () => ({
    lostBets: BigInt(0),
    wonBets: BigInt(0),
    totalBets: BigInt(0),
    pendingBets: BigInt(0),
    winRate: 0,
  }),

  getOpeningLine: async (_gameId: string) => null,

  recordOpeningLine: async (
    _gameId: string,
    _spread: string,
    _total: string,
    _homeML: string,
  ) => undefined,

  saveBetRecommendation: async (rec) => ({ __kind__: "ok", ok: rec.id }),

  updateBetOutcome: async (_id, _status, _gameResult) => ({
    __kind__: "ok",
    ok: true,
  }),

  updateClosingLine: async (_id, _closingLine, _preGameLine) => ({
    __kind__: "ok",
    ok: true,
  }),
};
