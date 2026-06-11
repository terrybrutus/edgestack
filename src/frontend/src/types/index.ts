import {
  type ApiError,
  type ApiStatus,
  type BetHistoryStats,
  type BetRecommendation,
  BetStatus,
  BetType,
  type GameId,
} from "@/backend";

export type { BetRecommendation, BetHistoryStats, ApiError, ApiStatus, GameId };
export { BetStatus, BetType };

// ── Domain types (frontend-only after backend refactor) ───────────────────────

export type TeamId = string;
export type PlayerId = string;

export enum GameStatus {
  final_ = "final",
  scheduled = "scheduled",
  inProgress = "inProgress",
  postponed = "postponed",
}

export interface Team {
  id: TeamId;
  city: string;
  name: string;
  abbreviation: string;
  record: string;
}

export interface OddsLine {
  homeMoneyline?: bigint;
  overUnder?: number;
  awaySpreadOdds?: bigint;
  awayMoneyline?: bigint;
  overOdds?: bigint;
  awaySpread?: number;
  homeSpreadOdds?: bigint;
  homeSpread?: number;
  bookmaker: string;
  underOdds?: bigint;
  updatedAt: string;
}

export interface Game {
  id: GameId;
  status: GameStatus;
  venue: string;
  displayTime: string;
  homeTeam: Team;
  odds: Array<OddsLine>;
  series?: string;
  awayTeam: Team;
  gameTime: string;
}

export interface GamesResponse {
  gamesDate: string;
  isUpcomingDate: boolean;
  games: Array<Game>;
}

export interface InjuryReport {
  status: string;
  playerId: PlayerId;
  team: string;
  description: string;
  updatedAt: string;
  playerName: string;
}

export interface Discrepancy {
  gap: number;
  minValue: number;
  minBook: string;
  betType: string;
  maxBook: string;
  maxValue: number;
}

export interface TeamStats {
  pace?: number;
  recentForm: Array<bigint>;
  homeAwayRecord: string;
  defensiveRating?: number;
  teamId: TeamId;
  restDays: bigint;
  offensiveRating?: number;
  pointsPerGame?: number;
}

export interface LineMovement {
  openingSpread?: number;
  currentSpread?: number;
  spreadMove: number;
  openingTotal?: number;
  currentTotal?: number;
  totalMove: number;
  steamAlert: boolean;
  sharpSide: string;
}

export interface RestAdvantage {
  homeRestDays: bigint;
  awayRestDays: bigint;
  advantage: string;
  impactDescription: string;
}

export interface SituationalAngle {
  name: string;
  description: string;
  edge: string;
  confidence: bigint;
}

export interface RefereeProfile {
  overRate?: number;
  name: string;
  avgFoulsPerGame?: number;
  avgFreeThrowsPerGame?: number;
  tendency: string;
}

export interface GameInvestigation {
  game: Game;
  odds: Array<OddsLine>;
  injuries: Array<InjuryReport>;
  discrepancies: Array<Discrepancy>;
  homeTeamStats: TeamStats;
  awayTeamStats: TeamStats;
  lineMovement?: LineMovement;
  restAdvantage?: RestAdvantage;
  situationalAngles: Array<SituationalAngle>;
  refereeProfile?: RefereeProfile;
}

export interface Player {
  id: PlayerId;
  name: string;
  team: string;
  jerseyNumber: string;
  injuryStatus: string;
  position: string;
}

export interface PropLine {
  market: "points" | "rebounds" | "assists";
  overOdds: bigint;
  line: number;
  bookmaker: string;
  underOdds: bigint;
}

export interface PlayerRecentGame {
  fieldGoalAttempts: number;
  date: string;
  minutes: number;
  usageRate: number;
  points: number;
  opponent: string;
}

export interface ConfidenceReport {
  keyFactors: Array<string>;
  projectedPoints?: number;
  reasoning: string;
  score: bigint;
  grade: string;
  recommendation: string;
}

export interface PlayerProp {
  seasonAvgPoints: number;
  player: Player;
  seasonUsageRate: number;
  matchupDefRating?: number;
  seasonAvgMinutes: number;
  propLines: Array<PropLine>;
  confidenceReport?: ConfidenceReport;
  backToBack: boolean;
  recentGames: Array<PlayerRecentGame>;
  homeAwaySplit: number;
}

export interface PlayerPropsAnalysis {
  gameId: GameId;
  players: Array<PlayerProp>;
  analysisGeneratedAt: string;
}

export interface PaceProfile {
  defensiveEfficiency: number;
  pace: number;
  avgPointsAgainst: number;
  avgPointsFor: number;
  offensiveEfficiency: number;
  teamId: TeamId;
  last5Avg: number;
}

export interface ScoringTrend {
  result: string;
  overUnder: number;
  teamTotal: number;
  date: string;
  gameTotal: number;
  opponent: string;
}

export interface TotalsConfidenceReport {
  overUnderEdge: string;
  keyFactors: Array<string>;
  reasoning: string;
  score: bigint;
  projectedTotal?: number;
  grade: string;
  recommendation: string;
}

export interface GameTotal {
  homePace: PaceProfile;
  gameId: GameId;
  refereeProfile?: RefereeProfile;
  impliedTotal?: number;
  projectedTotal?: number;
  recentTrends: Array<ScoringTrend>;
  confidenceReport?: TotalsConfidenceReport;
  awayPace: PaceProfile;
  injuryImpact: string;
}

// ── Utility types ─────────────────────────────────────────────────────────────

export type ConfidenceLevel = "high" | "medium" | "low";

export function getConfidenceLevel(score: number): ConfidenceLevel {
  if (score >= 70) return "high";
  if (score >= 40) return "medium";
  return "low";
}

export function formatMoneyline(ml: bigint | undefined): string {
  if (ml === undefined) return "N/A";
  const n = Number(ml);
  return n > 0 ? `+${n}` : `${n}`;
}

export function formatSpread(spread: number | undefined): string {
  if (spread === undefined) return "N/A";
  return spread > 0 ? `+${spread}` : `${spread}`;
}

export function getApiErrorMessage(err: ApiError): string {
  if (err.__kind__ === "networkError") return err.networkError;
  if (err.__kind__ === "notFound") return err.notFound;
  if (err.__kind__ === "parseError") return err.parseError;
  if (err.__kind__ === "rateLimited") return err.rateLimited;
  if (err.__kind__ === "unavailable") return err.unavailable;
  return "Unknown error";
}
