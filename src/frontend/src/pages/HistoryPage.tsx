import type { BetRecommendation } from "@/backend";
import { BetStatus, BetType } from "@/backend";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useBetHistory,
  useBetHistoryStats,
  useSaveBetRecommendation,
  useUpdateBetOutcome,
} from "@/hooks/useBackend";
import { cn } from "@/lib/utils";
import {
  Activity,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  Plus,
  Target,
  Trash2,
  TrendingDown,
  TrendingUp,
  X,
  XCircle,
} from "lucide-react";
import { motion } from "motion/react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

// ─── Client-side hidden-bet store (localStorage) ──────────────────────────────
// NOTE: the backend exposes no delete method, so "removing" a bet only hides it
// from this History view on this device. The record still exists in the canister.

const HIDDEN_BETS_KEY = "edgestack.hiddenBetIds";

function readHiddenBetIds(): string[] {
  try {
    const raw = localStorage.getItem(HIDDEN_BETS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((x) => typeof x === "string")
      : [];
  } catch {
    return [];
  }
}

function writeHiddenBetIds(ids: string[]): void {
  try {
    localStorage.setItem(HIDDEN_BETS_KEY, JSON.stringify(ids));
  } catch {
    // ignore — non-critical
  }
}

function useHiddenBetIds() {
  const [hidden, setHidden] = useState<string[]>(() => readHiddenBetIds());

  useEffect(() => {
    writeHiddenBetIds(hidden);
  }, [hidden]);

  const hide = useCallback((id: string) => {
    setHidden((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }, []);

  return { hidden, hide };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(ts: bigint): string {
  const d = new Date(Number(ts));
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getStatusColor(status: BetStatus): string {
  switch (status) {
    case BetStatus.won:
      return "border-primary/40 text-primary bg-primary/5";
    case BetStatus.lost:
      return "border-destructive/40 text-destructive bg-destructive/5";
    case BetStatus.push:
      return "border-accent/40 text-accent bg-accent/5";
    case BetStatus.cancelled:
      return "border-border/40 text-muted-foreground bg-muted/20";
    default:
      return "border-border/50 text-muted-foreground/80 bg-transparent";
  }
}

function getStatusLabel(status: BetStatus): string {
  switch (status) {
    case BetStatus.won:
      return "Won";
    case BetStatus.lost:
      return "Lost";
    case BetStatus.push:
      return "Push";
    case BetStatus.cancelled:
      return "Cancelled";
    default:
      return "Pending";
  }
}

function getBetTypeLabel(type: BetType): string {
  switch (type) {
    case BetType.playerProp:
      return "Player Prop";
    case BetType.gameTotal:
      return "Game Total";
    case BetType.spread:
      return "Spread";
    default:
      return String(type);
  }
}

function ConfidenceMeter({ score }: { score: bigint }) {
  const n = Number(score);
  const color =
    n >= 70 ? "bg-primary" : n >= 45 ? "bg-accent" : "bg-destructive/60";
  const label = n >= 70 ? "High" : n >= 45 ? "Medium" : "Low";
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground">
          Confidence
        </span>
        <span className="text-[10px] font-mono font-semibold text-foreground">
          {n}% {label}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-muted/40 overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", color)}
          style={{ width: `${n}%` }}
        />
      </div>
    </div>
  );
}

// ─── Stats bar ────────────────────────────────────────────────────────────────

function StatsBar({ hiddenCount }: { hiddenCount: number }) {
  const { data: stats, isLoading } = useBetHistoryStats();

  const statItems = stats
    ? [
        {
          label: "Total Bets",
          value: String(Math.max(0, Number(stats.totalBets) - hiddenCount)),
          icon: Target,
          color: "text-foreground",
        },
        {
          label: "Won",
          value: String(stats.wonBets),
          icon: TrendingUp,
          color: "text-primary",
        },
        {
          label: "Lost",
          value: String(stats.lostBets),
          icon: TrendingDown,
          color: "text-destructive",
        },
        {
          label: "Pending",
          value: String(Math.max(0, Number(stats.pendingBets) - hiddenCount)),
          icon: Activity,
          color: "text-accent",
        },
        {
          label: "Win Rate",
          value: `${(stats.winRate * 100).toFixed(1)}%`,
          icon: CheckCircle2,
          color: "text-primary",
        },
      ]
    : [];

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-7">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div
      className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-7"
      data-ocid="history.stats_panel"
    >
      {statItems.map((item, i) => (
        <motion.div
          key={item.label}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: i * 0.05 }}
          className="rounded-xl border border-border/50 bg-card p-3 space-y-1.5"
        >
          <div className="flex items-center gap-1.5">
            <item.icon className={cn("w-3 h-3", item.color)} />
            <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground">
              {item.label}
            </span>
          </div>
          <p className={cn("font-display text-2xl font-bold", item.color)}>
            {item.value}
          </p>
        </motion.div>
      ))}
    </div>
  );
}

// ─── Outcome updater ─────────────────────────────────────────────────────────

function OutcomeUpdater({ bet }: { bet: BetRecommendation }) {
  const [open, setOpen] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<BetStatus>(
    BetStatus.won,
  );
  const [result, setResult] = useState("");
  const updateOutcome = useUpdateBetOutcome();

  const handleSubmit = () => {
    updateOutcome.mutate(
      { id: bet.id, status: selectedStatus, gameResult: result.trim() || null },
      {
        onSuccess: () => {
          toast.success("Bet outcome updated", {
            description: `Marked as ${getStatusLabel(selectedStatus)}`,
          });
          setOpen(false);
          setResult("");
        },
        onError: (err) =>
          toast.error("Failed to update", { description: err.message }),
      },
    );
  };

  if (bet.status !== BetStatus.pending) return null;

  return (
    <div className="mt-3 pt-3 border-t border-border/25">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        data-ocid="history.outcome_toggle"
        className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
      >
        {open ? (
          <ChevronUp className="w-3 h-3" />
        ) : (
          <ChevronDown className="w-3 h-3" />
        )}
        Update Outcome
      </button>

      {open && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          transition={{ duration: 0.2 }}
          className="mt-3 space-y-3"
        >
          {/* Status selector */}
          <div className="flex gap-2 flex-wrap">
            {[BetStatus.won, BetStatus.lost, BetStatus.push].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSelectedStatus(s)}
                data-ocid={`history.outcome_status_${s}`}
                className={cn(
                  "px-3 py-1 rounded-md border text-[10px] font-mono uppercase tracking-widest transition-colors",
                  selectedStatus === s
                    ? getStatusColor(s)
                    : "border-border/40 text-muted-foreground hover:border-border/60",
                )}
              >
                {getStatusLabel(s)}
              </button>
            ))}
          </div>

          {/* Result text */}
          <input
            type="text"
            value={result}
            onChange={(e) => setResult(e.target.value)}
            placeholder="e.g. LeBron scored 31 pts (optional)"
            data-ocid="history.outcome_result_input"
            className="w-full px-3 py-2 rounded-md border border-border/50 bg-background text-xs font-mono text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus-visible:border-primary/60 focus-visible:ring-1 focus-visible:ring-primary/40"
          />

          <button
            type="button"
            onClick={handleSubmit}
            disabled={updateOutcome.isPending}
            data-ocid="history.outcome_save_button"
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-primary/40 bg-primary/5 text-primary text-[10px] font-mono uppercase tracking-widest hover:bg-primary/10 hover:border-primary/60 transition-all disabled:opacity-50"
          >
            {updateOutcome.isPending ? "Saving…" : "Save Outcome"}
          </button>
        </motion.div>
      )}
    </div>
  );
}

