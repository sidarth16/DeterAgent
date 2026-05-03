"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Activity, BrainCircuit, Search, ShieldAlert, ShieldCheck, Zap } from "lucide-react";
import TracePhase from "@/components/TracePhase";

type TraceTag = "INPUT" | "PLAN" | "FETCH" | "REASON" | "RISK" | "TRUST" | "EXEC" | "PROOF" | "ENS";

type TraceLog = {
  time?: string;
  tag: TraceTag;
  message: string;
  step?: string;
  state?: string;
};

type TracePhaseId = "agent" | "research" | "verify" | "execute" | "enforce";
type TraceStatus = "success" | "warning" | "failed";
type PhaseIcon = React.ElementType;
const EMPTY_LOGS: TraceLog[] = [];
const PHASE_FLOW: Array<{ id: TracePhaseId; title: string; icon: PhaseIcon }> = [
  { id: "agent", title: "Select Agent", icon: BrainCircuit },
  { id: "research", title: "Agent Response", icon: Search },
  { id: "verify", title: "Trust Verification", icon: ShieldAlert },
  { id: "execute", title: "Execution Control", icon: Zap },
  { id: "enforce", title: "Reputation Enforcement", icon: Activity },
];
const AGENT_HIGHLIGHTS = [
  "Reading ENS reputation to pick the highest-trust agent.",
  "Selecting the agent that will handle the task.",
];
const RESEARCH_HIGHLIGHTS = [
  "Fetching URLs and reading source material.",
  "Logging proof data to 0G as a single bundle.",
  "Generating the answer from the collected evidence.",
];
const EXECUTE_HIGHLIGHTS = [
  "Passing the trust result through KeeperHub.",
  "Waiting for execution status.",
  "Recording the transaction hash when available.",
];
const ENFORCE_HIGHLIGHTS = [
  "Updating ENS reputation with the final trust result.",
  "Persisting the agent’s score change.",
];

