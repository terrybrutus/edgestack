import type { Principal } from "@icp-sdk/core/principal";

export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;

export type GameId = string;

export type ApiError = {
    __kind__: "networkError";
    networkError: string;
} | {
    __kind__: "notFound";
    notFound: string;
} | {
    __kind__: "parseError";
    parseError: string;
} | {
    __kind__: "rateLimited";
    rateLimited: string;
} | {
    __kind__: "unavailable";
    unavailable: string;
};

export interface ApiStatus {
    lastBdlCallStatus?: string;
    oddsApiConfigured: boolean;
    openAiConfigured: boolean;
    bdlApiConfigured: boolean;
    lastOddsApiCallStatus?: string;
}

export interface BetHistoryStats {
    lostBets: bigint;
    wonBets: bigint;
    totalBets: bigint;
    pendingBets: bigint;
    winRate: number;
}

export enum BetStatus {
    won = "won",
    cancelled = "cancelled",
    pending = "pending",
    lost = "lost",
    push = "push",
}

export enum BetType {
    gameTotal = "gameTotal",
    playerProp = "playerProp",
    spread = "spread",
}

export interface BetRecommendation {
    id: string;
    status: BetStatus;
    result?: string;
    homeTeam: string;
    gameResult?: string;
    betType: BetType;
    gameId: GameId;
    description: string;
    reasoning: string;
    updatedAt?: bigint;
    recommendedAt: bigint;
    awayTeam: string;
    gameDate: string;
    preGameOdds?: string;
    confidence: bigint;
    closingLine?: string;
    clvScore?: number;
}

export type Result = {
    __kind__: "ok";
    ok: boolean;
} | {
    __kind__: "err";
    err: ApiError;
};

export type Result_1 = {
    __kind__: "ok";
    ok: string;
} | {
    __kind__: "err";
    err: ApiError;
};

export interface backendInterface {
    getApiStatus(): Promise<ApiStatus>;
    getBetHistory(): Promise<Array<BetRecommendation>>;
    getBetHistoryStats(): Promise<BetHistoryStats>;
    getOpeningLine(gameId: string): Promise<string | null>;
    recordOpeningLine(gameId: string, spread: string, total: string, homeML: string): Promise<void>;
    saveBetRecommendation(rec: BetRecommendation): Promise<Result_1>;
    updateBetOutcome(id: string, status: BetStatus, gameResult: string | null): Promise<Result>;
    updateClosingLine(id: string, closingLine: string, preGameLine: string): Promise<Result>;
}
