// Challenge mode — all state in localStorage, no canister needed.

export type ChallengeType =
  | "doubler"
  | "ten_to_10k"
  | "kelly_growth"
  | "streak"
  | "parlay_ladder";

export type BetResult = "won" | "lost" | "push" | "pending";

export interface ChallengeBet {
  id: string;
  date: string; // YYYY-MM-DD
  description: string; // e.g., "OVER 229.5 on FanDuel"
  amountBet: number;
  result: BetResult;
  netAmount: number; // positive = profit, negative = loss
  bankrollBefore: number;
  bankrollAfter: number;
  confidence: number;
  americanOdds: number; // e.g., -110
}

export interface Challenge {
  id: string;
  name: string;
  type: ChallengeType;
  startAmount: number;
  currentAmount: number;
  targetAmount: number; // 0 = open-ended (kelly_growth, streak)
  startDate: string; // YYYY-MM-DD
  endDate?: string;
  status: "active" | "completed" | "busted";
  bets: ChallengeBet[];
}

// ── CHALLENGE_PRESETS ─────────────────────────────────────────────────────────

export const CHALLENGE_PRESETS: Record<
  ChallengeType,
  { label: string; description: string; defaultTarget: (start: number) => number; icon: string }
> = {
  doubler: {
    label: "Bankroll Doubler",
    description: "Start with any amount. Bet to double it. Each bet is sized to make steady progress without going bust.",
    defaultTarget: (s) => s * 2,
    icon: "⚡",
  },
  ten_to_10k: {
    label: "$10 to $10K",
    description: "The classic challenge. Start with $10, grind to $10,000 using only high-confidence plays. Takes ~30 winning bets.",
    defaultTarget: () => 10000,
    icon: "🏆",
  },
  kelly_growth: {
    label: "Kelly Growth",
    description: "No fixed target. Every bet is sized by the Kelly Criterion formula. Track steady bankroll growth over time.",
    defaultTarget: () => 0,
    icon: "📈",
  },
  streak: {
    label: "Win Streak",
    description: "Track your longest consecutive win streak. Flat bet $10 per play. No compounding — pure skill tracking.",
    defaultTarget: () => 0,
    icon: "🔥",
  },
  parlay_ladder: {
    label: "Parlay Ladder",
    description: "2-leg parlays only (pays ~2.6x). Start with a small amount and try to ladder up. Higher variance, higher reward.",
    defaultTarget: (s) => s * 10,
    icon: "🎯",
  },
};

// ── STORAGE ───────────────────────────────────────────────────────────────────

const KEY = "edgestack_challenges";

export function getChallenges(): Challenge[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Challenge[]) : [];
  } catch {
    return [];
  }
}

export function saveChallenge(c: Challenge): void {
  const all = getChallenges().filter((x) => x.id !== c.id);
  localStorage.setItem(KEY, JSON.stringify([c, ...all]));
}

export function deleteChallenge(id: string): void {
  const all = getChallenges().filter((x) => x.id !== id);
  localStorage.setItem(KEY, JSON.stringify(all));
}

// ── BET SIZING ────────────────────────────────────────────────────────────────

export function recommendBetSize(
  challenge: Challenge,
  confidence: number,
  americanOdds = -110,
): number {
  const current = challenge.currentAmount;
  if (current <= 0) return 0;

  const decimal =
    americanOdds < 0
      ? 100 / Math.abs(americanOdds) + 1
      : americanOdds / 100 + 1;

  switch (challenge.type) {
    case "doubler": {
      // 15% of current bankroll — aggressive but recoverable
      return Math.max(0.01, Math.round(current * 0.15 * 100) / 100);
    }
    case "ten_to_10k": {
      // Step-based: size each bet to make geometric progress
      // At each step, you're trying to reach the next "milestone"
      // Bet ~20% of current for fast progression
      return Math.max(0.01, Math.round(current * 0.2 * 100) / 100);
    }
    case "kelly_growth": {
      const p = confidence / 100;
      const q = 1 - p;
      const b = decimal - 1;
      const kelly = Math.max(0, (p * b - q) / b);
      return Math.max(0.01, Math.round((current * kelly) / 4 * 100) / 100);
    }
    case "streak": {
      return challenge.startAmount; // flat bet always
    }
    case "parlay_ladder": {
      // 25% of current per 2-leg parlay
      return Math.max(0.01, Math.round(current * 0.25 * 100) / 100);
    }
    default:
      return Math.max(0.01, Math.round(current * 0.1 * 100) / 100);
  }
}

// ── STATS HELPERS ─────────────────────────────────────────────────────────────

export function challengeStats(c: Challenge) {
  const settled = c.bets.filter((b) => b.result !== "pending");
  const wins = settled.filter((b) => b.result === "won").length;
  const losses = settled.filter((b) => b.result === "lost").length;
  const pushes = settled.filter((b) => b.result === "push").length;
  const netProfit = c.currentAmount - c.startAmount;
  const roi =
    c.startAmount > 0 ? ((netProfit / c.startAmount) * 100).toFixed(1) : "0.0";
  const progressPct =
    c.targetAmount > 0
      ? Math.min(
          100,
          ((c.currentAmount - c.startAmount) /
            (c.targetAmount - c.startAmount)) *
            100,
        )
      : 0;

  // current win streak
  let streak = 0;
  for (let i = settled.length - 1; i >= 0; i--) {
    if (settled[i].result === "won") streak++;
    else break;
  }

  return { wins, losses, pushes, netProfit, roi, progressPct, streak };
}

// Payout multiplier from American odds
export function payoutMultiplier(americanOdds: number): number {
  if (americanOdds < 0) return 100 / Math.abs(americanOdds);
  return americanOdds / 100;
}
