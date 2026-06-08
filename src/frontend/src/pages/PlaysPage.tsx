import { Skeleton } from "@/components/ui/skeleton";
import { type AnyPlay, usePlays } from "@/hooks/useBackend";
import { cn } from "@/lib/utils";
import { sendNtfyNotification } from "@/pages/SettingsPage";
import { Link } from "@tanstack/react-router";
import {
  AlertCircle,
  ArrowRight,
  ChevronRight,
  ExternalLink,
  Target,
  Zap,
} from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useRef } from "react";

// ── Confidence badge ──────────────────────────────────────────────────────────
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
      {value}% confidence
    </span>
  );
}

// ── Sport badge ───────────────────────────────────────────────────────────────
function SportBadge({ sport }: { sport: "NBA" | "MLB" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded border text-[10px] font-mono uppercase tracking-widest",
        sport === "NBA"
          ? "border-chart-2/50 text-chart-2 bg-chart-2/10"
          : "border-chart-3/50 text-chart-3 bg-chart-3/10",
      )}
    >
      {sport}
    </span>
  );
}

// ── Play card ─────────────────────────────────────────────────────────────────
function PlayCard({ play, index }: { play: AnyPlay; index: number }) {
  const isHot = play.confidence >= 75;
  const isSolid = play.confidence >= 65 && !isHot;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, delay: index * 0.07 }}
      className={cn(
        "rounded-xl border overflow-hidden",
        isHot
          ? "border-primary/60 bg-primary/5 shadow-[0_0_24px_-4px_oklch(var(--primary)/0.25)]"
          : isSolid
            ? "border-accent/40 bg-accent/5"
            : "border-border/60 bg-card",
      )}
    >
      {/* Accent bar — thicker & brighter for hot plays */}
      <div
        className={cn(
          "bg-gradient-to-r to-transparent",
          isHot
            ? "h-[3px] from-primary via-primary/60"
            : "h-[2px] from-primary/60 via-primary/30",
        )}
      />

      {isHot && (
        <div className="flex items-center gap-2 px-5 pt-3 pb-0">
          <Zap className="w-3.5 h-3.5 text-primary animate-pulse" />
          <span className="text-[10px] font-mono uppercase tracking-widest text-primary font-bold">
            High Confidence Play
          </span>
        </div>
      )}

      <div className="p-5 space-y-4">
        {/* Badges row */}
        <div className="flex items-center gap-2 flex-wrap">
          <SportBadge sport={play.sport} />
          <ConfidenceBadge value={play.confidence} />
          <span className="ml-auto text-[10px] font-mono text-muted-foreground/60">
            {play.gameLabel} · {play.displayTime}
          </span>
        </div>

        {/* Bet text — larger for hot plays */}
        <div>
          <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground mb-1">
            Bet on FanDuel
          </p>
          <p
            className={cn(
              "font-display font-bold text-foreground tracking-tight",
              isHot ? "text-3xl" : "text-2xl",
            )}
          >
            {play.betText}
          </p>
          <p className="text-xs font-mono text-muted-foreground/70 mt-1">
            {play.summaryText}
          </p>
        </div>

        {/* Evidence bullets */}
        {play.signals.length > 0 && (
          <div className="space-y-1.5 pt-1 border-t border-border/30">
            <p className="text-[9px] font-mono uppercase tracking-[0.2em] text-muted-foreground/50 mb-2">
              Why this bet
            </p>
            {play.signals.slice(0, 3).map((sig) => (
              <div key={sig.name} className="flex items-start gap-2">
                <span
                  className={cn(
                    "w-1 h-1 rounded-full mt-1.5 shrink-0",
                    isHot ? "bg-primary" : "bg-muted-foreground/60",
                  )}
                />
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

        {/* Actions */}
        <div className="flex items-center gap-2 pt-1">
          <a
            href={
              play.linkTo === "/game/$gameId"
                ? `/game/${play.linkParams.gameId}${play.linkSearch?.gameDate ? `?gameDate=${play.linkSearch.gameDate}` : ""}`
                : `/mlb/${play.linkParams.gamePk}`
            }
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-primary/40 bg-primary/5 text-primary text-[10px] font-mono uppercase tracking-widest hover:bg-primary/10 hover:border-primary/60 transition-all"
          >
            Full Analysis
            <ChevronRight className="w-3 h-3" />
          </a>
          <span className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border/40 text-muted-foreground/60 text-[10px] font-mono uppercase tracking-widest cursor-not-allowed select-none">
            <ExternalLink className="w-3 h-3" />
            FanDuel →
          </span>
        </div>
      </div>
    </motion.div>
  );
}

// ── Section header ─────────────────────────────────────────────────────────────
function SectionHeader({
  sport,
  count,
}: { sport: "NBA" | "MLB"; count: number }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div
        className={cn(
          "w-7 h-7 rounded-lg border flex items-center justify-center shrink-0",
          sport === "NBA"
            ? "border-chart-2/40 bg-chart-2/10"
            : "border-chart-3/40 bg-chart-3/10",
        )}
      >
        <ArrowRight
          className={cn(
            "w-3.5 h-3.5",
            sport === "NBA" ? "text-chart-2" : "text-chart-3",
          )}
        />
      </div>
      <div>
        <h2 className="font-display text-base font-bold text-foreground tracking-tight">
          {sport} Plays
        </h2>
        <p className="text-[10px] font-mono text-muted-foreground/60">
          {count} strong bet{count !== 1 ? "s" : ""} · ≥2 signals converged
        </p>
      </div>
    </div>
  );
}

// ── Loading skeleton ──────────────────────────────────────────────────────────
function PlaySkeleton() {
  return (
    <div className="rounded-xl border border-border/40 bg-card overflow-hidden">
      <div className="h-[2px] bg-gradient-to-r from-border/40 to-transparent" />
      <div className="p-5 space-y-4">
        <div className="flex gap-2">
          <Skeleton className="h-5 w-12 rounded" />
          <Skeleton className="h-5 w-24 rounded" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-3 w-20 rounded" />
          <Skeleton className="h-7 w-48 rounded" />
          <Skeleton className="h-3 w-64 rounded" />
        </div>
        <div className="space-y-1.5 pt-2 border-t border-border/30">
          <Skeleton className="h-3 w-full rounded" />
          <Skeleton className="h-3 w-5/6 rounded" />
          <Skeleton className="h-3 w-4/6 rounded" />
        </div>
      </div>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────
function EmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col items-center justify-center py-24 space-y-4"
    >
      <div className="w-16 h-16 rounded-2xl border border-border/40 bg-muted/20 flex items-center justify-center">
        <Target className="w-7 h-7 text-muted-foreground/40" />
      </div>
      <div className="text-center space-y-1.5">
        <p className="font-display text-lg font-semibold text-foreground">
          No Strong Plays Today
        </p>
        <p className="text-sm font-mono text-muted-foreground max-w-sm">
          No game has ≥2 converging signals right now. Check back later or
          browse individual games for details.
        </p>
      </div>
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-primary/40 text-primary text-sm font-mono hover:bg-primary/5 transition-colors"
      >
        View All Games
        <ChevronRight className="w-3.5 h-3.5" />
      </Link>
    </motion.div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function PlaysPage() {
  const { data, isLoading, isError, error } = usePlays();
  const prevCountRef = useRef<number>(-1);

  const todayLabel = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const nbaPlays = data?.nbaPlays ?? [];
  const mlbPlays = data?.mlbPlays ?? [];
  const totalPlays = nbaPlays.length + mlbPlays.length;

  // Notify via ntfy.sh when new plays appear
  useEffect(() => {
    if (!data || totalPlays === 0) return;
    const prev = prevCountRef.current;
    if (prev === -1) {
      // First load — set baseline without notifying
      prevCountRef.current = totalPlays;
      return;
    }
    if (totalPlays > prev) {
      prevCountRef.current = totalPlays;
      const topic = localStorage.getItem("ntfy_topic");
      if (topic) {
        const allPlays = [...nbaPlays, ...mlbPlays];
        const newPlays = allPlays.slice(0, totalPlays - prev);
        const body = newPlays
          .map((p) => `• ${p.betText} (${p.confidence}% conf)`)
          .join("\n");
        sendNtfyNotification(
          topic,
          `EdgeStack — ${totalPlays - prev} new play${totalPlays - prev > 1 ? "s" : ""}`,
          body,
        );
      }
    }
  }, [totalPlays, data, nbaPlays, mlbPlays]);

  return (
    <div className="max-w-screen-2xl mx-auto px-4 py-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mb-7"
      >
        <div className="flex items-center gap-2 mb-1.5">
          <Target className="w-3.5 h-3.5 text-primary" />
          <span className="text-[10px] font-mono uppercase tracking-[0.25em] text-primary font-semibold">
            Today's Plays
          </span>
          <span className="w-1 h-1 rounded-full bg-border/60" />
          <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-muted-foreground">
            {todayLabel}
          </span>
        </div>
        <h1 className="font-display text-2xl font-bold text-foreground tracking-tight">
          Strong Bets · NBA + MLB
        </h1>
        <p className="text-sm font-body text-muted-foreground mt-0.5">
          FanDuel-focused · Only shows games where ≥2 signals converge
        </p>
        <div className="mt-4 h-px bg-gradient-to-r from-primary/30 via-border/40 to-transparent" />
      </motion.div>

      {/* Loading */}
      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <PlaySkeleton key={i} />
          ))}
        </div>
      )}

      {/* Error */}
      {isError && (
        <div className="flex flex-col items-center justify-center py-16 space-y-4">
          <AlertCircle className="w-8 h-8 text-destructive" />
          <p className="text-sm font-mono text-muted-foreground">
            {error instanceof Error ? error.message : "Could not load plays"}
          </p>
        </div>
      )}

      {/* Content */}
      {!isLoading && !isError && (
        <>
          {totalPlays === 0 && <EmptyState />}

          {nbaPlays.length > 0 && (
            <section className="mb-8">
              <SectionHeader sport="NBA" count={nbaPlays.length} />
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {nbaPlays.map((play, i) => (
                  <PlayCard key={play.gameId} play={play} index={i} />
                ))}
              </div>
            </section>
          )}

          {mlbPlays.length > 0 && (
            <section>
              <SectionHeader sport="MLB" count={mlbPlays.length} />
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {mlbPlays.map((play, i) => (
                  <PlayCard
                    key={play.gameId}
                    play={play}
                    index={nbaPlays.length + i}
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
