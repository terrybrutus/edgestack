import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  CHALLENGE_PRESETS,
  type Challenge,
  type ChallengeBet,
  type ChallengeType,
  challengeStats,
  deleteChallenge,
  getChallenges,
  recommendBetSize,
  saveChallenge,
} from "@/services/challenges";
import {
  CheckCircle,
  ChevronDown,
  ChevronUp,
  PlusCircle,
  Trash2,
  Trophy,
  XCircle,
} from "lucide-react";
import { useState } from "react";

// ── helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtPct(n: number) {
  return `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
}

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

// ── sub-components ────────────────────────────────────────────────────────────

function ProgressBar({ pct }: { pct: number }) {
  return (
    <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
      <div
        className="h-full rounded-full bg-primary transition-all"
        style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
      />
    </div>
  );
}

interface AddBetFormProps {
  challenge: Challenge;
  onSave: (c: Challenge) => void;
  onCancel: () => void;
}

function AddBetForm({ challenge, onSave, onCancel }: AddBetFormProps) {
  const bankroll = Number(localStorage.getItem("bankroll") ?? "100");
  const suggested = recommendBetSize(challenge, 60);

  const [desc, setDesc] = useState("");
  const [amount, setAmount] = useState(String(suggested));
  const [confidence, setConfidence] = useState("60");
  const [odds, setOdds] = useState("-110");
  const [result, setResult] = useState<"won" | "lost" | "push">("won");

  function computeNet(amt: number, res: string, americanOdds: number) {
    if (res === "lost") return -amt;
    if (res === "push") return 0;
    const decimal =
      americanOdds < 0 ? 100 / Math.abs(americanOdds) : americanOdds / 100;
    return Math.round(amt * decimal * 100) / 100;
  }

  function handleSave() {
    const amt = Number(amount);
    const americanOdds = Number(odds);
    if (!amt || !desc.trim()) return;

    const net = computeNet(amt, result, americanOdds);
    const before = challenge.currentAmount;
    const after = Math.max(0, before + net);

    const bet: ChallengeBet = {
      id: uid(),
      date: today(),
      description: desc.trim(),
      amountBet: amt,
      result,
      netAmount: net,
      bankrollBefore: before,
      bankrollAfter: after,
      confidence: Number(confidence),
      americanOdds,
    };

    const updated: Challenge = {
      ...challenge,
      currentAmount: after,
      bets: [...challenge.bets, bet],
      status:
        after <= 0
          ? "busted"
          : challenge.targetAmount > 0 && after >= challenge.targetAmount
            ? "completed"
            : "active",
    };
    if (updated.status !== "active") updated.endDate = today();

    onSave(updated);
  }

  return (
    <div className="mt-3 p-3 rounded-lg bg-muted/40 border border-border/40 space-y-3">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        Log Bet Result
      </p>
      <div className="grid grid-cols-2 gap-2">
        <div className="col-span-2">
          <Label className="text-xs text-muted-foreground">Description</Label>
          <Input
            className="h-8 text-sm mt-1"
            placeholder='e.g. "Celtics -4.5 on FanDuel"'
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
          />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">
            Bet Amount ($)
            {bankroll > 0 && (
              <span className="text-primary ml-1">
                — suggested ${fmt(suggested)}
              </span>
            )}
          </Label>
          <Input
            className="h-8 text-sm mt-1"
            type="number"
            min="0.01"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">American Odds</Label>
          <Input
            className="h-8 text-sm mt-1"
            type="number"
            value={odds}
            onChange={(e) => setOdds(e.target.value)}
          />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Confidence %</Label>
          <Input
            className="h-8 text-sm mt-1"
            type="number"
            min="1"
            max="100"
            value={confidence}
            onChange={(e) => setConfidence(e.target.value)}
          />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Result</Label>
          <div className="flex gap-1 mt-1">
            {(["won", "lost", "push"] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setResult(r)}
                className={cn(
                  "flex-1 h-8 rounded text-xs font-semibold capitalize border transition-colors",
                  result === r
                    ? r === "won"
                      ? "bg-emerald-500/20 border-emerald-500/60 text-emerald-400"
                      : r === "lost"
                        ? "bg-red-500/20 border-red-500/60 text-red-400"
                        : "bg-muted border-border text-foreground"
                    : "bg-transparent border-border/40 text-muted-foreground hover:border-border",
                )}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={!desc.trim() || !Number(amount)}
        >
          Save Result
        </Button>
      </div>
    </div>
  );
}

interface ChallengeCardProps {
  challenge: Challenge;
  onUpdate: (c: Challenge) => void;
  onDelete: (id: string) => void;
}

function ChallengeCard({ challenge, onUpdate, onDelete }: ChallengeCardProps) {
  const [showForm, setShowForm] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const preset = CHALLENGE_PRESETS[challenge.type];
  const stats = challengeStats(challenge);
  const suggested = recommendBetSize(challenge, 60);

  const statusColor =
    challenge.status === "completed"
      ? "text-emerald-400 border-emerald-400/30 bg-emerald-400/10"
      : challenge.status === "busted"
        ? "text-red-400 border-red-400/30 bg-red-400/10"
        : "text-primary border-primary/30 bg-primary/10";

  return (
    <div className="rounded-xl border border-border/60 bg-card p-4 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xl">{preset.icon}</span>
          <div className="min-w-0">
            <p className="font-semibold text-foreground truncate">
              {challenge.name}
            </p>
            <p className="text-xs text-muted-foreground">{preset.label}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Badge
            variant="outline"
            className={cn("text-[10px] font-mono uppercase", statusColor)}
          >
            {challenge.status}
          </Badge>
          <button
            type="button"
            onClick={() => onDelete(challenge.id)}
            className="text-muted-foreground hover:text-destructive transition-colors"
            aria-label="Delete challenge"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Bankroll */}
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs text-muted-foreground">Current</p>
          <p className="text-2xl font-bold font-mono text-foreground">
            ${fmt(challenge.currentAmount)}
          </p>
        </div>
        <div className="text-right">
          {challenge.targetAmount > 0 ? (
            <>
              <p className="text-xs text-muted-foreground">Target</p>
              <p className="text-sm font-mono text-muted-foreground">
                ${fmt(challenge.targetAmount)}
              </p>
            </>
          ) : (
            <p className="text-sm font-mono text-muted-foreground">
              Open-ended
            </p>
          )}
        </div>
      </div>

      {challenge.targetAmount > 0 && (
        <div className="space-y-1">
          <ProgressBar pct={stats.progressPct} />
          <p className="text-xs text-muted-foreground text-right">
            {stats.progressPct.toFixed(1)}% to goal
          </p>
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-2 text-center">
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
            W
          </p>
          <p className="text-sm font-semibold text-emerald-400">{stats.wins}</p>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
            L
          </p>
          <p className="text-sm font-semibold text-red-400">{stats.losses}</p>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
            ROI
          </p>
          <p
            className={cn(
              "text-sm font-semibold",
              stats.netProfit >= 0 ? "text-emerald-400" : "text-red-400",
            )}
          >
            {fmtPct(Number(stats.roi))}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
            Streak
          </p>
          <p className="text-sm font-semibold text-primary">{stats.streak}W</p>
        </div>
      </div>

      {/* Suggested next bet */}
      {challenge.status === "active" && (
        <div className="rounded-lg bg-primary/5 border border-primary/20 px-3 py-2 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              Suggested next bet
            </p>
            <p className="text-sm font-bold text-primary">${fmt(suggested)}</p>
          </div>
          <p className="text-xs text-muted-foreground">{preset.label} sizing</p>
        </div>
      )}

      {/* Actions */}
      {challenge.status === "active" && (
        <div className="flex gap-2">
          <Button
            size="sm"
            className="flex-1"
            onClick={() => {
              setShowForm(!showForm);
              setShowHistory(false);
            }}
          >
            <PlusCircle className="w-3.5 h-3.5 mr-1" />
            Log Result
          </Button>
          {challenge.bets.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setShowHistory(!showHistory);
                setShowForm(false);
              }}
            >
              {showHistory ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
              History
            </Button>
          )}
        </div>
      )}

      {challenge.status !== "active" && challenge.bets.length > 0 && (
        <Button
          size="sm"
          variant="outline"
          className="w-full"
          onClick={() => setShowHistory(!showHistory)}
        >
          {showHistory ? (
            <ChevronUp className="w-3.5 h-3.5 mr-1" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 mr-1" />
          )}
          View {challenge.bets.length} bets
        </Button>
      )}

      {showForm && (
        <AddBetForm
          challenge={challenge}
          onSave={(updated) => {
            onUpdate(updated);
            setShowForm(false);
          }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {showHistory && challenge.bets.length > 0 && (
        <div className="space-y-1.5 mt-1">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Bet History
          </p>
          {[...challenge.bets].reverse().map((bet) => (
            <div
              key={bet.id}
              className="flex items-center gap-2 py-1.5 border-b border-border/30 last:border-0"
            >
              {bet.result === "won" ? (
                <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              ) : bet.result === "lost" ? (
                <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
              ) : (
                <span className="w-3.5 h-3.5 rounded-full border border-border shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs text-foreground truncate">
                  {bet.description}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {bet.date} · ${fmt(bet.amountBet)} @ {bet.americanOdds}
                </p>
              </div>
              <p
                className={cn(
                  "text-xs font-mono font-semibold shrink-0",
                  bet.netAmount >= 0 ? "text-emerald-400" : "text-red-400",
                )}
              >
                {bet.netAmount >= 0 ? "+" : ""}${fmt(bet.netAmount)}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── New Challenge Modal ───────────────────────────────────────────────────────

interface NewChallengeModalProps {
  onClose: () => void;
  onCreated: () => void;
}

function NewChallengeModal({ onClose, onCreated }: NewChallengeModalProps) {
  const [type, setType] = useState<ChallengeType>("doubler");
  const [name, setName] = useState("");
  const [startStr, setStartStr] = useState("100");

  const preset = CHALLENGE_PRESETS[type];
  const startAmount = Math.max(0, Number(startStr) || 0);

  function handleCreate() {
    const target = preset.defaultTarget(startAmount);
    const c: Challenge = {
      id: uid(),
      name: name.trim() || preset.label,
      type,
      startAmount,
      currentAmount: startAmount,
      targetAmount: target,
      startDate: today(),
      status: "active",
      bets: [],
    };
    saveChallenge(c);
    onCreated();
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
      role="presentation"
    >
      <div
        className="w-full max-w-md bg-card rounded-xl border border-border/60 p-5 space-y-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        aria-label="New Challenge"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold">New Challenge</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground text-xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Type selector */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground uppercase tracking-wider">
            Challenge Type
          </Label>
          <div className="grid grid-cols-1 gap-1.5">
            {(
              Object.entries(CHALLENGE_PRESETS) as [
                ChallengeType,
                (typeof CHALLENGE_PRESETS)[ChallengeType],
              ][]
            ).map(([key, p]) => (
              <button
                key={key}
                type="button"
                onClick={() => setType(key)}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg border text-left transition-colors",
                  type === key
                    ? "border-primary/60 bg-primary/10"
                    : "border-border/40 hover:border-border bg-transparent",
                )}
              >
                <span className="text-2xl">{p.icon}</span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{p.label}</p>
                  <p className="text-xs text-muted-foreground line-clamp-1">
                    {p.description}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground uppercase tracking-wider">
            Challenge Name (optional)
          </Label>
          <Input
            className="h-9"
            placeholder={preset.label}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground uppercase tracking-wider">
            Starting Amount ($)
          </Label>
          <Input
            className="h-9"
            type="number"
            min="1"
            step="1"
            value={startStr}
            onChange={(e) => setStartStr(e.target.value)}
          />
          {preset.defaultTarget(startAmount) > 0 && (
            <p className="text-xs text-muted-foreground">
              Target:{" "}
              <span className="text-primary font-semibold">
                ${fmt(preset.defaultTarget(startAmount))}
              </span>
            </p>
          )}
        </div>

        <div className="flex gap-2 pt-1">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button
            className="flex-1"
            onClick={handleCreate}
            disabled={startAmount <= 0}
          >
            <Trophy className="w-3.5 h-3.5 mr-1.5" />
            Start Challenge
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ChallengesPage() {
  const [challenges, setChallenges] = useState<Challenge[]>(() =>
    getChallenges(),
  );
  const [showNew, setShowNew] = useState(false);

  function refresh() {
    setChallenges(getChallenges());
  }

  function handleUpdate(c: Challenge) {
    saveChallenge(c);
    refresh();
  }

  function handleDelete(id: string) {
    deleteChallenge(id);
    refresh();
  }

  const active = challenges.filter((c) => c.status === "active");
  const finished = challenges.filter((c) => c.status !== "active");

  return (
    <div className="max-w-screen-lg mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold flex items-center gap-2">
            <Trophy className="w-6 h-6 text-primary" />
            Challenges
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track bankroll growth challenges with automatic bet sizing
            suggestions.
          </p>
        </div>
        <Button onClick={() => setShowNew(true)}>
          <PlusCircle className="w-4 h-4 mr-1.5" />
          New Challenge
        </Button>
      </div>

      {/* Active challenges */}
      {active.length === 0 && finished.length === 0 && (
        <div className="text-center py-16 space-y-3">
          <p className="text-5xl">🏆</p>
          <p className="text-lg font-semibold text-foreground">
            No challenges yet
          </p>
          <p className="text-sm text-muted-foreground max-w-xs mx-auto">
            Start a challenge to track your bankroll growth with guided bet
            sizing. Try the $10 to $10K classic or build a win streak.
          </p>
          <Button onClick={() => setShowNew(true)} className="mt-2">
            <PlusCircle className="w-4 h-4 mr-1.5" />
            Start Your First Challenge
          </Button>
        </div>
      )}

      {active.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
            Active — {active.length}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {active.map((c) => (
              <ChallengeCard
                key={c.id}
                challenge={c}
                onUpdate={handleUpdate}
                onDelete={handleDelete}
              />
            ))}
          </div>
        </div>
      )}

      {finished.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
            Completed / Busted — {finished.length}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 opacity-70">
            {finished.map((c) => (
              <ChallengeCard
                key={c.id}
                challenge={c}
                onUpdate={handleUpdate}
                onDelete={handleDelete}
              />
            ))}
          </div>
        </div>
      )}

      {showNew && (
        <NewChallengeModal
          onClose={() => setShowNew(false)}
          onCreated={refresh}
        />
      )}
    </div>
  );
}