// ─── Bet card ─────────────────────────────────────────────────────────────────

function BetCard({
  bet,
  index,
  isDuplicate,
  onRemove,
}: {
  bet: BetRecommendation;
  index: number;
  isDuplicate: boolean;
  onRemove: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const isWon = bet.status === BetStatus.won;
  const isLost = bet.status === BetStatus.lost;

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.05 }}
      className={cn(
        "rounded-xl border bg-card overflow-hidden transition-colors",
        isWon && "border-primary/30",
        isLost && "border-destructive/25",
        !isWon && !isLost && "border-border/50",
      )}
      data-ocid={`history.item.${index + 1}`}
    >
      {/* Win/Loss accent bar */}
      {(isWon || isLost) && (
        <div
          className={cn(
            "h-[2px]",
            isWon
              ? "bg-gradient-to-r from-transparent via-primary to-transparent"
              : "bg-gradient-to-r from-transparent via-destructive/60 to-transparent",
          )}
        />
      )}

      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <Badge
              variant="outline"
              className={cn(
                "text-[9px] font-mono uppercase tracking-widest shrink-0",
                getStatusColor(bet.status),
              )}
            >
              {getStatusLabel(bet.status)}
            </Badge>
            <Badge
              variant="outline"
              className="text-[9px] font-mono uppercase tracking-widest border-border/40 text-muted-foreground bg-transparent shrink-0"
            >
              {getBetTypeLabel(bet.betType)}
            </Badge>
            {isDuplicate && (
              <Badge
                variant="outline"
                className="text-[9px] font-mono uppercase tracking-widest border-accent/40 text-accent bg-accent/5 shrink-0"
              >
                <Copy className="w-2.5 h-2.5 mr-1" />
                Possible duplicate
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[10px] font-mono text-muted-foreground/70">
              {formatDate(bet.recommendedAt)}
            </span>
            {confirmRemove ? (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onRemove(bet.id)}
                  data-ocid={`history.remove_confirm.${index + 1}`}
                  className="px-2 py-0.5 rounded-md border border-destructive/40 bg-destructive/5 text-destructive text-[9px] font-mono uppercase tracking-widest hover:bg-destructive/10 transition-colors"
                >
                  Remove
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmRemove(false)}
                  data-ocid={`history.remove_cancel.${index + 1}`}
                  className="p-1 rounded-md text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Cancel remove"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmRemove(true)}
                data-ocid={`history.remove_button.${index + 1}`}
                className="p-1 rounded-md text-muted-foreground/60 hover:text-destructive transition-colors"
                aria-label="Remove this bet"
                title="Remove this entry from history"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Matchup */}
        <div className="mb-3">
          <p className="text-[11px] font-mono text-muted-foreground mb-1">
            {bet.awayTeam} @ {bet.homeTeam}
          </p>
          <p className="font-display text-base font-bold text-foreground tracking-tight">
            {bet.description}
          </p>
        </div>

        {/* Confidence + odds row */}
        <div className="space-y-2 mb-3">
          <ConfidenceMeter score={bet.confidence} />
          {bet.preGameOdds && (
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground">
                Pre-game odds
              </span>
              <span className="text-[11px] font-mono font-semibold text-foreground">
                {bet.preGameOdds}
              </span>
            </div>
          )}
        </div>

        {/* Reasoning — expandable */}
        <div className="space-y-1">
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            data-ocid={`history.reasoning_toggle.${index + 1}`}
            className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
          >
            {expanded ? (
              <ChevronUp className="w-3 h-3" />
            ) : (
              <ChevronDown className="w-3 h-3" />
            )}
            {expanded ? "Hide reasoning" : "Show reasoning"}
          </button>
          {expanded && (
            <motion.p
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              transition={{ duration: 0.2 }}
              className="text-xs font-body text-muted-foreground leading-relaxed pt-1"
            >
              {bet.reasoning}
            </motion.p>
          )}
        </div>

        {/* Game result */}
        {bet.gameResult && (
          <div className="mt-3 pt-3 border-t border-border/25">
            <p className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground mb-0.5">
              Result
            </p>
            <p className="text-xs font-body text-foreground">
              {bet.gameResult}
            </p>
          </div>
        )}

        {/* CLV score */}
        {bet.clvScore !== undefined && bet.clvScore !== null && (
          <div className="mt-3 pt-3 border-t border-border/25 flex items-center justify-between">
            <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground">
              Closing Line Value
            </span>
            <span
              className={cn(
                "text-[11px] font-mono font-semibold",
                bet.clvScore > 0 ? "text-primary" : "text-destructive",
              )}
            >
              {bet.clvScore > 0 ? "+" : ""}
              {bet.clvScore.toFixed(1)} CLV
            </span>
          </div>
        )}

        {/* Closing line */}
        {bet.closingLine && (
          <div className="flex items-center justify-between mt-1">
            <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground">
              Closing Line
            </span>
            <span className="text-[11px] font-mono text-muted-foreground">
              {bet.closingLine}
            </span>
          </div>
        )}

        {/* Outcome updater for pending */}
        <OutcomeUpdater bet={bet} />
      </div>
    </motion.div>
  );
}

