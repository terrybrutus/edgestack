import { Skeleton } from "@/components/ui/skeleton";
import {
  type MlbGameCard as MlbGameCardData,
  useMlbGames,
  useTodayGames,
} from "@/hooks/useBackend";
import { cn, teamFullName } from "@/lib/utils";
import { formatMoneyline, formatSpread } from "@/types";
import type { Game, GameStatus } from "@/types";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useSearch } from "@tanstack/react-router";
import {
  AlertCircle,
  Calendar,
  ChevronRight,
  Clock,
  CloudSun,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Trophy,
  Wifi,
} from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useState } from "react";

// ─── Status config ────────────────────────────────────────────────────────────
type StatusConfig = { label: string; dotClass: string; badgeClass: string };

const STATUS_MAP: Record<string, StatusConfig> = {
  scheduled: {
    label: "Upcoming",
    dotClass: "bg-muted-foreground",
    badgeClass: "text-muted-foreground border-border/50 bg-muted/30",
  },
  inProgress: {
    label: "Live",
    dotClass: "bg-primary animate-pulse",
    badgeClass: "text-primary border-primary/50 bg-primary/10",
  },
  final: {
    label: "Final",
    dotClass: "bg-muted-foreground/50",
    badgeClass: "text-muted-foreground/70 border-border/30 bg-transparent",
  },
  postponed: {
    label: "Postponed",
    dotClass: "bg-accent",
    badgeClass: "text-accent border-accent/40 bg-accent/5",
  },
};

function getStatusConfig(status: GameStatus): StatusConfig {
  const key = status as unknown as string;
  return (
    STATUS_MAP[key] ?? {
      label: key,
      dotClass: "bg-muted-foreground",
      badgeClass: "text-muted-foreground border-border/40",
    }
  );
}

// ─── Odds row ─────────────────────────────────────────────────────────────────
// Teaser row shown on the game card (no inline odds — odds are loaded in investigation room)
function OddsTeaser({
  homeAbbr,
  awayAbbr,
}: { homeAbbr: string; awayAbbr: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground/50">
        {awayAbbr} @ {homeAbbr}
      </span>
      <span className="text-[9px] font-mono text-muted-foreground/40">
        — Spreads · O/U · Moneylines inside
      </span>
    </div>
  );
}

// Parse ISO UTC string to "H:MM PM ET" display string (client-side fallback)
function formatIsoToEtDisplay(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
    timeZoneName: "short",
  });
}

