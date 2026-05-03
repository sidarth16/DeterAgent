"use client";

import { useEffect, useRef, useState } from "react";
import type { ElementType } from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, XCircle } from "lucide-react";
import ChecklistItem from "@/components/ChecklistItem";
import LogStream from "@/components/LogStream";
import type { ChecklistRow, TraceLog, TracePhaseKey, TraceStatus } from "@/components/trace-types";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function statusIcon(status: TraceStatus) {
  if (status === "success") return <CheckCircle2 className="h-4 w-4" />;
  if (status === "failed") return <XCircle className="h-4 w-4" />;
  return <AlertTriangle className="h-4 w-4" />;
}

function statusTone(status: TraceStatus) {
  if (status === "success") return "text-mintx";
  if (status === "failed") return "text-red-400";
  return "text-orangex";
}

type PhaseMetrics = {
  trustScore?: number;
  relevanceScore?: number;
  hallucinationScore?: number;
  flaggedCount?: number;
  sourceCount?: number;
  ensBefore?: number;
  ensAfter?: number;
};

export default function PhaseCard({
  title,
  initial = false,
  summary,
  status,
  expanded,
  active,
  completed = false,
  icon: Icon,
  badge,
  checklist,
  logs,
  currentLine,
  highlighted = false,
  onToggle,
  phase,
  metrics,
}: {
  title: string;
  initial?: boolean;
  summary: string;
  status: TraceStatus;
  expanded: boolean;
  active: boolean;
  completed?: boolean;
  icon: ElementType;
  badge?: string;
  checklist: ChecklistRow[];
  logs: TraceLog[];
  currentLine?: string;
  highlighted?: boolean;
  onToggle: () => void;
  phase: TracePhaseKey;
  metrics?: PhaseMetrics;
}) {
  const isReputationPhase = phase === "enforce";
  const isVerifyPhase = phase === "verify";
  const isReputationDone = isReputationPhase && (completed || status === "success") && !active;
  const trustTarget = typeof metrics?.trustScore === "number" ? Math.max(0, Math.min(100, Math.round(metrics.trustScore))) : null;
  const [trustDisplay, setTrustDisplay] = useState<number>(trustTarget ?? 0);
  const trustDelayRef = useRef<number | null>(null);
  const trustIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (trustDelayRef.current) {
      window.clearTimeout(trustDelayRef.current);
      trustDelayRef.current = null;
    }
    if (trustIntervalRef.current) {
      window.clearInterval(trustIntervalRef.current);
      trustIntervalRef.current = null;
    }

    if (!isVerifyPhase || trustTarget === null) {
      setTrustDisplay(trustTarget ?? 0);
      return;
    }

    if (!active && !expanded) {
      setTrustDisplay(trustTarget);
      return;
    }

    setTrustDisplay(0);
    trustDelayRef.current = window.setTimeout(() => {
      trustIntervalRef.current = window.setInterval(() => {
        setTrustDisplay((current) => {
          const next = current + Math.max(1, Math.ceil(trustTarget / 16));
          if (next >= trustTarget) {
            if (trustIntervalRef.current) {
              window.clearInterval(trustIntervalRef.current);
              trustIntervalRef.current = null;
            }
            return trustTarget;
          }
          return next;
        });
      }, 55);
    }, 180);

    return () => {
      if (trustDelayRef.current) {
        window.clearTimeout(trustDelayRef.current);
        trustDelayRef.current = null;
      }
      if (trustIntervalRef.current) {
        window.clearInterval(trustIntervalRef.current);
        trustIntervalRef.current = null;
      }
    };
  }, [active, expanded, isVerifyPhase, trustTarget]);

  const trustMeta = trustTarget === null ? null : `${trustDisplay}/100`;
  return (
    <section
      className={cx(
        "relative overflow-hidden rounded-2xl bg-[#070d17]/85 backdrop-blur-xl transition-all duration-300 ease-out",
        active
          ? "border border-violetx/35 shadow-[0_0_0_1px_rgba(154,77,255,0.18),0_0_42px_rgba(154,77,255,0.20)]"
          : "border border-transparent",
        completed && !active && "border-mintx/20 shadow-[0_0_0_1px_rgba(43,255,174,0.08)]",
        status === "failed" ? "bg-[#12070c]" : status === "warning" ? "bg-[#151008]" : "bg-[#070d17]",
        highlighted && "ring-1 ring-orangex/35"
      )}
    >
      {active ? (
        <div className="pointer-events-none absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-violetx/70 to-transparent animate-pulse" />
      ) : completed ? (
        <div className="pointer-events-none absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-mintx/55 to-transparent animate-pulse" />
      ) : null}
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className={cx(
          "flex w-full items-start justify-between gap-3 px-4 py-3 text-left transition-all duration-300 ease-out",
          active ? "bg-white/[0.02]" : "hover:bg-white/[0.015]"
        )}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2.5">
            <span className={cx("grid h-8 w-8 shrink-0 place-items-center rounded-lg border", active ? "border-violetx/40 bg-violetx/10 text-violetx" : "border-transparent bg-white/[0.03] text-slate-400")}>
              <Icon className="h-4 w-4" />
            </span>
            <span
              className={cx(
                "grid h-8 w-8 shrink-0 place-items-center rounded-full border transition-all duration-300 ease-out",
                initial ? "text-slate-500" : statusTone(status),
                active
                  ? "border-current/40 bg-current/10 shadow-[0_0_18px_rgba(154,77,255,0.15)]"
                  : completed
                    ? "border-current/25 bg-current/5 shadow-[0_0_18px_rgba(43,255,174,0.08)]"
                    : "border-transparent bg-white/[0.03]",
              )}
            >
              {statusIcon(status)}
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className={cx("truncate text-base font-bold uppercase tracking-[0.18em] md:text-lg", initial ? "text-slate-400" : "text-white")}>{title}</h3>
              </div>
              <p className={cx("mt-0.5 truncate text-xs md:text-sm", initial ? "text-slate-500" : active ? "text-slate-300" : "text-slate-500")}>{summary}</p>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {badge ? (
            <span
              className={cx(
                "rounded-lg border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]",
                initial ? "border-line bg-white/[0.03] text-slate-400" : statusTone(status),
                active
                  ? "border-current/40 bg-current/10"
                  : completed
                    ? "border-current/25 bg-current/5"
                    : "border-transparent bg-white/[0.03]",
              )}
            >
              {badge}
            </span>
          ) : null}
            <span
              className={cx(
                "rounded-lg border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]",
                initial ? "border-line bg-white/[0.03] text-slate-400" : statusTone(status),
                active
                  ? "border-current/40 bg-current/10"
                  : completed
                    ? "border-current/25 bg-current/5"
                    : "border-transparent bg-white/[0.03]",
              )}
            >
              {initial ? "•" : status === "success" ? "✓" : status === "failed" ? "✕" : "!"}
            </span>
          <ChevronDown className={cx("h-4 w-4 text-slate-500 transition-transform", expanded && "rotate-180")} />
        </div>
      </button>

      {expanded ? (
        <div className="px-4 pb-4 pt-0.5">
          {isVerifyPhase && trustMeta ? (
            <div className="mb-3 rounded-xl border border-mintx/15 bg-mintx/[0.04] px-3 py-2">
              <div className="flex items-center justify-between gap-3">
                <div className="text-[10px] uppercase tracking-[0.24em] text-mintx/70">Firewall Score</div>
                <div className="text-sm font-semibold text-mintx transition-all duration-300 ease-out">{trustMeta}</div>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/5">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-violetx via-cyanx to-mintx transition-all duration-300 ease-out"
                  style={{ width: `${trustDisplay}%` }}
                />
              </div>
            </div>
          ) : null}
          <div className={cx("rounded-xl border px-3 transition-all duration-300 ease-out", active ? "border-violetx/15 bg-violetx/[0.03]" : "border-white/5 bg-white/[0.01]")}>
            {checklist.map((item) => (
              <ChecklistItem key={`${title}-${item.label}-${item.meta}`} {...item} />
            ))}
          </div>

          <div className="mt-3">
            <LogStream phase={phase} logs={logs} currentLine={currentLine} active={active} />
          </div>
        </div>
      ) : null}
    </section>
  );
}
