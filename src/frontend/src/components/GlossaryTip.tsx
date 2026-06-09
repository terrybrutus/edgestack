// Inline tooltip for betting jargon. Shows a small ⓘ icon; hover/tap reveals explanation.
// Usage: <GlossaryTip term="steam" /> or <GlossaryTip term="steam" className="..." />
import { cn } from "@/lib/utils";
import { useState } from "react";

const GLOSSARY: Record<string, string> = {
  steam:
    "Professionals bet one side so hard that Vegas moved the line fast to protect itself. Big moves = sharp money signal.",
  spread:
    "A margin the favored team must win by. Betting -4.5 means they must win by 5+. Betting +4.5 means they can lose by up to 4.",
  moneyline:
    "Simply pick the winner — no margin needed. -150 means bet $150 to win $100. +130 means bet $100 to win $130.",
  total:
    "The combined score of both teams. 'Over' means you think they'll score more than the posted number together.",
  "over/under":
    "Same as Total — the combined score of both teams. You bet whether the actual combined score goes over or under the number.",
  confidence:
    "How strongly the signals align. Not a win guarantee — it's based on how many independent signals point the same direction. The model isn't battle-tested yet.",
  kelly:
    "The Kelly Criterion is a math formula that calculates the optimal bet size based on your edge and bankroll. We use quarter-Kelly (25% of full Kelly) as a safety buffer.",
  "quarter-kelly":
    "A conservative version of Kelly Criterion bet sizing — 25% of the full mathematical recommendation. Standard practice to avoid ruin from model errors.",
  clv: "Closing Line Value — how much your bet line was better than what the line closed at. Positive CLV means you beat the closing market, which long-term predicts profitability.",
  "park factor":
    "A number showing how much a stadium inflates or suppresses scoring vs. an average park. 112 = 12% more runs than average (hitter-friendly). 88 = 12% fewer.",
  era: "Earned Run Average — how many earned runs a pitcher allows per 9 innings. 3.50 is good. 5.00+ is poor. Lower = better pitcher.",
  "sharp action":
    "Bets placed by professional, winning bettors ('sharps'). When sharp money hits one side, books move the line. Sharp action is a strong directional signal.",
  "line movement":
    "A change in the posted spread or total between when it opened and now. Large movement = significant new money came in on one side.",
  "steam move":
    "A fast, large line movement driven by sharp (professional) bettors hitting multiple books simultaneously. One of the most reliable signals of a real edge.",
  convergence:
    "When multiple independent signals (rest, odds movement, scoring projection) all point the same direction. The more signals that agree, the stronger the edge.",
  "rest days":
    "Days since the team's last game. More rest = fresher legs, better performance on average. 0 days = back-to-back, a meaningful disadvantage.",
  bankroll:
    "Your total betting budget. Proper bankroll management means only risking a small % per bet so a losing streak doesn't wipe you out.",
  "projected total":
    "The model's estimated combined final score based on both teams' recent scoring averages. Compare to the posted O/U to find gaps.",
};

function GlossaryTip({
  term,
  className,
}: { term: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const text = GLOSSARY[term.toLowerCase()];
  if (!text) return null;
  return (
    <span
      className={cn("relative inline-flex", className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onClick={() => setOpen((v) => !v)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") setOpen((v) => !v);
      }}
    >
      <span className="text-[10px] text-muted-foreground/40 cursor-help select-none ml-0.5">
        ⓘ
      </span>
      {open && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 z-50 w-52 rounded-lg border border-border/60 bg-popover px-3 py-2 text-[11px] font-mono text-foreground shadow-xl leading-relaxed pointer-events-none">
          <span className="font-semibold text-primary capitalize">{term}</span>:{" "}
          {text}
        </span>
      )}
    </span>
  );
}

export { GlossaryTip };