type DashboardPayload = {
  task_id?: string;
  response?: string;
  selected_agent?: {
    name?: string;
  };
  agents?: Array<{
    name: string;
    trust_score?: number;
    status?: string;
    selected?: boolean;
  }>;
  source_count?: number;
  flagged_count?: number;
  clean_count?: number;
  trust_score?: number;
  relevance_score?: number;
  hallucination_score?: number;
  verdict?: string;
  keeper_status?: string;
  keeper_success?: boolean;
  keeper?: {
    status?: string;
  };
  ens_before?: number;
  ens_after?: number;
  current_step?: string;
  current_step_state?: string;
  current_category?: TraceTag;
  process_state?: "running" | "done" | "failed";
  current_line?: string;
  trace_steps?: Array<{
    title: string;
    summary?: string;
    state?: string;
    logs?: string[];
  }>;
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function phaseForStep(step?: string, category?: TraceTag): TracePhaseId {
  if (!step) return "agent";
  const lower = (step ?? "").toLowerCase();
  if (lower.includes("agent selection")) return "agent";
  if (lower.includes("reputation update")) return "enforce";
  if (lower.includes("trust") || category === "TRUST") return "verify";
  if (lower.includes("keeper") || category === "EXEC") return "execute";
  if (lower.includes("ens") || category === "ENS") return "enforce";
  if (lower.includes("response") || lower.includes("proof") || lower.includes("fetch") || category === "FETCH" || category === "REASON" || category === "PROOF") return "research";
  return "agent";
}

function phaseForLog(log: TraceLog): TracePhaseId {
  const step = (log.step ?? "").toLowerCase();
  if (step.includes("agent selection")) return "agent";
  if (step.includes("trust analysis")) return "verify";
  if (step.includes("keeperhub gate")) return "execute";
  if (step.includes("reputation update")) return "enforce";
  if (step.includes("fetch url") || step.includes("agent response") || step.includes("fetching sources")) return "research";
  if (log.tag === "TRUST") return "verify";
  if (log.tag === "EXEC") return "execute";
  if (log.tag === "ENS") return "enforce";
  if (log.tag === "FETCH" || log.tag === "REASON" || log.tag === "PROOF") return "research";
  return "agent";
}

function phaseStateFromPayload(payload: DashboardPayload | null, phase: TracePhaseId): "ready" | "done" | "active" {
  if (payload?.process_state === "done") {
    return "done";
  }

  if (phase === "enforce") {
    if (typeof payload?.ens_after === "number") {
      return "done";
    }
  }

  const currentPhase = payload?.current_step ? phaseForStep(payload.current_step, payload.current_category) : null;
  if (!currentPhase) {
    return "ready";
  }

  const phaseIndex = PHASE_FLOW.findIndex((item) => item.id === phase);
  const currentIndex = PHASE_FLOW.findIndex((item) => item.id === currentPhase);

  if (phaseIndex < currentIndex) {
    return "done";
  }

  if (phaseIndex > currentIndex) {
    return "ready";
  }

  if (payload?.current_step_state === "active") {
    return "active";
  }

  if (payload?.current_step_state === "done") {
    return "done";
  }

  return "ready";
}

function progressFromPhase(phase: TracePhaseId) {
  switch (phase) {
    case "agent":
      return 20;
    case "research":
      return 45;
    case "verify":
      return 68;
    case "execute":
      return 84;
    case "enforce":
      return 100;
  }
}

function progressFromIndex(index: number | null) {
  if (index === null) return 0;
  return ((index + 1) / PHASE_FLOW.length) * 100;
}

function deriveSummary(payload: DashboardPayload | null, phase: TracePhaseId) {
  const selectedAgent = payload?.selected_agent?.name ?? "Awaiting selection";
  const sourceCount = payload?.source_count ?? 0;
  const flaggedCount = payload?.flagged_count ?? 0;
  const trustScore = payload?.trust_score;
  const ensBefore = payload?.ens_before;
  const ensAfter = payload?.ens_after;
  const keeperStatus = (payload?.keeper?.status ?? payload?.keeper_status ?? "PENDING").toUpperCase();

  if (phase === "agent") return selectedAgent === "Awaiting selection" ? "Selecting agent from ENS" : `Selected ${selectedAgent}`;
  if (phase === "research") return sourceCount > 0 ? `${sourceCount} sources` : "Fetching sources and proof";
  if (phase === "verify") return flaggedCount > 0 ? `${flaggedCount} issues` : trustScore ? `Trust score ${trustScore}/100` : "Checking grounding";
  if (phase === "execute") {
    if (keeperStatus === "EXECUTED" || payload?.keeper_success) return "Execution confirmed";
    if (keeperStatus === "BLOCKED") return "Blocked by DeterAgent";
    if (keeperStatus === "FAILED" || (payload?.verdict ?? "").toUpperCase() === "DO NOT TRUST" || flaggedCount > 0) return "Prevented by Trust Layer";
    return "Waiting for KeeperHub";
  }
  if (typeof ensBefore === "number" && typeof ensAfter === "number") return `${ensBefore} → ${ensAfter}`;
  return "Updating ENS reputation";
}

function deriveStatus(payload: DashboardPayload | null, phase: TracePhaseId, activePhase: TracePhaseId): TraceStatus {
  const flaggedCount = payload?.flagged_count ?? 0;
  const verdict = (payload?.verdict ?? "").toUpperCase();
  const keeperStatus = (payload?.keeper?.status ?? payload?.keeper_status ?? "").toUpperCase();

  if (phase === "verify") {
    if (verdict === "DO NOT TRUST") return "failed";
    if (flaggedCount > 0 || verdict === "VERIFY") return "warning";
  }
  if (phase === "execute") {
    if (keeperStatus === "BLOCKED") return "failed";
    if (keeperStatus === "FAILED" || verdict === "DO NOT TRUST" || flaggedCount > 0) return "failed";
  }
  if (phase === "enforce") {
    if (typeof payload?.ens_after === "number") {
     return "success";
  }
  }
  return "success";
}

function highlightsForPhase(payload: DashboardPayload | null, phase: TracePhaseId) {
  if (phase === "agent") {
    return AGENT_HIGHLIGHTS;
  }
  if (phase === "research") {
    return RESEARCH_HIGHLIGHTS;
  }
  if (phase === "verify") {
    const issues = payload?.flagged_count ?? 0;
    return [
      "Checking grounding against the logged sources.",
      "Detecting grounding issues in each sentence.",
      issues > 0 ? `${issues} issue${issues === 1 ? "" : "s"} flagged.` : "No issues flagged in the current run.",
    ];
  }
  if (phase === "execute") {
    return EXECUTE_HIGHLIGHTS;
  }
  return ENFORCE_HIGHLIGHTS;
}

function buildTraceSteps(payload: DashboardPayload | null, logs: TraceLog[]) {
  const processDone = payload?.process_state === "done" || payload?.process_state === "failed";
  const phaseStates = {
    agent: phaseStateFromPayload(payload, "agent"),
    research: phaseStateFromPayload(payload, "research"),
    verify: phaseStateFromPayload(payload, "verify"),
    execute: phaseStateFromPayload(payload, "execute"),
    enforce: phaseStateFromPayload(payload, "enforce"),
  } as const;
  const activePhase = processDone
    ? null
    : (Object.entries(phaseStates).find(([, state]) => state === "active")?.[0] as TracePhaseId | undefined) ?? (payload?.current_step_state === "active" ? phaseForStep(payload?.current_step, payload?.current_category) : null);
  const groupedLogs = logs.reduce<Record<TracePhaseId, TraceLog[]>>(
    (acc, log) => {
      acc[phaseForLog(log)].push(log);
      return acc;
    },
    { agent: [], research: [], verify: [], execute: [], enforce: [] }
  );

  return [
    {
      id: "agent" as const,
      title: "Select Agent",
      summary: deriveSummary(payload, "agent"),
      status: deriveStatus(payload, "agent", activePhase ?? "agent"),
      expanded: activePhase === "agent",
      active: activePhase === "agent",
      runState: phaseStates.agent,
      icon: BrainCircuit,
      badge: "AGENT",
      highlights: highlightsForPhase(payload, "agent"),
      liveLogs: groupedLogs.agent,
      metrics: {
        selectedAgent: payload?.selected_agent?.name,
        agentCount: payload?.agents?.length,
        sourceCount: payload?.source_count,
        flaggedCount: payload?.flagged_count,
        trustScore: payload?.trust_score,
        relevanceScore: payload?.relevance_score,
        hallucinationScore: payload?.hallucination_score,
        ensBefore: payload?.ens_before,
        ensAfter: payload?.ens_after,
      },
    },
    {
      id: "research" as const,
      title: "Agent Response",
      summary: deriveSummary(payload, "research"),
      status: deriveStatus(payload, "research", activePhase ?? "research"),
      expanded: activePhase === "research",
      active: activePhase === "research",
      runState: phaseStates.research,
      icon: Search,
      badge: "FETCH / RESPONSE / OG",
      highlights: highlightsForPhase(payload, "research"),
      liveLogs: groupedLogs.research,
      metrics: {
        selectedAgent: payload?.selected_agent?.name,
        agentCount: payload?.agents?.length,
        sourceCount: payload?.source_count,
        flaggedCount: payload?.flagged_count,
        trustScore: payload?.trust_score,
        relevanceScore: payload?.relevance_score,
        hallucinationScore: payload?.hallucination_score,
        ensBefore: payload?.ens_before,
        ensAfter: payload?.ens_after,
      },
    },
    {
      id: "verify" as const,
      title: "Trust Verification",
      summary: deriveSummary(payload, "verify"),
      status: deriveStatus(payload, "verify", activePhase ?? "verify"),
      expanded: activePhase === "verify",
      active: activePhase === "verify",
      runState: phaseStates.verify,
      icon: ShieldAlert,
      badge: "TRUST",
      highlights: highlightsForPhase(payload, "verify"),
      liveLogs: groupedLogs.verify,
      highlighted: (payload?.flagged_count ?? 0) > 0 || (payload?.verdict ?? "").toUpperCase() === "VERIFY" || (payload?.verdict ?? "").toUpperCase() === "DO NOT TRUST",
      metrics: {
        selectedAgent: payload?.selected_agent?.name,
        agentCount: payload?.agents?.length,
        sourceCount: payload?.source_count,
        flaggedCount: payload?.flagged_count,
        trustScore: payload?.trust_score,
        relevanceScore: payload?.relevance_score,
        hallucinationScore: payload?.hallucination_score,
        ensBefore: payload?.ens_before,
        ensAfter: payload?.ens_after,
      },
    },
    {
      id: "execute" as const,
      title: "Execution Control",
      summary: deriveSummary(payload, "execute"),
      status: deriveStatus(payload, "execute", activePhase ?? "execute"),
      expanded: activePhase === "execute",
      active: activePhase === "execute",
      runState: phaseStates.execute,
      icon: Zap,
      badge: "KEEPERHUB",
      highlights: highlightsForPhase(payload, "execute"),
      liveLogs: groupedLogs.execute,
      metrics: {
        selectedAgent: payload?.selected_agent?.name,
        agentCount: payload?.agents?.length,
        sourceCount: payload?.source_count,
        flaggedCount: payload?.flagged_count,
        trustScore: payload?.trust_score,
        relevanceScore: payload?.relevance_score,
        hallucinationScore: payload?.hallucination_score,
        ensBefore: payload?.ens_before,
        ensAfter: payload?.ens_after,
      },
    },
    {
      id: "enforce" as const,
      title: "Reputation Enforcement",
      summary: deriveSummary(payload, "enforce"),
      status: deriveStatus(payload, "enforce", activePhase ?? "enforce"),
      expanded: activePhase === "enforce",
      active: activePhase === "enforce",
      runState: phaseStates.enforce,
      icon: Activity,
      badge: "ENS",
      highlights: highlightsForPhase(payload, "enforce"),
      liveLogs: groupedLogs.enforce,
      metrics: {
        selectedAgent: payload?.selected_agent?.name,
        agentCount: payload?.agents?.length,
        sourceCount: payload?.source_count,
        flaggedCount: payload?.flagged_count,
        trustScore: payload?.trust_score,
        relevanceScore: payload?.relevance_score,
        hallucinationScore: payload?.hallucination_score,
        ensBefore: payload?.ens_before,
        ensAfter: payload?.ens_after,
      },
    },
  ];
}

export default function TraceContainer({
  payload,
  logs,
  running,
}: {
  payload: DashboardPayload | null;
  logs: TraceLog[];
  running: boolean;
}) {
  const phases = useMemo(() => buildTraceSteps(payload, logs), [payload, logs]);
  const activePhase = phases.find((phase) => phase.active) ?? null;
  const activeIndex = activePhase ? PHASE_FLOW.findIndex((phase) => phase.id === activePhase.id) : null;
  const processDone = payload?.process_state === "done" || payload?.process_state === "failed";
  const isInitial = Boolean(
    !payload?.task_id &&
      !payload?.response &&
      !payload?.trust_score &&
      !payload?.flagged_count &&
      !payload?.clean_count &&
      !payload?.ens_before &&
      !payload?.ens_after &&
      !payload?.keeper_status &&
      !payload?.keeper?.status &&
      !payload?.current_step &&
      !payload?.current_line
  );
  const [expandedPhaseId, setExpandedPhaseId] = useState<TracePhaseId | null>(null);
  const lastProcessStateRef = useRef<DashboardPayload["process_state"]>(undefined);
  const furthestPhaseIndexRef = useRef(-1);
  const lastTaskIdRef = useRef<string | undefined>(undefined);
  const lastLogPhaseId = useMemo(() => {
    for (let index = phases.length - 1; index >= 0; index -= 1) {
      if (phases[index]?.liveLogs?.length) {
        return phases[index].id;
      }
    }
    return null;
  }, [phases]);

  useEffect(() => {
    const nextTaskId = payload?.task_id;
    if (nextTaskId !== lastTaskIdRef.current) {
      lastTaskIdRef.current = nextTaskId;
      furthestPhaseIndexRef.current = activeIndex ?? -1;
      return;
    }

    if (activeIndex !== null) {
      furthestPhaseIndexRef.current = Math.max(furthestPhaseIndexRef.current, activeIndex);
    }
  }, [activeIndex, payload?.task_id]);

  useEffect(() => {
    const nextState = payload?.process_state;
    const prevState = lastProcessStateRef.current;
    const justCompleted = (nextState === "done" || nextState === "failed") && prevState !== nextState;
    lastProcessStateRef.current = nextState;

    if (justCompleted) {
      setExpandedPhaseId(null);
      return;
    }

    if (activePhase) {
      setExpandedPhaseId(activePhase.id);
      return;
    }

    if (nextState === "done" || nextState === "failed") {
      setExpandedPhaseId(null);
      return;
    }

    if (lastLogPhaseId) {
      setExpandedPhaseId(lastLogPhaseId);
      return;
    }

    if (!payload?.current_step) {
      setExpandedPhaseId(null);
    }
  }, [activePhase, lastLogPhaseId, phases, payload?.process_state, payload?.current_step]);

  const furthestCompletedIndex = phases.reduce((max, phase, index) => (phase.runState !== "ready" ? Math.max(max, index) : max), -1);
  const displayPhaseIndex = processDone ? PHASE_FLOW.length - 1 : Math.max(furthestPhaseIndexRef.current, furthestCompletedIndex, activeIndex ?? -1);
  const progress = payload?.process_state === "done" ? 100 : displayPhaseIndex < 0 ? 0 : progressFromIndex(displayPhaseIndex);
  const railPhaseIndex = processDone ? PHASE_FLOW.length : displayPhaseIndex < 0 ? 0 : displayPhaseIndex;
  const isFinished = payload?.process_state === "done" || payload?.process_state === "failed";
  const headerPhases = PHASE_FLOW.map((phase, index) => ({
    ...phase,
    trace: phases[index],
  }));

  return (
    <section className="rounded-2xl border border-violetx/40 bg-panel/90 shadow-[0_22px_70px_rgba(0,0,0,0.28)] backdrop-blur-xl">
      <div className="flex items-start justify-between gap-4 border-b border-line px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl border border-violetx/50 bg-violetx/15 text-violetx shadow-glow">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-200">EXECUTION FLOW</div>
            <div className="mt-0.5 text-xs text-slate-400">
              {activePhase ? `${payload?.current_step} · ${payload?.current_category === "EXEC" ? "KeeperHub" : payload?.current_category}` : "Tracking agent decision in real time"}
            </div>
          </div>
        </div>
        <div
          className={cx(
            "rounded-lg border px-2 py-1 text-[10px] font-semibold uppercase",
            isFinished ? "border-mintx/30 bg-mintx/10 text-mintx" : running ? "border-mintx/30 bg-mintx/10 text-mintx" : "border-line text-slate-400"
          )}
        >
          {isFinished ? "Complete" : running ? "Live" : "Ready"}
        </div>
      </div>

      <div className="px-4 py-3">
        <div className="mb-3">
          <div className="mb-3 grid grid-cols-5 gap-1.5 text-[10px] uppercase tracking-[0.18em] text-slate-400">
            {headerPhases.map((phase, index) => {
              const isActive = activePhase?.id === phase.id;
              const isFailed = phase.trace?.status === "failed";
              const isDone = displayPhaseIndex >= 0 ? (isFinished ? index <= displayPhaseIndex : index < displayPhaseIndex) : false;
              const Icon = phase.icon;
              return (
                <div key={phase.id} className={cx("flex min-w-0 flex-col items-center gap-2 text-center", isActive && "text-white")}>
                  <span
                    className={cx(
                      "grid h-7 w-7 shrink-0 place-items-center rounded-lg border transition-all duration-300 ease-out",
                      isInitial
                        ? "border-line bg-white/[0.02] text-slate-500"
                        : isFailed
                        ? "border-red-500/50 bg-red-500/10 text-red-400 shadow-[0_0_12px_rgba(239,68,68,0.22)]"
                        : "",
                      isDone
                        ? "border-mintx/40 bg-mintx/10 text-mintx"
                        : isActive
                          ? "border-violetx/70 bg-violetx/20 text-violetx shadow-[0_0_12px_rgba(154,77,255,0.6),0_0_32px_rgba(154,77,255,0.35)] animate-[glowPulse_1.6s_ease-in-out_infinite]"
                          : isInitial
                            ? "border-line bg-white/[0.02] text-slate-500"
                            : "border-line bg-white/[0.02] text-slate-500"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="flex min-w-0 flex-col items-center">
                    <span
                      className={cx(
                        "truncate",
                        isInitial ? "text-slate-400" : isFailed ? "text-red-400" : isActive ? "text-white" : isDone ? "text-mintx" : "text-slate-400"
                      )}
                    >
                      {phase.title}
                    </span>
                    {isActive ? <span className="mt-1 h-2 w-2 rounded-full bg-violetx shadow-[0_0_12px_rgba(154,77,255,0.9)] animate-pulse" /> : null}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="rounded-xl border border-white/5 bg-white/[0.02] p-2">
            <div className="grid grid-cols-5 gap-1.5">
              {PHASE_FLOW.map((phase, index) => {
                const tracePhase = phases[index];
                const isActive = activePhase?.id === phase.id;
                const isCompleted = index < railPhaseIndex;
                const isLive = isActive || (index === railPhaseIndex && !isFinished);
                const isFailed = tracePhase?.status === "failed";
                return (
                  <div
                    key={phase.id}
                    className="relative h-2 overflow-hidden rounded-full transition-all duration-500 ease-out"
                  >
                    <div
                      className={cx(
                        "absolute inset-0 transition-all duration-500 ease-out",
                        isFailed
                          ? "bg-red-500/15 shadow-[0_0_14px_rgba(239,68,68,0.12)]"
                          : isCompleted
                            ? "bg-mintx/15 shadow-[0_0_14px_rgba(43,255,174,0.08)]"
                            : isLive
                              ? "bg-violetx/15 shadow-[0_0_16px_rgba(154,77,255,0.12)]"
                              : "bg-white/10"
                      )}
                    />
                    <div
                      className={cx(
                        "absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out",
                        isFailed
                          ? "w-full bg-gradient-to-r from-red-500 via-red-400 to-orange-400 shadow-[0_0_20px_rgba(239,68,68,0.4)]"
                          : isCompleted
                            ? "w-full bg-gradient-to-r from-violetx via-cyanx to-mintx"
                            : isLive
                              ? "bg-gradient-to-r from-violetx via-cyanx to-mintx shadow-[0_0_20px_rgba(154,77,255,0.4)] animate-[glowPulse_1.4s_ease-in-out_infinite]"
                              : "w-0 bg-transparent"
                      )}
                      style={isFailed || isCompleted ? undefined : isLive ? { width: "68%" } : undefined}
                    />
                    {isLive && !isFailed ? <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-white/25 blur-md animate-pulse" /> : null}
                  </div>
                );
              })}
            </div>
          </div>
          <div className="mt-2 flex items-center justify-between text-[10px] uppercase tracking-[0.24em] text-slate-500">
            <span>{activePhase?.title ?? (isFinished ? "Complete" : "Waiting")}</span>
            <span>{Math.round(progress)}%</span>
          </div>
        </div>

        <div className="space-y-3">
          {phases.map((phase, index) => (
            <TracePhase
              phase={phase.id}
              key={phase.id}
              initial={isInitial}
              title={phase.title}
              summary={phase.summary}
              status={phase.status}
              expanded={expandedPhaseId === phase.id}
              active={activePhase?.id === phase.id}
              icon={phase.icon}
              highlights={phase.highlights}
              liveLogs={phase.liveLogs}
              highlighted={phase.highlighted}
              badge={phase.badge}
              currentLine={payload?.current_line}
              metrics={phase.metrics}
              completed={processDone ? true : phase.runState === "done" || index < railPhaseIndex || (isFinished && index === PHASE_FLOW.length - 1)}
              onToggle={() => {
                setExpandedPhaseId((current) => (current === phase.id ? null : phase.id));
              }}
            />
          ))}
          <div className="rounded-2xl border border-line bg-white/[0.02] p-4">
            <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Full Agent Response</div>
            <div className="whitespace-pre-wrap break-words text-sm leading-6 text-slate-200">
              {payload?.response?.trim() || "Awaiting full agent response..."}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
