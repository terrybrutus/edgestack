import { Skeleton } from "@/components/ui/skeleton";
import { useMlbGames } from "@/hooks/useBackend";
import { cn } from "@/lib/utils";
import { Link, useParams } from "@tanstack/react-router";
import {
  AlertCircle,
  ArrowLeft,
  ChevronRight,
  CloudSun,
  Minus,
  TrendingDown,
  TrendingUp,
  Zap,
} from "lucide-react";
import { motion } from "motion/react";

// ── Helpers ───────────────────────────────────────────────────────────────────

function ConfidenceBadge({ value }: { value: number }) {
  const color =
    value >= 75
      ? "border-primary/50 text-primary bg-primary/10"
      : value >= 65
        ? "border-accent/50 text-accent bg-accent/10"
        : "border-border/50 text-muted-foreground bg-muted/20";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-mono uppercase tracking-widest",
        color,
      )}
    >
      <Zap className="w-2.5 h-2.5" />
      {value}%
    </span>
  );
}

// ── Loading skeleton ──────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      <Skeleton className="h-5 w-24 rounded" />
      <div className="space-y-2">
        <Skeleton className="h-8 w-64 rounded" />
        <Skeleton className="h-4 w-40 rounded" />
      </div>
      {[1, 2, 3, 4].map((i) => (
        <Skeleton key={i} className="h-32 w-full rounded-xl" />
      ))}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function MlbInvestigationPage() {
  const { gamePk } = useParams({ from: "/mlb/$gamePk" });
  const { data: games, isLoading, isError } = useMlbGames();

  if (isLoading) return <LoadingSkeleton />;

  if (isError || !games) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 flex flex-col items-center gap-4">
        <AlertCircle className="w-8 h-8 text-destructive" />
        <p className="text-sm font-mono text-muted-foreground">
          Could not load MLB games.
        </p>
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-primary text-sm font-mono hover:underline"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Games
        </Link>
      </div>
    );
  }

  const game = games.find((g) => String(g.gamePk) === gamePk);

  if (!game) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 flex flex-col items-center gap-4">
        <AlertCircle className="w-8 h-8 text-muted-foreground/50" />
        <p className="font-display text-lg font-semibold text-foreground">
          Game not found
        </p>
        <p className="text-sm font-mono text-muted-foreground">
          gamePk {gamePk} isn't in today's slate.
        </p>
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-primary/40 text-primary text-sm font-mono hover:bg-primary/5 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Games
        </Link>
      </div>
    );
  }

  // ── Compute signals ─────────────────────────────────────────────────────────

  interface ScoredSignal {
    name: string;
    description: string;
    confidence: number;
    direction: "OVER" | "UNDER" | "HOME" | "AWAY";
  }

  const signals: ScoredSignal[] = [];

  const parkDev = game.parkFactor.runFactor - 100;
  if (Math.abs(parkDev) >= 5) {
    signals.push({
      name: "Park Factor",
      description: `${game.venueName} run factor ${game.parkFactor.runFactor} (${parkDev > 0 ? "hitter-friendly" : "pitcher-friendly"}) — ${game.parkFactor.description}`,
      confidence: Math.abs(parkDev) >= 10 ? 65 : 58,
      direction: parkDev > 0 ? "OVER" : "UNDER",
    });
  }

  if (game.weatherSignal !== "NEUTRAL") {
    signals.push({
      name: "Weather",
      description: game.weatherDescription,
      confidence: 62,
      direction: game.weatherSignal as "OVER" | "UNDER",
    });
  }

  const homeEra = game.homePitcher?.era ?? null;
  const awayEra = game.awayPitcher?.era ?? null;
  if (homeEra !== null && awayEra !== null) {
    const diff = awayEra - homeEra;
    if (Math.abs(diff) >= 1.0) {
      signals.push({
        name: "Pitcher Matchup",
        description: `ERA advantage: ${diff > 0 ? game.homeTeam.name : game.awayTeam.name} (${Math.min(homeEra, awayEra).toFixed(2)} vs ${Math.max(homeEra, awayEra).toFixed(2)})`,
        confidence: Math.abs(diff) >= 1.5 ? 68 : 58,
        direction: diff > 0 ? "HOME" : "AWAY",
      });
    }
  }

  // ── Find top convergence ────────────────────────────────────────────────────

  const dirCount: Record<string, number> = {};
  for (const s of signals) {
    dirCount[s.direction] = (dirCount[s.direction] ?? 0) + 1;
  }
  const sorted = Object.entries(dirCount).sort((a, b) => b[1] - a[1]);
  const topDir = sorted[0]?.[0] ?? null;
  const topCount = sorted[0]?.[1] ?? 0;
  const aligned = signals.filter((s) => s.direction === topDir);
  const avgConf =
    aligned.length > 0
      ? aligned.reduce((a, b) => a + b.confidence, 0) / aligned.length
      : 0;
  const confidence = Math.min(
    95,
    Math.round(avgConf + Math.min(20, (topCount - 1) * 7)),
  );

  const homeAbbr = game.homeTeam.abbreviation;
  const awayAbbr = game.awayTeam.abbreviation;

  let betText = "";
  if (topCount >= 2) {
    if (topDir === "OVER") betText = `Over — ${game.venueName}`;
    else if (topDir === "UNDER") betText = `Under — ${game.venueName}`;
    else if (topDir === "HOME") betText = `${homeAbbr} ML on FanDuel`;
    else if (topDir === "AWAY") betText = `${awayAbbr} ML on FanDuel`;
  }

  const isLive = game.status === "inProgress";
  const isFinal = game.status === "final";

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      {/* Back nav */}
      <motion.div
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.25 }}
        className="mb-5"
      >
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground text-[11px] font-mono uppercase tracking-widest transition-colors"
        >
          <ArrowLeft className="w-3 h-3" />
          All Games
        </Link>
      </motion.div>

      {/* Game header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mb-6"
      >
        <div className="flex items-center gap-2 mb-2">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-[10px] font-mono uppercase tracking-widest",
              isLive
                ? "border-primary/50 text-primary bg-primary/10"
                : isFinal
                  ? "border-border/30 text-muted-foreground/70 bg-transparent"
                  : "border-border/50 text-muted-foreground bg-muted/30",
            )}
          >
            <span
              className={cn(
                "w-1.5 h-1.5 rounded-full",
                isLive
                  ? "bg-primary animate-pulse"
                  : isFinal
                    ? "bg-muted-foreground/50"
                    : "bg-muted-foreground",
              )}
            />
            {isLive ? "Live" : isFinal ? "Final" : "Upcoming"}
          </span>
          <span className="text-[11px] font-mono text-muted-foreground/70">
            {game.displayTime}
          </span>
        </div>

        <h1 className="font-display text-3xl font-bold text-foreground tracking-tight">
          {awayAbbr}{" "}
          <span className="text-muted-foreground font-normal text-2xl">@</span>{" "}
          {homeAbbr}
        </h1>
        <p className="text-sm font-body text-muted-foreground mt-1">
          {game.awayTeam.name} at {game.homeTeam.name} · {game.venueName}
        </p>

        {(isLive || isFinal) &&
          game.awayScore !== undefined &&
          game.homeScore !== undefined && (
            <div className="mt-3 inline-flex items-center gap-3 px-4 py-2 rounded-lg border border-border/40 bg-muted/20">
              <span className="font-display text-xl font-bold">
                {game.awayScore}
              </span>
              <span className="text-muted-foreground font-mono text-sm">—</span>
              <span className="font-display text-xl font-bold">
                {game.homeScore}
              </span>
            </div>
          )}

        <div className="mt-4 h-px bg-gradient-to-r from-primary/30 via-border/40 to-transparent" />
      </motion.div>

      <div className="space-y-4">
        {/* Pitcher matchup */}
        {(game.homePitcher || game.awayPitcher) && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, delay: 0.05 }}
            className="rounded-xl border border-border/60 bg-card p-5"
          >
            <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground/60 mb-3">
              Pitcher Matchup
            </p>
            <div className="grid grid-cols-2 gap-4">
              {[
                {
                  label: `${awayAbbr} Away Starter`,
                  pitcher: game.awayPitcher,
                },
                {
                  label: `${homeAbbr} Home Starter`,
                  pitcher: game.homePitcher,
                },
              ].map(({ label, pitcher }) => (
                <div key={label} className="space-y-1">
                  <p className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground">
                    {label}
                  </p>
                  {pitcher ? (
                    <>
                      <p className="text-sm font-mono text-foreground font-semibold">
                        {pitcher.name}
                      </p>
                      <p className="text-[11px] font-mono text-muted-foreground/70">
                        ERA {pitcher.era != null ? pitcher.era.toFixed(2) : "—"}
                      </p>
                    </>
                  ) : (
                    <p className="text-sm font-mono text-muted-foreground/50">
                      TBD
                    </p>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Park factor */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, delay: 0.1 }}
          className="rounded-xl border border-border/60 bg-card p-5"
        >
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground/60">
              Park Factor
            </p>
            <div className="flex items-center gap-1.5">
              {parkDev > 5 ? (
                <TrendingUp className="w-3.5 h-3.5 text-primary" />
              ) : parkDev < -5 ? (
                <TrendingDown className="w-3.5 h-3.5 text-chart-4" />
              ) : (
                <Minus className="w-3.5 h-3.5 text-muted-foreground/50" />
              )}
              <span
                className={cn(
                  "text-sm font-mono font-bold",
                  parkDev > 5
                    ? "text-primary"
                    : parkDev < -5
                      ? "text-chart-4"
                      : "text-muted-foreground",
                )}
              >
                {game.parkFactor.runFactor}
              </span>
            </div>
          </div>

          {/* Bar */}
          <div className="relative h-2 rounded-full bg-muted/40 mb-3 overflow-hidden">
            <div
              className={cn(
                "absolute top-0 h-full rounded-full transition-all",
                parkDev > 0
                  ? "bg-primary/60 left-1/2"
                  : "bg-chart-4/60 right-1/2",
              )}
              style={{
                width: `${Math.min(50, Math.abs(parkDev) * 2)}%`,
              }}
            />
            <div className="absolute top-0 bottom-0 left-1/2 w-px bg-border/60" />
          </div>

          <p className="text-xs font-body text-muted-foreground">
            {game.parkFactor.description}
          </p>
          {Math.abs(parkDev) >= 5 && (
            <p className="text-[10px] font-mono text-muted-foreground/60 mt-1">
              Signal: {parkDev > 0 ? "OVER lean" : "UNDER lean"} ·{" "}
              {Math.abs(parkDev) >= 10 ? "strong" : "moderate"}
            </p>
          )}
        </motion.div>

        {/* Weather */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, delay: 0.15 }}
          className="rounded-xl border border-border/60 bg-card p-5"
        >
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground/60">
              Weather Signal
            </p>
            <div className="flex items-center gap-1.5">
              <CloudSun className="w-3.5 h-3.5 text-muted-foreground/60" />
              <span
                className={cn(
                  "text-[10px] font-mono uppercase tracking-widest font-semibold",
                  game.weatherSignal === "OVER"
                    ? "text-primary"
                    : game.weatherSignal === "UNDER"
                      ? "text-chart-4"
                      : "text-muted-foreground/60",
                )}
              >
                {game.weatherSignal}
              </span>
            </div>
          </div>
          <p className="text-xs font-body text-muted-foreground">
            {game.weatherDescription}
          </p>
        </motion.div>

        {/* THE PLAY */}
        {topCount >= 2 && betText && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, delay: 0.2 }}
            className="rounded-xl border border-primary/40 bg-primary/5 overflow-hidden"
          >
            <div className="h-[2px] bg-gradient-to-r from-primary/60 via-primary/30 to-transparent" />
            <div className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-primary/70">
                  The Play
                </p>
                <ConfidenceBadge value={confidence} />
              </div>

              <div>
                <p className="font-display text-2xl font-bold text-foreground tracking-tight">
                  {betText}
                </p>
                <p className="text-xs font-mono text-muted-foreground/70 mt-1">
                  {topCount} signals converging on {topDir} —{" "}
                  {topCount >= 3 ? "high" : "moderate"} conviction
                </p>
              </div>

              {aligned.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-primary/20">
                  <p className="text-[9px] font-mono uppercase tracking-[0.2em] text-muted-foreground/50">
                    Evidence
                  </p>
                  {aligned.map((sig) => (
                    <div key={sig.name} className="flex items-start gap-2">
                      <span className="w-1 h-1 rounded-full bg-primary mt-1.5 shrink-0" />
                      <div className="min-w-0">
                        <span className="text-[10px] font-mono text-primary mr-1.5">
                          {sig.name}:
                        </span>
                        <span className="text-[10px] font-mono text-muted-foreground">
                          {sig.description}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-2 pt-1">
                <Link
                  to="/plays"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-primary/40 bg-primary/5 text-primary text-[10px] font-mono uppercase tracking-widest hover:bg-primary/10 hover:border-primary/60 transition-all"
                >
                  All Plays
                  <ChevronRight className="w-3 h-3" />
                </Link>
                <span className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border/40 text-muted-foreground/60 text-[10px] font-mono uppercase tracking-widest cursor-not-allowed select-none">
                  FanDuel →
                </span>
              </div>
            </div>
          </motion.div>
        )}

        {/* No convergence notice */}
        {topCount < 2 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, delay: 0.2 }}
            className="rounded-xl border border-border/40 bg-muted/10 p-5 text-center"
          >
            <p className="text-sm font-mono text-muted-foreground">
              Not enough converging signals for a strong play.
            </p>
            <p className="text-[10px] font-mono text-muted-foreground/60 mt-1">
              {signals.length === 0
                ? "No signals detected today."
                : `${signals.length} signal${signals.length > 1 ? "s" : ""} detected — need ≥2 pointing same direction.`}
            </p>
          </motion.div>
        )}
      </div>
    </div>
  );
}