// ─── Filter tabs ──────────────────────────────────────────────────────────────

type FilterKey =
  | "all"
  | "playerProp"
  | "gameTotal"
  | "won"
  | "lost"
  | "pending";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "playerProp", label: "Player Props" },
  { key: "gameTotal", label: "Game Totals" },
  { key: "won", label: "Won" },
  { key: "lost", label: "Lost" },
  { key: "pending", label: "Pending" },
];

function filterBets(
  bets: BetRecommendation[],
  filter: FilterKey,
): BetRecommendation[] {
  switch (filter) {
    case "playerProp":
      return bets.filter((b) => b.betType === BetType.playerProp);
    case "gameTotal":
      return bets.filter((b) => b.betType === BetType.gameTotal);
    case "won":
      return bets.filter((b) => b.status === BetStatus.won);
    case "lost":
      return bets.filter((b) => b.status === BetStatus.lost);
    case "pending":
      return bets.filter((b) => b.status === BetStatus.pending);
    default:
      return bets;
  }
}

// ─── Log a past bet (manual backup entry) ─────────────────────────────────────

const FIELD_LABEL =
  "text-[9px] font-mono uppercase tracking-widest text-muted-foreground";
const FIELD_INPUT =
  "w-full px-3 py-2 rounded-md border border-border/50 bg-background text-xs font-mono text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus-visible:border-primary/60 focus-visible:ring-1 focus-visible:ring-primary/40";

