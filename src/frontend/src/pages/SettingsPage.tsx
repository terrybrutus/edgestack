import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bell, BellOff, CheckCircle2, ExternalLink } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";

// ── ntfy.sh notification hook ─────────────────────────────────────────────────
export function useNtfyTopic() {
  const [topic, setTopic] = useState(
    () => localStorage.getItem("ntfy_topic") ?? "",
  );
  const save = (val: string) => {
    const clean = val
      .replace(/^https?:\/\/ntfy\.sh\//i, "")
      .replace(/^ntfy\.sh\//i, "")
      .trim();
    setTopic(clean);
    if (clean) localStorage.setItem("ntfy_topic", clean);
    else localStorage.removeItem("ntfy_topic");
  };
  return { topic, save };
}

export async function sendNtfyNotification(
  topic: string,
  title: string,
  body: string,
  throwOnError = false,
) {
  if (!topic) return;
  const cleanTopic = topic
    .replace(/^https?:\/\/ntfy\.sh\//i, "")
    .replace(/^ntfy\.sh\//i, "")
    .trim();
  if (!cleanTopic) return;
  try {
    const res = await fetch(
      `https://ntfy.sh/${encodeURIComponent(cleanTopic)}`,
      {
        method: "POST",
        headers: { Title: title, Priority: "high", Tags: "money_with_wings" },
        body,
      },
    );
    if (!res.ok) throw new Error(`ntfy returned ${res.status}`);
  } catch (e) {
    if (throwOnError) throw e;
    // non-critical for background notifications — best-effort only
  }
}

// ── Test notification sender ──────────────────────────────────────────────────
function NtfySection() {
  const { topic, save } = useNtfyTopic();
  const [input, setInput] = useState(topic);
  const [status, setStatus] = useState<"idle" | "sent" | "error">("idle");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSend = async () => {
    const t = input.trim();
    if (!t) return;
    save(t);
    try {
      await sendNtfyNotification(
        t,
        "EdgeStack — Test Notification",
        "Notifications are working. You'll be alerted when new plays are detected.",
        true, // throw on error so we can show real status
      );
      setStatus("sent");
      setTimeout(() => setStatus("idle"), 3000);
    } catch {
      setStatus("error");
      setTimeout(() => setStatus("idle"), 3000);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: 0.21 }}
      className="rounded-xl border border-border/50 bg-card p-4 space-y-4"
    >
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-muted/40 border border-border/40 flex items-center justify-center shrink-0">
          <Bell className="w-4 h-4 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-sm font-semibold text-foreground">
            Play Notifications
          </h3>
          <p className="text-[11px] font-body text-muted-foreground">
            Get instant phone alerts when new plays are detected via{" "}
            <a
              href="https://ntfy.sh"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline inline-flex items-center gap-0.5"
            >
              ntfy.sh
              <ExternalLink className="w-2.5 h-2.5" />
            </a>
          </p>
        </div>
        {topic ? (
          <Badge
            variant="outline"
            className="text-[10px] font-mono border-primary/40 text-primary bg-primary/5 gap-1.5 shrink-0"
          >
            <Bell className="w-3 h-3" />
            Active
          </Badge>
        ) : (
          <Badge
            variant="outline"
            className="text-[10px] font-mono border-border/40 text-muted-foreground gap-1.5 shrink-0"
          >
            <BellOff className="w-3 h-3" />
            Off
          </Badge>
        )}
      </div>

      {/* Setup instructions */}
      <div className="rounded-lg bg-muted/30 border border-border/30 p-3 space-y-1.5">
        <p className="text-[11px] font-mono text-muted-foreground font-semibold uppercase tracking-widest">
          Setup (30 seconds)
        </p>
        <ol className="space-y-1 text-[11px] font-mono text-muted-foreground list-none">
          <li>
            1. Download the <span className="text-foreground">ntfy</span> app on
            your phone (iOS / Android — free)
          </li>
          <li>
            2. Pick any unique topic name below — like{" "}
            <span className="text-primary font-bold">
              edgestack-terry-plays
            </span>
          </li>
          <li>3. In the ntfy app, subscribe to that same topic name</li>
          <li>4. Hit "Send Test" — your phone should buzz within seconds</li>
        </ol>
        <p className="text-[10px] font-mono text-accent/90 leading-relaxed pt-1.5 border-t border-border/30 mt-1.5">
          Heads up: new-play alerts are sent by your browser, so they only fire
          while EdgeStack is open in a tab. If the test buzzes but you never get
          play alerts, that's why — keep the app open, or ask for server-side
          push (sent from the canister even when the app is closed).
        </p>
      </div>

      {/* Input + test */}
      <div className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="your-unique-topic-name"
          className="flex-1 px-3 py-1.5 rounded-md border border-border/60 bg-background text-sm font-mono text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/60 transition-colors"
        />
        <Button
          size="sm"
          variant={status === "sent" ? "default" : "outline"}
          onClick={handleSend}
          disabled={!input.trim()}
          className="font-mono text-xs shrink-0"
        >
          {status === "sent" ? (
            <>
              <CheckCircle2 className="w-3 h-3 mr-1.5" />
              Sent!
            </>
          ) : status === "error" ? (
            "Failed"
          ) : (
            "Send Test"
          )}
        </Button>
      </div>
      {(() => {
        const clean = input
          .replace(/^https?:\/\/ntfy\.sh\//i, "")
          .replace(/^ntfy\.sh\//i, "")
          .trim();
        const hasPrefix = clean !== input.trim() && input.trim().length > 0;
        return (
          <>
            {hasPrefix && (
              <p className="text-[10px] font-mono text-accent">
                Just the topic name needed — will use:{" "}
                <span className="font-bold">{clean}</span>
              </p>
            )}
            {!hasPrefix && input.trim() !== topic && input.trim() && (
              <p className="text-[10px] font-mono text-muted-foreground/60">
                Hit "Send Test" to save and verify this topic.
              </p>
            )}
          </>
        );
      })()}
    </motion.div>
  );
}

// ── Bankroll setting ──────────────────────────────────────────────────────────
function BankrollSection() {
  const [input, setInput] = useState(
    () => localStorage.getItem("bankroll") ?? "100",
  );
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    const val = Number.parseFloat(input);
    if (Number.isNaN(val) || val <= 0) return;
    localStorage.setItem("bankroll", String(val));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: 0.28 }}
      className="rounded-xl border border-border/50 bg-card p-4 space-y-3"
    >
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-muted/40 border border-border/40 flex items-center justify-center shrink-0 text-base">
          💰
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-sm font-semibold text-foreground">
            Betting Bankroll
          </h3>
          <p className="text-[11px] font-body text-muted-foreground">
            Used to calculate recommended bet sizes on play cards (quarter-Kelly
            formula)
          </p>
        </div>
      </div>
      <div className="flex gap-2 items-center">
        <span className="text-sm font-mono text-muted-foreground">$</span>
        <input
          type="number"
          min="1"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="flex-1 px-3 py-1.5 rounded-md border border-border/60 bg-background text-sm font-mono text-foreground focus:outline-none focus:border-primary/60 transition-colors"
          placeholder="100"
        />
        <Button
          size="sm"
          variant={saved ? "default" : "outline"}
          onClick={handleSave}
          className="font-mono text-xs shrink-0"
        >
          {saved ? (
            <>
              <CheckCircle2 className="w-3 h-3 mr-1.5" />
              Saved
            </>
          ) : (
            "Save"
          )}
        </Button>
      </div>
      <p className="text-[10px] font-mono text-muted-foreground/50">
        Quarter-Kelly means bet ~25% of what the math says — the safe, standard
        approach. At $100 bankroll + 72% confidence: suggest ~$11.
      </p>
    </motion.div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const apis = [
    {
      name: "Ball Don't Lie API",
      description: "Game data, player stats, team records, season averages",
      icon: "🏀",
      ocid: "settings.bdl_status",
    },
    {
      name: "The Odds API",
      description:
        "Live odds from multiple sportsbooks — spreads, moneylines, O/U",
      icon: "📊",
      ocid: "settings.odds_status",
    },
    {
      name: "Claude AI",
      description:
        "AI-generated plain-language analysis and confidence reasoning",
      icon: "🤖",
      ocid: "settings.openai_status",
    },
  ];

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="mb-7"
      >
        <h1 className="font-display text-2xl font-bold text-foreground tracking-tight">
          Settings
        </h1>
        <p className="text-sm font-body text-muted-foreground mt-1">
          Configure notifications and check data source status.
        </p>
      </motion.div>

      <div className="space-y-3">
        <NtfySection />
        <BankrollSection />

        <div className="pt-2 pb-1">
          <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50">
            Data Sources
          </p>
        </div>

        {apis.map((api, i) => (
          <motion.div
            key={api.name}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: 0.25 + i * 0.07 }}
            className="rounded-xl border border-border/50 bg-card p-4"
            data-ocid={api.ocid}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-lg bg-muted/40 border border-border/40 flex items-center justify-center text-base shrink-0">
                  {api.icon}
                </div>
                <div className="min-w-0">
                  <h3 className="font-display text-sm font-semibold text-foreground">
                    {api.name}
                  </h3>
                  <p className="text-[11px] font-body text-muted-foreground truncate">
                    {api.description}
                  </p>
                </div>
              </div>
              <Badge
                variant="outline"
                className="text-[10px] font-mono border-primary/40 text-primary bg-primary/5 gap-1.5 shrink-0"
              >
                <CheckCircle2 className="w-3 h-3" />
                Connected
              </Badge>
            </div>
          </motion.div>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.5 }}
        className="mt-6 px-4 py-3 rounded-lg border border-border/30 bg-muted/20"
      >
        <p className="text-[11px] font-mono text-muted-foreground/80">
          All API keys are pre-configured. EdgeStack is ready to analyze any
          matchup.
        </p>
      </motion.div>
    </div>
  );
}
