"use client";

import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { TraceLog, TracePhaseKey } from "@/components/trace-types";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function phaseGroups(phase: TracePhaseKey) {
  if (phase === "agent") {
    return [
      { heading: "ENS Review", patterns: [/ens/i, /trust/i, /selected/i, /reviewing agent profile/i] },
      { heading: "Selection", patterns: [/selecting/i, /agentx/i, /profile/i] },
    ];
  }
  if (phase === "research") {
    return [
      {
        heading: "Fetching Sources",
        patterns: [/fetching from/i, /fetch urls/i, /source picked/i, /retrieved/i, /reading source/i, /let's start/i, /let’s start/i],
      },
      {
        heading: "OG Proof Upload",
        patterns: [/logging proof/i, /proof bundle/i, /0g/i, /pinned/i, /root hash/i, /tx hash/i, /proof uploaded/i, /task id/i],
      },
      { heading: "Response Generation", patterns: [/generating response/i, /response ready/i, /agent response/i, /answer/i] },
    ];
  }
  if (phase === "verify") {
    return [
      { heading: "Grounding Check", patterns: [/ground/i, /evidence/i, /claim/i] },
      // { heading: "Grounding Scan", patterns: [/hallucinat/i, /flagged/i, /issues?/i] },
      { heading: "Trust Scoring", patterns: [/trust score/i, /relevance/i, /verdict/i, /answer/i] },
    ];
  }
  if (phase === "execute") {
    return [
      { heading: "Execution Control", patterns: [/keeperhub/i, /execute/i, /blocked/i, /waiting/i] },
      { heading: "Decision", patterns: [/success/i, /failed/i, /pending/i, /confirmed/i] },
    ];
  }
  return [
    { heading: "Reputation Update", patterns: [/ens/i, /reputation/i, /score/i, /updated/i] },
    { heading: "Persistence", patterns: [/persist/i, /saved/i, /final/i] },
  ];
}

function logTone(message: string) {
  const lower = message.toLowerCase();
  if (lower.includes("failed") || lower.includes("error") || lower.includes("blocked") || lower.includes("do not trust") || lower.includes("ungrounded")) return "danger";
  if (lower.includes("success") || lower.includes("found") || lower.includes("updated") || lower.includes("pinned") || lower.includes("completed")) return "success";
  if (lower.includes("waiting") || lower.includes("pending") || lower.includes("review") || lower.includes("checking")) return "warning";
  return "neutral";
}

function toneClass(tone: "success" | "warning" | "danger" | "neutral") {
  if (tone === "success") return "text-mintx";
  if (tone === "warning") return "text-orangex";
  if (tone === "danger") return "text-red-400";
  return "text-slate-400";
}

function inlineStyle(message: string) {
  const parts: React.ReactNode[] = [];
  const tokens = message.split(/(https?:\/\/[^\s]+|0x[a-fA-F0-9]+)/g);

  tokens.forEach((token, index) => {
    if (!token) return;
    if (/^https?:\/\//.test(token)) {
      parts.push(
        <span key={`${token}-${index}`} className="text-cyanx">
          {token}
        </span>
      );
      return;
    }
    if (/^0x[a-fA-F0-9]+/.test(token)) {
      parts.push(
        <span key={`${token}-${index}`} className="text-violet-300">
          {token}
        </span>
      );
      return;
    }
    parts.push(<span key={`${token}-${index}`}>{token}</span>);
  });

  return parts;
}

export default function LogStream({
  phase,
  logs,
  currentLine,
  active = false,
}: {
  phase: TracePhaseKey;
  logs: TraceLog[];
  currentLine?: string;
  active?: boolean;
}) {
  const logRef = useRef<HTMLDivElement | null>(null);
  const currentLineTimerRef = useRef<number | null>(null);
  const revealTimerRef = useRef<number | null>(null);
  const visibleCountRef = useRef(0);
  const [displayLine, setDisplayLine] = useState<string | undefined>(currentLine);
  const [visibleCount, setVisibleCount] = useState(0);
  const revealStepMs = phase === "agent" || phase === "verify" || phase === "enforce" ? 100 : phase === "execute" ? 60 : 100;
  const lineHoldMs = phase === "agent" || phase === "verify" || phase === "enforce" ? 220 : 320;

  useEffect(() => {
    visibleCountRef.current = visibleCount;
  }, [visibleCount]);

  useEffect(() => {
    if (logs.length === 0) {
      setVisibleCount(0);
      visibleCountRef.current = 0;
      return;
    }

    if (revealTimerRef.current) {
      window.clearInterval(revealTimerRef.current);
      revealTimerRef.current = null;
    }

    const start = Math.min(visibleCountRef.current, logs.length);
    if (start >= logs.length) {
      setVisibleCount(logs.length);
      return;
    }

    setVisibleCount(start);
    revealTimerRef.current = window.setInterval(() => {
      setVisibleCount((current) => {
        const next = current + 1;
        if (next >= logs.length && revealTimerRef.current) {
          window.clearInterval(revealTimerRef.current);
          revealTimerRef.current = null;
        }
        return Math.min(next, logs.length);
      });
    }, revealStepMs);

    return () => {
      if (revealTimerRef.current) {
        window.clearInterval(revealTimerRef.current);
        revealTimerRef.current = null;
      }
    };
  }, [logs.length, phase, revealStepMs]);

  useEffect(() => {
    setVisibleCount(0);
    visibleCountRef.current = 0;
  }, [phase]);

  const groups = useMemo(() => {
    const defs = phaseGroups(phase);
    const grouped = defs.map((group) => ({ heading: group.heading, logs: [] as TraceLog[] }));

    for (const log of logs.slice(0, visibleCount)) {
      const lower = log.message.toLowerCase();
      const index = defs.findIndex((group) => group.patterns.some((pattern) => pattern.test(lower)));
      (grouped[index >= 0 ? index : 0].logs as TraceLog[]).push(log);
    }

    return grouped.filter((group) => group.logs.length > 0);
  }, [logs, phase, visibleCount]);

  useEffect(() => {
    if (!active || visibleCount === 0 || !logRef.current) return;
    logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [active, visibleCount, logs.length, phase]);

  useEffect(() => {
    if (!active || !currentLine) return;
    const target = logRef.current?.querySelector('[data-current="true"]');
    if (target instanceof HTMLElement) {
      target.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [active, currentLine, displayLine, phase]);

  useEffect(() => {
    if (currentLineTimerRef.current) {
      window.clearTimeout(currentLineTimerRef.current);
      currentLineTimerRef.current = null;
    }

    if (!currentLine) {
      setDisplayLine(undefined);
      return;
    }

    currentLineTimerRef.current = window.setTimeout(() => {
      setDisplayLine(currentLine);
      currentLineTimerRef.current = null;
    }, lineHoldMs);

    return () => {
      if (currentLineTimerRef.current) {
        window.clearTimeout(currentLineTimerRef.current);
        currentLineTimerRef.current = null;
      }
    };
  }, [currentLine, lineHoldMs]);

  return (
    <div
      ref={logRef}
      className={cx(
        "relative max-h-[280px] space-y-3 overflow-y-auto rounded-xl border border-white/5 bg-black/20 p-3 font-mono transition-all duration-300 ease-out",
        active && "border-violetx/25 bg-violetx/5 shadow-[0_0_0_1px_rgba(154,77,255,0.08),0_0_32px_rgba(154,77,255,0.12)] ring-1 ring-violetx/15"
      )}
    >
      {active ? <div className="pointer-events-none absolute inset-x-3 top-0 h-px bg-gradient-to-r from-transparent via-violetx/70 to-transparent animate-pulse" /> : null}
      {groups.length === 0 ? (
        <div className="py-2 text-xs text-slate-500">No execution logs yet.</div>
      ) : (
        groups.map((group) => (
          <div key={group.heading} className="space-y-1.5">
            <div className="text-[10px] uppercase tracking-[0.24em] text-slate-500">{group.heading}</div>
            <div className="space-y-1">
              {group.logs.map((log, index) => {
                const tone = logTone(log.message);
                const isCurrent = Boolean(displayLine && log.message.toLowerCase().includes(displayLine.toLowerCase()));
                return (
                  <div
                    key={`${group.heading}-${log.time ?? ""}-${index}-${log.message}`}
                    data-current={isCurrent ? "true" : undefined}
                    className={cx(
                      "rounded-md px-2 py-1 transition-all duration-300 ease-out",
                      isCurrent ? "bg-violetx/10 ring-1 ring-violetx/20" : "bg-transparent hover:bg-white/[0.02]"
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <span className={cx("mt-0.5 text-[11px] font-semibold transition-all duration-500", toneClass(tone), isCurrent && "animate-pulse")}>
                        {tone === "success" ? "✓" : tone === "warning" ? "→" : tone === "danger" ? "✕" : "•"}
                      </span>
                      <span
                        className={cx(
                          "min-w-0 flex-1 text-xs leading-6 opacity-80 transition-all duration-500",
                          tone === "success" && "text-slate-100 opacity-95",
                          tone === "warning" && "text-slate-200 opacity-90",
                          tone === "danger" && "text-red-300 opacity-95",
                          isCurrent && "opacity-100"
                        )}
                      >
                        {inlineStyle(log.message)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}
      {active ? (
        <div className="pointer-events-none sticky bottom-0 -mb-1 h-2 rounded-b-xl">
          <div className="h-px bg-gradient-to-r from-transparent via-cyanx to-transparent opacity-70 animate-pulse" />
          <div className="mt-0.5 h-1 rounded-full bg-gradient-to-r from-violetx via-cyanx to-mintx opacity-30 blur-[1px] animate-pulse" />
        </div>
      ) : null}
    </div>
  );
}