// ─── Game card ────────────────────────────────────────────────────────────────
function GameCard({
  game,
  index,
  gamesDate,
}: { game: Game; index: number; gamesDate: string; isUpcoming: boolean }) {
  const statusConfig = getStatusConfig(game.status);
  const statusStr = (game.status as unknown as string) ?? "";
  const isLive =
    statusStr === "inProgress" ||
    statusStr.toUpperCase().includes("IN_PROGRESS");
  const isFinal = statusStr === "final" || statusStr.startsWith("final_");

  // displayTime may be "8:30 PM ET" (correct) or an ISO string (backend not yet updated)
  const rawDisplay = game.displayTime || "";
  const isIsoDisplay = rawDisplay.includes("T") && rawDisplay.includes("Z");
  const gameTime = isIsoDisplay
    ? formatIsoToEtDisplay(rawDisplay)
    : rawDisplay || "TBD";

  // Compare game date to user's local date — don't rely on backend UTC isUpcoming flag.
  // A game is "not today" if gamesDate differs from the user's local calendar date.
  const localTodayStr = new Date().toLocaleDateString("en-CA"); // "YYYY-MM-DD" in local tz
  const showDatePrefix =
    !isFinal && !isLive && gamesDate && gamesDate !== localTodayStr;

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, delay: index * 0.06 }}
    >
      <Link
        to="/game/$gameId"
        params={{ gameId: game.id }}
        search={{ gameDate: gamesDate }}
        data-ocid={`games.item.${index + 1}`}
        className="block group focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-xl"
      >
        <div
          className={cn(
            "relative rounded-xl border bg-card cursor-pointer overflow-hidden",
            "transition-all duration-200",
            isLive
              ? "border-primary/30 shadow-[0_0_20px_oklch(0.65_0.18_145_/_0.08)] group-hover:border-primary/60 group-hover:shadow-[0_0_30px_oklch(0.65_0.18_145_/_0.15)]"
              : "border-border/50 group-hover:border-primary/35 group-hover:bg-card/90",
          )}
        >
          {/* Live pulse bar at top */}
          {isLive && (
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-primary to-transparent opacity-80" />
          )}

          <div className="p-4">
            {/* Header row: status + series + time */}
            <div className="flex items-center justify-between mb-3 gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-[10px] font-mono uppercase tracking-widest shrink-0",
                    statusConfig.badgeClass,
                  )}
                >
                  <span
                    className={cn(
                      "w-1.5 h-1.5 rounded-full shrink-0",
                      statusConfig.dotClass,
                    )}
                  />
                  {statusConfig.label}
                </span>
                {game.series && (
                  <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wide truncate">
                    {game.series}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {!isFinal && (
                  <>
                    <Clock className="w-3 h-3 text-muted-foreground/60" />
                    <span className="text-[11px] font-mono font-semibold text-foreground/80">
                      {showDatePrefix
                        ? `${new Date(`${gamesDate}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })} · ${gameTime}`
                        : gameTime}
                    </span>
                  </>
                )}
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 group-hover:text-primary transition-colors ml-1" />
              </div>
            </div>

            {/* Matchup */}
            <div className="space-y-1.5 mb-3">
              {/* Away */}
              <div className="flex items-baseline gap-2.5 min-w-0">
                <span className="font-display text-[22px] font-bold text-foreground tracking-tight leading-none">
                  {game.awayTeam.abbreviation}
                </span>
                <span className="text-sm font-body text-muted-foreground truncate">
                  {teamFullName(game.awayTeam.city, game.awayTeam.name)}
                </span>
                {game.awayTeam.record && (
                  <span className="text-[10px] font-mono text-muted-foreground/60 ml-auto shrink-0">
                    {game.awayTeam.record}
                  </span>
                )}
              </div>

              {/* Divider with @ */}
              <div className="flex items-center gap-2">
                <div className="flex-1 h-px bg-border/30" />
                <span className="text-[10px] font-mono text-muted-foreground/50 uppercase">
                  at
                </span>
                <div className="flex-1 h-px bg-border/30" />
              </div>

              {/* Home */}
              <div className="flex items-baseline gap-2.5 min-w-0">
                <span className="font-display text-[22px] font-bold text-foreground tracking-tight leading-none">
                  {game.homeTeam.abbreviation}
                </span>
                <span className="text-sm font-body text-muted-foreground truncate">
                  {teamFullName(game.homeTeam.city, game.homeTeam.name)}
                </span>
                {game.homeTeam.record && (
                  <span className="text-[10px] font-mono text-muted-foreground/60 ml-auto shrink-0">
                    {game.homeTeam.record}
                  </span>
                )}
              </div>
            </div>

            {/* Odds teaser */}
            <div className="pt-2.5 border-t border-border/30">
              <OddsTeaser
                homeAbbr={game.homeTeam.abbreviation}
                awayAbbr={game.awayTeam.abbreviation}
              />
            </div>
          </div>

          {/* Hover CTA footer */}
          <div className="px-4 py-2 border-t border-border/20 bg-muted/10 flex items-center justify-between">
            <span className="text-[9px] font-mono uppercase tracking-[0.2em] text-muted-foreground/50">
              {game.venue}
            </span>
            <span className="text-[9px] font-mono text-primary opacity-0 group-hover:opacity-100 transition-opacity">
              Investigate →
            </span>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

// ─── MLB Game Card ────────────────────────────────────────────────────────────
function MlbGameCard({
  game,
  index,
}: { game: MlbGameCardData; index: number }) {
  const isLive = game.status === "inProgress";
  const isFinal = game.status === "final";
  const parkDev = game.parkFactor.runFactor - 100;
  const hasWeatherSignal = game.weatherSignal !== "NEUTRAL";

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, delay: index * 0.06 }}
    >
      <Link
        to="/mlb/$gamePk"
        params={{ gamePk: String(game.gamePk) }}
        className="block group focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-xl"
      >
        <div
          className={cn(
            "relative rounded-xl border bg-card overflow-hidden cursor-pointer",
            "transition-all duration-200",
            isLive
              ? "border-primary/30 shadow-[0_0_20px_oklch(0.65_0.18_145_/_0.08)] group-hover:border-primary/60"
              : "border-border/50 group-hover:border-primary/35 group-hover:bg-card/90",
          )}
        >
          {isLive && (
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-primary to-transparent opacity-80" />
          )}

          <div className="p-4 space-y-3">
            {/* Header */}
            <div className="flex items-center justify-between">
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
              <span className="text-[11px] font-mono font-semibold text-foreground/80">
                {game.displayTime}
              </span>
            </div>

            {/* Matchup */}
            <div className="space-y-1.5">
              <div className="flex items-baseline gap-2.5">
                <span className="font-display text-[22px] font-bold text-foreground tracking-tight leading-none">
                  {game.awayTeam.abbreviation}
                </span>
                <span className="text-sm font-body text-muted-foreground truncate">
                  {game.awayTeam.name}
                </span>
                {(isLive || isFinal) && game.awayScore !== undefined && (
                  <span className="ml-auto font-display text-xl font-bold text-foreground">
                    {game.awayScore}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-px bg-border/30" />
                <span className="text-[10px] font-mono text-muted-foreground/50 uppercase">
                  at
                </span>
                <div className="flex-1 h-px bg-border/30" />
              </div>
              <div className="flex items-baseline gap-2.5">
                <span className="font-display text-[22px] font-bold text-foreground tracking-tight leading-none">
                  {game.homeTeam.abbreviation}
                </span>
                <span className="text-sm font-body text-muted-foreground truncate">
                  {game.homeTeam.name}
                </span>
                {(isLive || isFinal) && game.homeScore !== undefined && (
                  <span className="ml-auto font-display text-xl font-bold text-foreground">
                    {game.homeScore}
                  </span>
                )}
              </div>
            </div>

            {/* Pitchers */}
            {(game.homePitcher || game.awayPitcher) && (
              <div className="pt-2 border-t border-border/30 grid grid-cols-2 gap-2">
                {[
                  { label: "Away SP", pitcher: game.awayPitcher },
                  { label: "Home SP", pitcher: game.homePitcher },
                ].map(({ label, pitcher }) => (
                  <div key={label} className="space-y-0.5">
                    <p className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground">
                      {label}
                    </p>
                    {pitcher ? (
                      <>
                        <p className="text-[11px] font-mono text-foreground truncate">
                          {pitcher.name}
                        </p>
                        <p className="text-[10px] font-mono text-muted-foreground/70">
                          {pitcher.era != null
                            ? `ERA ${pitcher.era.toFixed(2)}`
                            : "ERA —"}
                        </p>
                      </>
                    ) : (
                      <p className="text-[11px] font-mono text-muted-foreground/50">
                        TBD
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Signals row */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {/* Park factor */}
              {Math.abs(parkDev) >= 5 && (
                <span
                  className={cn(
                    "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono border",
                    parkDev > 0
                      ? "border-primary/40 text-primary bg-primary/5"
                      : "border-chart-4/40 text-chart-4 bg-chart-4/5",
                  )}
                >
                  {parkDev > 0 ? (
                    <TrendingUp className="w-2.5 h-2.5" />
                  ) : (
                    <TrendingDown className="w-2.5 h-2.5" />
                  )}
                  Park {parkDev > 0 ? "+" : ""}
                  {parkDev}
                </span>
              )}
              {/* Weather signal */}
              {hasWeatherSignal && (
                <span
                  className={cn(
                    "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono border",
                    game.weatherSignal === "OVER"
                      ? "border-primary/40 text-primary bg-primary/5"
                      : "border-chart-4/40 text-chart-4 bg-chart-4/5",
                  )}
                >
                  <CloudSun className="w-2.5 h-2.5" />
                  {game.weatherSignal === "OVER" ? "Weather ↑" : "Weather ↓"}
                </span>
              )}
              {/* Venue */}
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-mono border border-border/30 text-muted-foreground/60">
                {game.venueName}
              </span>
            </div>
          </div>
          {/* Hover CTA footer */}
          <div className="px-4 py-2 border-t border-border/20 bg-muted/10 flex items-center justify-between">
            <span className="text-[9px] font-mono uppercase tracking-[0.2em] text-muted-foreground/50">
              MLB · {game.venueName}
            </span>
            <span className="text-[9px] font-mono text-primary opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
              Investigate
              <ChevronRight className="w-2.5 h-2.5" />
            </span>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

// ─── MLB Games Section ────────────────────────────────────────────────────────
function MlbGamesSection() {
  const { data: games, isLoading, isError, error, refetch } = useMlbGames();

  if (isLoading) return <LoadingSkeleton />;

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-4">
        <AlertCircle className="w-8 h-8 text-destructive" />
        <p className="text-sm font-mono text-muted-foreground">
          {error instanceof Error ? error.message : "Could not load MLB games"}
        </p>
        <button
          type="button"
          onClick={() => refetch()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-primary/40 text-primary text-xs font-mono"
        >
          <RefreshCw className="w-3 h-3" />
          Retry
        </button>
      </div>
    );
  }

  if (!games?.length) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-3">
        <Trophy className="w-8 h-8 text-muted-foreground/30" />
        <p className="font-display text-lg font-semibold text-foreground">
          No MLB Games Today
        </p>
        <p className="text-sm font-body text-muted-foreground">
          Check back on the next game day.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {games.map((game, i) => (
        <MlbGameCard key={game.gamePk} game={game} index={i} />
      ))}
    </div>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────
function LoadingSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="rounded-xl border border-border/40 bg-card overflow-hidden"
        >
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-20 rounded" />
              <Skeleton className="h-4 w-16 rounded" />
            </div>
            <div className="space-y-2">
              <div className="flex items-baseline gap-2">
                <Skeleton className="h-7 w-12 rounded" />
                <Skeleton className="h-4 w-32 rounded" />
              </div>
              <Skeleton className="h-px w-full" />
              <div className="flex items-baseline gap-2">
                <Skeleton className="h-7 w-12 rounded" />
                <Skeleton className="h-4 w-28 rounded" />
              </div>
            </div>
            <Skeleton className="h-4 w-full rounded" />
          </div>
          <div className="px-4 py-2 border-t border-border/20">
            <Skeleton className="h-3 w-24 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Refresh indicator ────────────────────────────────────────────────────────
function RefreshIndicator({ dataUpdatedAt }: { dataUpdatedAt: number }) {
  const [label, setLabel] = useState("Just now");

  useEffect(() => {
    const update = () => {
      const diff = Math.floor((Date.now() - dataUpdatedAt) / 1000);
      if (diff < 60) setLabel("Just now");
      else if (diff < 120) setLabel("1 min ago");
      else setLabel(`${Math.floor(diff / 60)} min ago`);
    };
    update();
    const timer = setInterval(update, 30_000);
    return () => clearInterval(timer);
  }, [dataUpdatedAt]);

  return (
    <div className="flex items-center gap-1.5">
      <Wifi className="w-3 h-3 text-muted-foreground/50" />
      <span className="text-[10px] font-mono text-muted-foreground/60">
        Refreshed {label}
      </span>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function GamesPage() {
  const queryClient = useQueryClient();
  const search = useSearch({ strict: false }) as { sport?: string };
  const [sport, setSport] = useState<"nba" | "mlb">(
    search.sport === "mlb" ? "mlb" : "nba",
  );
  const {
    data: gamesResponse,
    isLoading,
    isError,
    error,
    dataUpdatedAt,
    refetch,
    isFetching,
  } = useTodayGames();

  const games = gamesResponse?.games ?? [];
  const gamesDate = gamesResponse?.gamesDate ?? "";
  const isUpcomingDate = gamesResponse?.isUpcomingDate ?? false;

  // Sort games by start time
  const sortedGames = [...games].sort((a, b) => {
    const parseTime = (t: string | undefined) => {
      if (!t) return Number.POSITIVE_INFINITY;
      const d = new Date(t);
      return Number.isNaN(d.getTime()) ? Number.POSITIVE_INFINITY : d.getTime();
    };
    return parseTime(a.gameTime) - parseTime(b.gameTime);
  });

  // Format gamesDate (YYYY-MM-DD) to friendly string like "Thursday, May 30"
  const formatGamesDate = (dateStr: string): string => {
    if (!dateStr) return "";
    const [year, month, day] = dateStr.split("-").map(Number);
    const d = new Date(year, month - 1, day);
    return d.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  };

  // Use local date (not backend UTC) to decide if the games slate is "today" or "upcoming"
  const localTodayStr = new Date().toLocaleDateString("en-CA");
  const isLocallyUpcoming = gamesDate !== "" && gamesDate !== localTodayStr;
  const pageTitle = isLocallyUpcoming ? "Upcoming Games" : "Today's Games";

  const todayLabel = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const handleRetry = () => {
    queryClient.invalidateQueries({ queryKey: ["today-games"] });
    refetch();
  };

  // Dev debug bar
  const devDebug = import.meta.env.DEV ? (
    <div className="mt-3 px-3 py-2 rounded-lg border border-border/30 bg-muted/20 text-[10px] font-mono text-muted-foreground/70">
      <span className="text-accent/70 uppercase tracking-wider">dev</span>
      {" · "}
      <span>
        returned: {games?.length ?? "—"} game(s) · shown: {sortedGames.length} ·
        date: {gamesDate} · upcoming: {String(isUpcomingDate)}
      </span>
    </div>
  ) : null;

  return (
    <div className="max-w-screen-2xl mx-auto px-4 py-6">
      {/* Page header */}
      <div className="mb-7">
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="flex items-start justify-between gap-4 flex-wrap"
        >
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <Trophy className="w-3.5 h-3.5 text-primary" />
              <span className="text-[10px] font-mono uppercase tracking-[0.25em] text-primary font-semibold">
                {sport === "nba" ? "NBA" : "MLB"}
              </span>
              <span className="w-1 h-1 rounded-full bg-border/60" />
              <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-muted-foreground">
                {todayLabel}
              </span>
            </div>
            <h1 className="font-display text-2xl font-bold text-foreground tracking-tight">
              {sport === "mlb" ? "MLB Games" : pageTitle}
            </h1>
            <p className="text-sm font-body text-muted-foreground mt-0.5">
              {sport === "mlb"
                ? "Pitcher matchups · park factors · weather signals"
                : isLocallyUpcoming
                  ? `Next slate: ${formatGamesDate(gamesDate)}`
                  : "Select a game to open the investigation room"}
            </p>
          </div>

          <div className="flex items-center gap-3 pt-1">
            {dataUpdatedAt > 0 && (
              <RefreshIndicator dataUpdatedAt={dataUpdatedAt} />
            )}
            <button
              type="button"
              onClick={handleRetry}
              disabled={isFetching}
              data-ocid="games.refresh_button"
              className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-border/40 text-[10px] font-mono uppercase tracking-widest",
                "text-muted-foreground hover:text-foreground hover:border-border/70 transition-colors",
                isFetching && "opacity-50 cursor-not-allowed",
              )}
            >
              <RefreshCw
                className={cn("w-3 h-3", isFetching && "animate-spin")}
              />
              Refresh
            </button>
          </div>
        </motion.div>

        {/* Sport switcher */}
        <div className="mt-4 flex gap-1 border-b border-border/40">
          {(["nba", "mlb"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSport(s)}
              className={cn(
                "relative px-4 py-2 text-xs font-mono uppercase tracking-widest transition-colors",
                sport === s
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {s}
              {sport === s && (
                <motion.div
                  layoutId="sport-tab-indicator"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t-full"
                />
              )}
            </button>
          ))}
        </div>

        {devDebug}

        {/* Upcoming date banner */}
        {isLocallyUpcoming && gamesDate && !isLoading && !isError && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            className="mt-4 flex items-center gap-3 px-4 py-3 rounded-lg border border-accent/30 bg-accent/5"
            data-ocid="games.upcoming_banner"
          >
            <Calendar className="w-4 h-4 text-accent shrink-0" />
            <div>
              <p className="text-sm font-mono font-semibold text-accent">
                No games today · Showing slate for {formatGamesDate(gamesDate)}
              </p>
              <p className="text-[11px] font-body text-muted-foreground">
                Odds and analysis available for these upcoming games
              </p>
            </div>
          </motion.div>
        )}

        {/* Divider */}
        <div className="mt-4 h-px bg-gradient-to-r from-primary/30 via-border/40 to-transparent" />
      </div>

      {/* MLB view */}
      {sport === "mlb" && <MlbGamesSection />}

      {/* NBA view */}
      {/* Loading */}
      {sport === "nba" && isLoading && <LoadingSkeleton />}

      {/* Error — genuine API failure only */}
      {sport === "nba" && isError && (
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.25 }}
          className="flex flex-col items-center justify-center py-16 space-y-4"
          data-ocid="games.error_state"
        >
          <div className="w-14 h-14 rounded-xl border border-destructive/30 bg-destructive/5 flex items-center justify-center">
            <AlertCircle className="w-6 h-6 text-destructive" />
          </div>
          <div className="text-center space-y-1.5">
            <p className="font-display text-base font-semibold text-foreground">
              Could not load today&apos;s games
            </p>
            <p className="text-sm font-mono text-muted-foreground max-w-sm">
              {error instanceof Error
                ? error.message
                : "Connection error — check your network"}
            </p>
          </div>
          <button
            type="button"
            onClick={handleRetry}
            data-ocid="games.retry_button"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-primary/40 bg-primary/5 text-primary text-sm font-mono uppercase tracking-widest hover:bg-primary/10 hover:border-primary/60 transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Retry
          </button>
        </motion.div>
      )}

      {/* Empty — no games found */}
      {sport === "nba" &&
        !isLoading &&
        !isError &&
        sortedGames.length === 0 &&
        !isUpcomingDate && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            className="flex flex-col items-center justify-center py-20 space-y-4"
            data-ocid="games.empty_state"
          >
            <div className="relative">
              <div className="w-16 h-16 rounded-2xl bg-muted/40 border border-border/40 flex items-center justify-center">
                <Trophy className="w-7 h-7 text-muted-foreground/60" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-lg bg-card border border-border/40 flex items-center justify-center">
                <Clock className="w-3.5 h-3.5 text-muted-foreground/60" />
              </div>
            </div>
            <div className="text-center space-y-1.5">
              <p className="font-display text-lg font-semibold text-foreground">
                No NBA Games Today
              </p>
              <p className="text-sm font-body text-muted-foreground">
                No games scheduled for today&apos;s slate.
              </p>
              <p className="text-xs font-mono text-muted-foreground/60">
                Check back on the next game day
              </p>
            </div>
            <button
              type="button"
              onClick={handleRetry}
              disabled={isFetching}
              data-ocid="games.empty_refresh_button"
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border/40 text-[10px] font-mono uppercase tracking-widest",
                "text-muted-foreground hover:text-foreground hover:border-border/70 transition-colors",
                isFetching && "opacity-50 cursor-not-allowed",
              )}
            >
              <RefreshCw
                className={cn("w-3 h-3", isFetching && "animate-spin")}
              />
              Refresh
            </button>
          </motion.div>
        )}

      {/* Games grid */}
      {sport === "nba" && !isLoading && sortedGames.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sortedGames.map((game, i) => (
            <GameCard
              key={game.id}
              game={game}
              index={i}
              gamesDate={gamesDate}
              isUpcoming={isLocallyUpcoming}
            />
          ))}
        </div>
      )}
    </div>
  );
}