function LogPastBetForm({ onClose }: { onClose: () => void }) {
  const saveBet = useSaveBetRecommendation();
  const [description, setDescription] = useState("");
  const [awayTeam, setAwayTeam] = useState("");
  const [homeTeam, setHomeTeam] = useState("");
  const [gameDate, setGameDate] = useState("");
  const [betType, setBetType] = useState<BetType>(BetType.playerProp);
  const [status, setStatus] = useState<BetStatus>(BetStatus.pending);
  const [confidence, setConfidence] = useState("60");
  const [odds, setOdds] = useState("");
  const [reasoning, setReasoning] = useState("");

  const handleSubmit = () => {
    if (!description.trim()) {
      toast.error("Please add a short description of the bet");
      return;
    }
    const confNum = Math.max(0, Math.min(100, Number(confidence) || 0));
    const rec: BetRecommendation = {
      id: `manual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      status,
      homeTeam: homeTeam.trim() || "—",
      betType,
      gameId: `manual-${Date.now()}`,
      description: description.trim(),
      reasoning: reasoning.trim() || "Manually logged bet (backup entry).",
      recommendedAt: BigInt(Date.now()),
      awayTeam: awayTeam.trim() || "—",
      gameDate: gameDate.trim(),
      confidence: BigInt(confNum),
      ...(odds.trim() ? { preGameOdds: odds.trim() } : {}),
    };
    saveBet.mutate(rec, {
      onSuccess: () => {
        toast.success("Past bet logged", {
          description: "Added to your history as a backup entry.",
        });
        onClose();
      },
      onError: (err) =>
        toast.error("Failed to log bet", { description: err.message }),
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      transition={{ duration: 0.2 }}
      className="mb-6 rounded-xl border border-border/50 bg-card p-4 space-y-4"
      data-ocid="history.log_past_bet_form"
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="font-display text-base font-bold text-foreground tracking-tight">
            Log a past bet
          </p>
          <p className="text-xs font-body text-muted-foreground mt-0.5">
            Manually add a bet the app didn't capture. Only the description is
            required.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          data-ocid="history.log_past_bet_close"
          className="p-1 rounded-md text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Close form"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1 sm:col-span-2">
          <span className={FIELD_LABEL}>What was the bet?</span>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. LeBron James Over 25.5 points"
            data-ocid="history.log_field_description"
            className={FIELD_INPUT}
          />
        </div>

        <div className="space-y-1">
          <span className={FIELD_LABEL}>Away team</span>
          <input
            type="text"
            value={awayTeam}
            onChange={(e) => setAwayTeam(e.target.value)}
            placeholder="e.g. Lakers"
            data-ocid="history.log_field_away"
            className={FIELD_INPUT}
          />
        </div>
        <div className="space-y-1">
          <span className={FIELD_LABEL}>Home team</span>
          <input
            type="text"
            value={homeTeam}
            onChange={(e) => setHomeTeam(e.target.value)}
            placeholder="e.g. Celtics"
            data-ocid="history.log_field_home"
            className={FIELD_INPUT}
          />
        </div>

        <div className="space-y-1">
          <span className={FIELD_LABEL}>Game date</span>
          <input
            type="date"
            value={gameDate}
            onChange={(e) => setGameDate(e.target.value)}
            data-ocid="history.log_field_date"
            className={FIELD_INPUT}
          />
        </div>
        <div className="space-y-1">
          <span className={FIELD_LABEL}>Odds (optional)</span>
          <input
            type="text"
            value={odds}
            onChange={(e) => setOdds(e.target.value)}
            placeholder="e.g. -110"
            data-ocid="history.log_field_odds"
            className={FIELD_INPUT}
          />
        </div>

        <div className="space-y-1">
          <span className={FIELD_LABEL}>Bet type</span>
          <select
            value={betType}
            onChange={(e) => setBetType(e.target.value as BetType)}
            data-ocid="history.log_field_bettype"
            className={FIELD_INPUT}
          >
            <option value={BetType.playerProp}>Player Prop</option>
            <option value={BetType.gameTotal}>Game Total</option>
            <option value={BetType.spread}>Spread</option>
          </select>
        </div>
        <div className="space-y-1">
          <span className={FIELD_LABEL}>Result / status</span>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as BetStatus)}
            data-ocid="history.log_field_status"
            className={FIELD_INPUT}
          >
            <option value={BetStatus.pending}>Pending</option>
            <option value={BetStatus.won}>Won</option>
            <option value={BetStatus.lost}>Lost</option>
            <option value={BetStatus.push}>Push</option>
            <option value={BetStatus.cancelled}>Cancelled</option>
          </select>
        </div>

        <div className="space-y-1">
          <span className={FIELD_LABEL}>Confidence (0–100)</span>
          <input
            type="number"
            min={0}
            max={100}
            value={confidence}
            onChange={(e) => setConfidence(e.target.value)}
            data-ocid="history.log_field_confidence"
            className={FIELD_INPUT}
          />
        </div>

        <div className="space-y-1 sm:col-span-2">
          <span className={FIELD_LABEL}>Notes / reasoning (optional)</span>
          <input
            type="text"
            value={reasoning}
            onChange={(e) => setReasoning(e.target.value)}
            placeholder="Why you placed this bet"
            data-ocid="history.log_field_reasoning"
            className={FIELD_INPUT}
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={saveBet.isPending}
          data-ocid="history.log_past_bet_save"
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-primary/40 bg-primary/5 text-primary text-[10px] font-mono uppercase tracking-widest hover:bg-primary/10 hover:border-primary/60 transition-all disabled:opacity-50"
        >
          {saveBet.isPending ? "Saving…" : "Save Bet"}
        </button>
        <button
          type="button"
          onClick={onClose}
          data-ocid="history.log_past_bet_cancel"
          className="px-3 py-1.5 rounded-md border border-border/40 text-muted-foreground text-[10px] font-mono uppercase tracking-widest hover:text-foreground hover:border-border/60 transition-colors"
        >
          Cancel
        </button>
      </div>
    </motion.div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function HistoryPage() {
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");
  const [showLogForm, setShowLogForm] = useState(false);
  const { data: bets = [], isLoading } = useBetHistory();
  const { hidden, hide } = useHiddenBetIds();

  const handleRemove = useCallback(
    (id: string) => {
      hide(id);
      toast.success("Bet removed from history", {
        description: "Hidden from this view on this device.",
      });
    },
    [hide],
  );

  // Drop client-side hidden entries, then sort by most recent first
  const visible = bets.filter((b) => !hidden.includes(b.id));
  const sorted = [...visible].sort(
    (a, b) => Number(b.recommendedAt) - Number(a.recommendedAt),
  );
  const filtered = filterBets(sorted, activeFilter);

  // Possible-duplicate detection: same description + gameDate appearing >1x.
  const dupKeyCounts = new Map<string, number>();
  for (const b of visible) {
    const key = `${b.description.trim().toLowerCase()}|${b.gameDate}`;
    dupKeyCounts.set(key, (dupKeyCounts.get(key) ?? 0) + 1);
  }
  const isDuplicate = (b: BetRecommendation) =>
    (dupKeyCounts.get(`${b.description.trim().toLowerCase()}|${b.gameDate}`) ??
      0) > 1;

  return (
    <div className="max-w-screen-xl mx-auto px-4 py-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mb-6"
      >
        <div className="flex items-center gap-2 mb-1.5">
          <BookOpen className="w-3.5 h-3.5 text-primary" />
          <span className="text-[10px] font-mono uppercase tracking-[0.25em] text-primary font-semibold">
            EdgeStack
          </span>
        </div>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground tracking-tight">
              Bet History
            </h1>
            <p className="text-sm font-body text-muted-foreground mt-0.5">
              All past recommendations with outcomes and performance tracking
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowLogForm((v) => !v)}
            data-ocid="history.log_past_bet_toggle"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-primary/40 bg-primary/5 text-primary text-[10px] font-mono uppercase tracking-widest hover:bg-primary/10 hover:border-primary/60 transition-all shrink-0"
          >
            <Plus className="w-3 h-3" />
            Log a past bet
          </button>
        </div>
      </motion.div>

      {/* Manual log form */}
      {showLogForm && <LogPastBetForm onClose={() => setShowLogForm(false)} />}

      {/* Stats */}
      <StatsBar hiddenCount={hidden.length} />

      {/* Filter tabs */}
      <div
        className="flex items-center gap-1.5 flex-wrap mb-5"
        data-ocid="history.filter_tabs"
      >
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setActiveFilter(f.key)}
            data-ocid={`history.filter.${f.key}`}
            className={cn(
              "px-3 py-1.5 rounded-md border text-[10px] font-mono uppercase tracking-widest transition-colors",
              activeFilter === f.key
                ? "border-primary/50 text-primary bg-primary/8"
                : "border-border/40 text-muted-foreground hover:border-border/60 hover:text-foreground",
            )}
          >
            {f.label}
            {f.key !== "all" &&
              filtered.length > 0 &&
              activeFilter === f.key && (
                <span className="ml-1.5 text-[9px] opacity-70">
                  {filtered.length}
                </span>
              )}
          </button>
        ))}
      </div>

      {/* Divider */}
      <div className="mb-5 h-px bg-gradient-to-r from-primary/30 via-border/40 to-transparent" />

      {/* Loading */}
      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-44 rounded-xl" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && filtered.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="flex flex-col items-center justify-center py-20 space-y-4"
          data-ocid="history.empty_state"
        >
          <div className="w-16 h-16 rounded-2xl bg-muted/40 border border-border/40 flex items-center justify-center">
            <BookOpen className="w-7 h-7 text-muted-foreground/60" />
          </div>
          <div className="text-center space-y-1.5">
            <p className="font-display text-lg font-semibold text-foreground">
              {activeFilter === "all"
                ? "No bet recommendations yet"
                : `No ${activeFilter} bets`}
            </p>
            <p className="text-sm font-body text-muted-foreground">
              {activeFilter === "all"
                ? "Investigate a game to generate recommendations"
                : `No bets match the ${activeFilter} filter`}
            </p>
          </div>
        </motion.div>
      )}

      {/* Bets grid */}
      {!isLoading && filtered.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((bet, i) => (
            <BetCard
              key={bet.id}
              bet={bet}
              index={i}
              isDuplicate={isDuplicate(bet)}
              onRemove={handleRemove}
            />
          ))}
        </div>
      )}
    </div>
  );
}
