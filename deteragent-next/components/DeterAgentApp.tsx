"use client";

import {
  Activity,
  BarChart3,
  Bot,
  BrainCircuit,
  ChevronRight,
  CircleDot,
  FileCheck2,
  Gauge,
  Home,
  Network,
  Pause,
  Play,
  Radio,
  Settings,
  ShieldCheck,
  ShieldAlert,
  Sparkles,
  Users,
  Zap,
} from "lucide-react";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import TraceContainer from "@/components/TraceContainer";
import { StatusBox } from "@/components/StatusBox";

type Tag = "INPUT" | "PLAN" | "FETCH" | "REASON" | "RISK" | "TRUST" | "EXEC" | "PROOF" | "ENS";

type LogLine = {
  time: string;
  tag: Tag;
  message: string;
};

type LogMood = "heading" | "success" | "warning" | "danger" | "neutral";

type DashboardEvent = {
  time: string;
  category: Tag;
  line: string;
  step?: string;
  state?: string;
};

type KeeperState = "IDLE" | "READY TO EXECUTE" | "EXECUTING" | "SUCCESS" | "FAILED";
type FinalOutcome = "BLOCKED" | "FAILED" | "EXECUTED";

type SidebarAgent = {
  name: string;
  score: number;
  status: string;
  color: string;
  active: boolean;
  ensUrl: string;
};

type DashboardAgent = {
  name: string;
  trust_score: number;
  status?: string;
  selected?: boolean;
  last_updated?: string;
  proof_ref?: string;
};

type DashboardTraceStep = {
  title: string;
  state?: string;
  summary?: string;
  logs?: string[];
};

type DashboardPayload = {
  task?: string;
  task_id?: string;
  response?: string;
  trust_score?: number;
  hallucination_score?: number;
  relevance_score?: number;
  verdict?: string;
  total_sentences?: number;
  clean_count?: number;
  flagged_count?: number;
  selected_agent?: {
    name: string;
    trust_score?: number;
    status?: string;
  };
  keeper_status?: string;
  keeper_success?: boolean;
  ens_before?: number;
  ens_after?: number;
  proof_hash?: string;
  process_state?: "running" | "done" | "failed";
  current_category?: Tag;
  current_step?: string;
  current_step_state?: string;
  current_line?: string;
  keeper?: {
    status?: string;
    workflow_result?: {
      status?: string;
      tx_hash?: string;
      tx_link?: string;
      transactionHash?: string;
      transactionLink?: string;
    };
  };
  agents?: DashboardAgent[];
  trace_steps?: DashboardTraceStep[];
  events?: DashboardEvent[];
  console_feed?: string[];
  sentence_results?: Array<{
    sentence: string;
    status: string;
    flag_reason?: string;
  }>;
};

const tagClass: Record<Tag, string> = {
  INPUT: "border-cyanx/30 bg-cyanx/10 text-cyanx",
  PLAN: "border-violetx/30 bg-violetx/10 text-violetx",
  FETCH: "border-cyanx/30 bg-cyanx/10 text-cyanx",
  REASON: "border-violetx/30 bg-violetx/10 text-violetx",
  RISK: "border-orangex/30 bg-orangex/10 text-orangex",
  TRUST: "border-mintx/30 bg-mintx/10 text-mintx",
  EXEC: "border-orangex/30 bg-orangex/10 text-orangex",
  PROOF: "border-cyanx/30 bg-cyanx/10 text-cyanx",
  ENS: "border-mintx/30 bg-mintx/10 text-mintx",
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function shortenHash(value: string, head = 8, tail = 6) {
  return value.length > head + tail + 3 ? `${value.slice(0, head)}...${value.slice(-tail)}` : value;
}

function getEnsRecordsUrl(name: string) {
  return `https://sepolia.app.ens.domains/${encodeURIComponent(name)}?tab=records`;
}

function isInitialDashboardState(payload: DashboardPayload | null) {
  if (!payload) return true;

  return Boolean(
    !payload.task_id &&
      !payload.response &&
      !payload.trust_score &&
      !payload.flagged_count &&
      !payload.clean_count &&
      !payload.ens_before &&
      !payload.ens_after &&
      !payload.keeper_status &&
      !payload.keeper?.status &&
      !payload.current_step &&
      !payload.current_line
  );
}

function isRunCompleted(payload: DashboardPayload | null) {
  if (!payload) return false;

  const keeperStatus = (payload.keeper_status ?? payload.keeper?.status ?? "").toUpperCase();
  return (
    payload.process_state === "done" ||
    payload.process_state === "failed" ||
    payload.keeper_success === true ||
    keeperStatus === "EXECUTED" ||
    keeperStatus === "FAILED"
  );
}

function inferTag(message: string): Tag {
  const lower = message.toLowerCase();
  if (lower.includes("keeperhub") || lower.includes("execute") || lower.includes("tx")) return "EXEC";
  if (lower.includes("proof") || lower.includes("0g")) return "PROOF";
  if (lower.includes("ens") || lower.includes("trust score updated") || lower.includes("selected")) return "ENS";
  if (lower.includes("scrub") || lower.includes("hallucination") || lower.includes("relevance") || lower.includes("trust")) return "TRUST";
  if (lower.includes("fetch") || lower.includes("source") || lower.includes("receipt") || lower.includes("logged")) return "FETCH";
  if (lower.includes("risk") || lower.includes("slippage") || lower.includes("mev")) return "RISK";
  if (lower.includes("plan") || lower.includes("task")) return "PLAN";
  if (lower.includes("answer") || lower.includes("response")) return "REASON";
  return "INPUT";
}

function toLogLines(lines: string[] | undefined) {
  if (!lines || lines.length === 0) return [];
  return lines.map((message) => ({
    time: "",
    tag: inferTag(message),
    message,
  }));
}

function toEventLines(payload: DashboardPayload | null) {
  if (payload?.events?.length) {
    const deduped: Array<LogLine & { step?: string; state?: string }> = [];
    for (const event of payload.events) {
      const nextLine = {
        time: event.time,
        tag: event.category,
        message: event.line,
        step: event.step,
        state: event.state,
      };
      const prev = deduped[deduped.length - 1];
      if (prev && prev.tag === nextLine.tag && prev.message === nextLine.message) {
        continue;
      }
      deduped.push(nextLine);
    }
    return deduped;
  }

  return toLogLines(payload?.console_feed);
}

function categoryLabel(tag: Tag) {
  return tag === "EXEC" ? "KEEPERHUB" : tag;
}

function getLogMood(message: string, tag: Tag): LogMood {
  const lower = message.toLowerCase();
  if (
    lower.startsWith("traceback diary") ||
    lower.startsWith("selecting ") ||
    lower.startsWith("let's start") ||
    lower.startsWith("let’s start") ||
    lower.startsWith("gathering ") ||
    lower.startsWith("reviewing ") ||
    lower.startsWith("passing through ") ||
    lower.startsWith("updating ") ||
    lower.startsWith("loading ")
  ) {
    return "heading";
  }
  if (
    lower.includes("selected") ||
    lower.includes("found") ||
    lower.includes("clean") ||
    lower.includes("trust score") ||
    lower.includes("approved") ||
    lower.includes("0g root pinned") ||
    lower.includes("executed successfully") ||
    lower.includes("success")
  )
    return "success";
  if (
    lower.includes("waiting") ||
    lower.includes("reviewing") ||
    lower.includes("running") ||
    lower.includes("task") ||
    lower.includes("loading") ||
    lower.includes("reading") ||
    lower.includes("started")
  )
    return "warning";
  if (lower.includes("failed") || lower.includes("flagged") || lower.includes("error") || lower.includes("held") || lower.includes("slipped") || lower.includes("blocked"))
    return "danger";
  if (tag === "EXEC") return "warning";
  return "neutral";
}

function moodClass(mood: LogMood) {
  if (mood === "heading") return "text-white font-semibold";
  if (mood === "success") return "text-mintx";
  if (mood === "warning") return "text-orangex";
  if (mood === "danger") return "text-red-400";
  return "text-slate-300";
}

function moodAccentClass(mood: LogMood) {
  if (mood === "heading") return "border-violetx/40 bg-violetx/10";
  if (mood === "success") return "border-mintx/30 bg-mintx/10";
  if (mood === "warning") return "border-orangex/30 bg-orangex/10";
  if (mood === "danger") return "border-red-500/30 bg-red-500/10";
  return "border-line bg-white/[0.02]";
}

function renderInlineMessage(message: string) {
  const urlPattern = /(https?:\/\/[^\s]+)/g;
  const parts = message.split(urlPattern);

  return parts.map((part, index) => {
    if (part.startsWith("http://") || part.startsWith("https://")) {
      return (
        <a
          key={`${part}-${index}`}
          href={part}
          target="_blank"
          rel="noreferrer"
          className="text-cyanx underline decoration-cyanx/40 underline-offset-4 hover:text-mintx"
        >
          {part}
        </a>
      );
    }

    return <span key={`${part}-${index}`}>{part}</span>;
  });
}

function iconForTraceStep(title: string): React.ElementType {
  const lower = title.toLowerCase();
  if (lower.includes("agent")) return Users;
  if (lower.includes("source")) return Network;
  if (lower.includes("reason") || lower.includes("response")) return BrainCircuit;
  if (lower.includes("risk") || lower.includes("trust")) return Gauge;
  if (lower.includes("gate") || lower.includes("keeper")) return ShieldCheck;
  if (lower.includes("execute")) return Zap;
  if (lower.includes("proof")) return FileCheck2;
  if (lower.includes("ens")) return Activity;
  return CircleDot;
}

function buildActivityEvents(steps: DashboardTraceStep[] | undefined) {
  if (!steps?.length) return [];

  return steps.map((step, index) => ({
    step: index + 1,
    label: step.title,
    meta: step.summary ?? (step.logs?.[0] ?? "Live trace step from `main.py`"),
    icon: iconForTraceStep(step.title),
    color:
      (step.state ?? "").toLowerCase() === "done"
        ? "text-mintx"
        : (step.state ?? "").toLowerCase() === "active"
          ? "text-violet-300"
          : "text-slate-400",
  }));
}

function getSidebarAgents(payload: DashboardPayload | null) {
  if (!payload?.agents?.length) return [];

  return payload.agents.map((agent, index) => ({
    name: agent.name,
    score: agent.trust_score ?? 0,
    status: agent.status ?? "Online",
    color: index === 0 ? "violet" : index === 1 ? "cyan" : index === 2 ? "amber" : "red",
    active: Boolean(agent.selected),
  }));
}

export default function DeterAgentApp() {
  const [task, setTask] = useState("");
  const [visibleLogs, setVisibleLogs] = useState<Array<LogLine & { step?: string; state?: string }>>([]);
  const [running, setRunning] = useState(false);
  const [awaitingFreshRun, setAwaitingFreshRun] = useState(false);
  const [keeperState, setKeeperState] = useState<KeeperState>("IDLE");
  const [dashboardData, setDashboardData] = useState<DashboardPayload | null>(null);
  const [chainAgents, setChainAgents] = useState<DashboardAgent[]>([]);
  const [completionOpen, setCompletionOpen] = useState(false);
  const [sealOutcome, setSealOutcome] = useState<FinalOutcome | null>(null);
  const [sealLocked, setSealLocked] = useState(false);
  const pageTopRef = useRef<HTMLElement | null>(null);
  const completionSeenForRef = useRef<string | null>(null);
  const awaitingFreshRunRef = useRef(false);
  const pendingTaskIdRef = useRef<string | null>(null);

  useEffect(() => {
    awaitingFreshRunRef.current = awaitingFreshRun;
  }, [awaitingFreshRun]);

  function payloadHasLiveSignals(payload: DashboardPayload) {
    return Boolean(
      payload.process_state === "running" ||
        payload.current_step ||
        payload.current_line ||
        payload.events?.length ||
        payload.console_feed?.length
    );
  }

  function isTrustResultReady(payload: DashboardPayload | null) {
    if (!payload) return false;

    if (payload.process_state === "done" || payload.process_state === "failed") return true;

    const currentStep = (payload.current_step ?? "").toLowerCase();
    return currentStep.includes("trust analysis") || currentStep.includes("keeperhub gate") || currentStep.includes("reputation update");
  }

  useEffect(() => {
    let isMounted = true;

    async function syncDashboard() {
      try {
        const response = await fetch("/update", { cache: "no-store" });
        if (response.status === 204 || !response.ok) return;

        const payload = (await response.json()) as DashboardPayload;
        if (isMounted) {
          if (awaitingFreshRunRef.current && payload.task_id && payload.task_id === pendingTaskIdRef.current) {
            return;
          }

          if (awaitingFreshRunRef.current && payload.task_id && payload.task_id !== pendingTaskIdRef.current) {
            setAwaitingFreshRun(false);
            pendingTaskIdRef.current = null;
          }

          setDashboardData(payload);
          if (payload.events?.length) {
            setVisibleLogs(toEventLines(payload));
          }
          const txHash = payload.keeper?.workflow_result?.tx_hash ?? payload.keeper?.workflow_result?.transactionHash;
          const keeperSuccess = payload.keeper_success === true || payload.keeper_status === "EXECUTED" || payload.keeper?.status === "EXECUTED";
          const status = payload.keeper?.status || payload.keeper_status;
          const finalOutcome = resolveFinalOutcome(payload);
          const flowComplete = payload.process_state === "done" || payload.process_state === "failed" || keeperSuccess || status === "FAILED";

          setRunning(payload.process_state ? payload.process_state === "running" : Boolean(payload.task_id && !txHash && !keeperSuccess));
          setKeeperState(
            status === "EXECUTED"
              ? "SUCCESS"
              : status === "FAILED"
              ? "FAILED"
              : payload.current_step === "KeeperHub Gate" && payload.current_step_state === "active"
              ? "EXECUTING"
              : "READY TO EXECUTE"
          );
          setSealOutcome(finalOutcome);

          if (flowComplete && payload.task_id && completionSeenForRef.current !== payload.task_id) {
            completionSeenForRef.current = payload.task_id;
            setCompletionOpen(true);
            window.scrollTo({ top: 0, behavior: "smooth" });
            if (pageTopRef.current) {
              pageTopRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
            }
          }

          if (!flowComplete && payload.process_state === "running") {
            setCompletionOpen(false);
          }
        }
      } catch {
        // Keep the local demo state when the bridge has not posted yet.
      }
    }

    void syncDashboard();
    const interval = window.setInterval(() => {
      void syncDashboard();
    }, 500);

    return () => {
      isMounted = false;
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function syncAgents() {
      try {
        const response = await fetch("/agents", { cache: "no-store" });
        if (!response.ok) return;

        const payload = (await response.json()) as { agents?: DashboardAgent[] };
        if (isMounted && Array.isArray(payload.agents)) {
          setChainAgents(payload.agents);
        }
      } catch {
        // Keep the previous chain snapshot when the RPC is unavailable.
      }
    }

    void syncAgents();

    return () => {
      isMounted = false;
    };
  }, []);

  function runAgent() {
    setRunning(true);
    setAwaitingFreshRun(true);
    pendingTaskIdRef.current = dashboardData?.task_id ?? null;
    setVisibleLogs([]);
    setKeeperState("READY TO EXECUTE");
    setCompletionOpen(false);
    setSealLocked(false);
    setSealOutcome(null);
    completionSeenForRef.current = null;

    setDashboardData({
      ...(dashboardData ?? {}),
      task: task || dashboardData?.task || "When was Uniswap launched and who created it?",
      process_state: "running",
      current_category: "ENS",
      current_step: "Agent Selection",
      current_step_state: "active",
      current_line: "Starting agent selection...",
      agents: chainAgents.length ? chainAgents : dashboardData?.agents ?? [],
    });

    void fetch("/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        task: task || dashboardData?.task || "When was Uniswap launched and who created it?",
      }),
    }).catch(() => {
      setVisibleLogs([{ time: "", tag: "TRUST", message: "Failed to start main.py from the UI." }]);
      setRunning(false);
      setAwaitingFreshRun(false);
      pendingTaskIdRef.current = null;
    });
  }

  return (
    <main ref={pageTopRef} className="min-h-screen p-4 text-slate-100 lg:p-6">
      <div className="grid min-h-[calc(100vh-32px)] grid-cols-1 gap-4 overflow-x-hidden xl:h-[calc(100vh-3rem)] xl:grid-cols-[270px_minmax(780px,1fr)_300px] xl:items-start xl:overflow-hidden">
        <Sidebar agents={chainAgents.length ? chainAgents : dashboardData?.agents ?? []} />

        <section className="min-w-0 space-y-4 xl:h-full xl:min-h-0 xl:overflow-y-auto xl:pr-1">
          <TopInputBar task={dashboardData?.task ?? task} setTask={setTask} runAgent={runAgent} running={running} />
          <VerdictBanner payload={awaitingFreshRun ? null : dashboardData} trustReady={isTrustResultReady(awaitingFreshRun ? null : dashboardData)} />
          {/* <StatusBox
            verdict={(dashboardData?.verdict ?? "VERIFY") as "TRUST" | "VERIFY" | "DO NOT TRUST"}
          /> */}
          <TraceContainer payload={dashboardData} logs={visibleLogs} running={running} />

        </section>

        <RightPanel
          isInitial={awaitingFreshRun ? true : isInitialDashboardState(dashboardData)}
          trustReady={isTrustResultReady(awaitingFreshRun ? null : dashboardData)}
          showConsequence={awaitingFreshRun ? false : isRunCompleted(dashboardData)}
          trustScore={awaitingFreshRun ? 0 : dashboardData?.trust_score ?? 0}
          completedStep={awaitingFreshRun ? -1 : dashboardData?.task_id ? 1 : -1}
          decision={awaitingFreshRun || !isTrustResultReady(dashboardData) ? "PENDING" : dashboardData?.keeper_status ?? "PENDING"}
          txHash={awaitingFreshRun ? "pending" : dashboardData?.keeper?.workflow_result?.tx_hash ?? dashboardData?.keeper?.workflow_result?.transactionHash ?? "pending"}
          txLink={awaitingFreshRun ? undefined : dashboardData?.keeper?.workflow_result?.tx_link ?? dashboardData?.keeper?.workflow_result?.transactionLink}
          proofHash={awaitingFreshRun ? "pending" : dashboardData?.proof_hash ?? "pending"}
          selectedAgent={awaitingFreshRun ? "Awaiting selection" : dashboardData?.selected_agent?.name ?? "Awaiting selection"}
          hallucinationScore={awaitingFreshRun ? undefined : dashboardData?.hallucination_score}
          relevanceScore={awaitingFreshRun ? undefined : dashboardData?.relevance_score}
          ensBefore={awaitingFreshRun ? undefined : dashboardData?.ens_before}
          ensAfter={awaitingFreshRun ? undefined : dashboardData?.ens_after}
          activityEvents={awaitingFreshRun ? [] : buildActivityEvents(dashboardData?.trace_steps)}
        />
      </div>
      {completionOpen && (
        <CompletionSealModal
          outcome={sealOutcome ?? resolveFinalOutcome(dashboardData)}
          taskId={dashboardData?.task_id ?? "pending"}
          txHash={dashboardData?.keeper?.workflow_result?.tx_hash ?? dashboardData?.keeper?.workflow_result?.transactionHash}
          txLink={dashboardData?.keeper?.workflow_result?.tx_link ?? dashboardData?.keeper?.workflow_result?.transactionLink}
          onOk={() => {
            setSealLocked(true);
            setCompletionOpen(false);
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        />
      )}
    </main>
  );
}

function Shell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "border border-line bg-panel shadow-[0_22px_70px_rgba(0,0,0,0.28)] backdrop-blur-xl",
        className
      )}
    >
      {children}
    </div>
  );
}

function Sidebar({ agents }: { agents: DashboardAgent[] }) {
  const menu = [
    { label: "Overview", icon: Home, active: true },
    { label: "Agents", icon: Users },
    // { label: "Executions", icon: Play },
    { label: "Proofs", icon: ShieldCheck },
    // { label: "Analytics", icon: BarChart3 },
    { label: "Settings", icon: Settings },
  ];

  return (
    <Shell className="flex max-h-[42vh] flex-col overflow-y-auto overscroll-contain rounded-2xl p-4 lg:max-h-[48vh] xl:h-full xl:max-h-none">
      <div className="mb-6 flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-xl border border-violetx/50 bg-violetx/15 shadow-glow">
          <ShieldCheck className="h-6 w-6 text-violetx" />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold">DeterAgent</h1>
          <p className="text-xs leading-5 text-slate-400">Trust Firewall & Execution Layer for AI Agents</p>
        </div>
      </div>

      <nav className="space-y-2">
        {menu.map(({ label, icon: Icon, active }) => (
          <button
            key={label}
            className={cx(
              "flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left text-sm transition",
              active
                ? "border-violetx/50 bg-violetx/20 text-white shadow-glow"
                : "border-transparent text-slate-400 hover:border-line hover:bg-white/5 hover:text-white"
            )}
          >
            <Icon className="h-5 w-5" />
            {label}
          </button>
        ))}
      </nav>

      <div className="my-5 h-px bg-line" />

      <p className="mb-3 px-2 text-xs font-semibold uppercase text-slate-400">AI Agents</p>
      {agents.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line bg-white/[0.02] p-4 text-sm text-slate-500">
          Waiting for live agent selection by DeterAgent.
        </div>
      ) : (
        <div className="space-y-2">
          {agents.map((agent, index) => (
            <AgentCard
              key={agent.name}
              agent={{
                name: agent.name,
                score: agent.trust_score ?? 0,
                status: agent.status ?? "Online",
                color: index === 0 ? "violet" : index === 1 ? "cyan" : index === 2 ? "amber" : "red",
                active: Boolean(agent.selected),
                ensUrl: getEnsRecordsUrl(agent.name),
              }}
            />
          ))}
        </div>
      )}

      <button className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-violetx/30 bg-violetx/10 px-3 py-3 text-xs font-semibold uppercase text-violet-200">
        View All Agents <ChevronRight className="h-4 w-4" />
      </button>

      <Shell className="mt-auto rounded-2xl p-4">
        <p className="mb-3 text-xs font-semibold uppercase text-slate-300">System Status</p>
        {["0G Storage", "ENS Service", "KeeperHub"].map((item) => (
          <div key={item} className="flex items-center justify-between py-1 text-xs text-slate-400">
            <span>{item}</span>
            <span className="flex items-center gap-1 text-mintx"><span className="h-1.5 w-1.5 rounded-full bg-mintx" />Online</span>
          </div>
        ))}
      </Shell>
    </Shell>
  );
}

function AgentCard({ agent }: { agent: SidebarAgent }) {
  const tone =
    agent.color === "cyan"
      ? "border-cyanx/40 bg-cyanx/10 text-cyanx"
      : agent.color === "amber"
        ? "border-orangex/40 bg-orangex/10 text-orangex"
        : agent.color === "red"
          ? "border-red-500/40 bg-red-500/10 text-red-400"
          : "border-violetx/50 bg-violetx/15 text-violet-200";

  return (
    <div className={cx("rounded-xl border p-3", agent.active ? "shadow-glow" : "", tone)}>
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-full border border-current/30 bg-black/20">
          <BrainCircuit className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-white">{agent.name}</div>
          <div className="text-[10px] uppercase text-slate-400">Trust Score</div>
          <div className="flex items-end gap-1">
            <span className="text-xl font-semibold text-white">{agent.score}</span>
            <span className="pb-1 text-xs text-slate-400">/100</span>
          </div>
        </div>
        <span className={cx("mt-auto flex items-center gap-1 text-[10px]", agent.status === "Online" ? "text-mintx" : "text-red-400")}>
          <span className={cx("h-1.5 w-1.5 rounded-full", agent.status === "Online" ? "bg-mintx" : "bg-red-400")} />
          {agent.status}
        </span>
      </div>
      <div className="mt-3 flex justify-end">
        <a
          href={agent.ensUrl}
          target="_blank"
          rel="noreferrer"
          className="rounded-lg border border-violetx/30 bg-violetx/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-violet-200 transition hover:border-cyanx/40 hover:bg-cyanx/10 hover:text-white"
        >
          View on ENS
        </a>
      </div>
    </div>
  );
}

function TopInputBar({
  task,
  setTask,
  runAgent,
  running,
}: {
  task: string;
  setTask: (value: string) => void;
  runAgent: () => void;
  running: boolean;
}) {
  return (
    <Shell className="rounded-2xl p-4">
      <div className="mb-2 text-xs font-semibold uppercase text-violet-300">Agent Intent / Task</div>
      <div className="grid gap-3 md:grid-cols-[1fr_auto]">
        <input
          value={task}
          onChange={(event) => setTask(event.target.value)}
          className="h-14 rounded-xl border border-line bg-black/35 px-4 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyanx/50 focus:shadow-cyan"
        />
        <button
          onClick={runAgent}
          disabled={running}
          className="flex h-14 min-w-36 items-center justify-center gap-2 rounded-xl border border-violetx/50 bg-gradient-to-r from-violetx to-indigo-600 px-5 text-sm font-semibold uppercase shadow-glow transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {running ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          Run Agent
        </button>
      </div>
    </Shell>
  );
}

function VerdictBanner({ payload, trustReady }: { payload: DashboardPayload | null; trustReady: boolean }) {
  const score = payload?.trust_score ?? 0;
  const isInitial = isInitialDashboardState(payload);
  const neutral = isInitial || !trustReady;
  const band = getTrustBand(score);
  const verdict = (payload?.verdict ?? "").toUpperCase();
  const isTrusted = !neutral && band === "trust" && verdict !== "DO NOT TRUST";
  const isVerify = !neutral && !isTrusted && (band === "verify" || verdict === "VERIFY");
  const title = neutral ? "Awaiting Response..." : isTrusted ? "TRUSTED RESPONSE" : "UNTRUSTED RESPONSE";
  const reason =
    neutral
      ? "Ready to receive intent and begin evaluation"
      : payload?.flagged_count && payload.flagged_count > 0
      ? `${payload.flagged_count} claim${payload.flagged_count === 1 ? "" : "s"} not grounded in sources`
      : isTrusted
        ? "Grounded in verified sources"
        : isVerify
          ? "Review recommended before execution"
          : "Execution blocked by DeterAgent";
  const taskId = payload?.task_id ? `#${payload.task_id}` : "Pending";
  const executionStatus = getExecutionStatus(payload);
  const executionTone =
    neutral
      ? "text-slate-400"
      : executionStatus === "EXECUTED"
      ? "text-mintx"
      : executionStatus === "RUNNING"
        ? "text-orangex"
        : executionStatus === "BLOCKED"
          ? "text-red-400"
          : "text-slate-300";
  const Icon = neutral ? CircleDot : isTrusted ? ShieldCheck : ShieldAlert;
  const response = (payload?.response ?? payload?.current_line ?? "").trim();
  const responseSummary =
    response.length > 180 ? `${response.slice(0, 177).trimEnd()}...` : response || "Agent response will appear here once the run produces output.";
  const responseHeading = payload?.response ? "Response ready" : "Agent Response";
  const actionLabel = neutral ? "Waiting" : isTrusted ? "Execution Allowed" : "Execution Blocked";

  return (
    <Shell
      className={cx(
        "overflow-hidden rounded-2xl border px-4 py-3",
        neutral
          ? "border-line bg-gradient-to-r from-white/[0.02] via-white/[0.03] to-white/[0.02]"
          : isTrusted
          ? "border-mintx/25 bg-gradient-to-r from-emerald-500/12 via-emerald-950/45 to-slate-950"
          : isVerify
            ? "border-orangex/25 bg-gradient-to-r from-amber-500/12 via-amber-950/45 to-slate-950"
            : "border-red-500/25 bg-gradient-to-r from-red-500/12 via-red-950/55 to-slate-950"
      )}
    >
      <div className="grid gap-3 lg:grid-cols-[minmax(260px,0.95fr)_minmax(0,1.4fr)_minmax(220px,0.55fr)] lg:items-stretch">
        <div
          className={cx(
            "relative flex min-w-0 items-center gap-4 overflow-hidden rounded-2xl border p-4",
            neutral
              ? "border-line bg-white/[0.02]"
              : isTrusted
              ? "border-mintx/25 bg-gradient-to-br from-emerald-500/15 via-emerald-950/35 to-slate-950"
              : isVerify
                ? "border-orangex/25 bg-gradient-to-br from-amber-500/15 via-amber-950/35 to-slate-950"
                : "border-red-500/25 bg-gradient-to-br from-red-500/15 via-red-950/45 to-slate-950"
          )}
        >
          <div
            className={cx(
              "pointer-events-none absolute inset-0 opacity-80",
              neutral
                ? "bg-[radial-gradient(circle_at_left,rgba(255,255,255,0.10),transparent_42%)]"
                : isTrusted
                ? "bg-[radial-gradient(circle_at_left,rgba(52,245,164,0.22),transparent_42%)]"
                : isVerify
                  ? "bg-[radial-gradient(circle_at_left,rgba(255,157,47,0.22),transparent_42%)]"
                  : "bg-[radial-gradient(circle_at_left,rgba(239,68,68,0.24),transparent_42%)]"
            )}
          />
          <div
            className={cx(
              "pointer-events-none absolute inset-x-0 top-0 h-px",
              neutral
                ? "bg-gradient-to-r from-transparent via-white/20 to-transparent"
                : isTrusted
                ? "bg-gradient-to-r from-transparent via-mintx to-transparent"
                  : isVerify
                    ? "bg-gradient-to-r from-transparent via-orangex to-transparent"
                    : "bg-gradient-to-r from-transparent via-red-400 to-transparent"
            )}
          />
          <span
            className={cx(
              "relative grid h-16 w-16 shrink-0 place-items-center rounded-2xl border shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_0_34px_rgba(43,255,174,0.18)]",
                neutral
                  ? "border-line bg-white/[0.03] text-slate-400"
                  : isTrusted
                  ? "border-mintx/30 bg-mintx/10 text-mintx animate-pulse"
                : isVerify
                  ? "border-orangex/30 bg-orangex/10 text-orangex animate-pulse"
                  : "border-red-500/30 bg-red-500/10 text-red-400 animate-pulse"
            )}
          >
            <Icon className="h-7 w-7" />
          </span>
          <div className="min-w-0">
            <div className={cx("text-lg font-bold uppercase tracking-[0.20em]", neutral ? "text-slate-300" : isTrusted ? "text-mintx" : isVerify ? "text-orangex" : "text-red-400")}>
              {title}
            </div>
            <p className={cx("mt-2 text-sm", neutral ? "text-slate-400" : "text-slate-100")}>{reason}</p>
            <div className={cx("mt-3 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]",
              neutral
                ? "border-line bg-white/[0.03] text-slate-300"
                : isTrusted
                  ? "border-mintx/30 bg-mintx/10 text-mintx"
                  : isVerify
                    ? "border-orangex/30 bg-orangex/10 text-orangex"
                    : "border-red-500/30 bg-red-500/10 text-red-400"
            )}>
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              {actionLabel}
            </div>
          </div>
        </div>

          <div className="min-w-0 rounded-2xl border border-white/10 bg-black/20 p-4 lg:border-l lg:border-white/10 lg:pl-5">
            <div className="text-[10px] font-semibold uppercase tracking-[0.28em] text-slate-500">Agent Response</div>
            <p className="mt-2 max-h-24 overflow-hidden text-sm leading-6 text-slate-300">
            {neutral ? "Awaiting agent intent..." : responseSummary}
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            <span className="rounded-full border border-line bg-white/[0.03] px-2 py-3.5">{payload?.selected_agent?.name ?? "Awaiting selection"}</span>
          </div>
        </div>

        <div className="flex min-w-0 flex-col justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 p-4 lg:border-l lg:border-white/10 lg:pl-4">
          <div>
            <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Run Status</div>
            <div className="mt-2 flex flex-col gap-3">
              <div>
                <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Task ID</div>
                <div className="mt-1 text-sm font-semibold text-white">{taskId}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Execution Status</div>
                <div className={cx("mt-1 text-sm font-semibold uppercase tracking-[0.12em]", executionTone)}>
                  {neutral ? "—" : executionStatus}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Shell>
  );
}

function LogPanel({
  title,
  logs,
  running,
}: {
  title: string;
  logs: Array<LogLine & { step?: string; state?: string }>;
  running: boolean;
}) {
  const logRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [logs]);

  return (
    <Shell className="rounded-2xl border-violetx/50 p-0 shadow-glow">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="grid h-5 w-5 place-items-center rounded-full border border-violetx text-violet-200">
            <ChevronRight className="h-3 w-3" />
          </span>
          <h2 className="text-sm font-semibold uppercase">2. {title}</h2>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span className={cx("rounded-lg border px-2 py-1", running ? "border-mintx/30 bg-mintx/10 text-mintx" : "border-line")}>
            {running ? "Live" : "Ready"}
          </span>
          <button className="rounded-lg border border-line px-2 py-1">Hide Logs</button>
        </div>
      </div>
      <div ref={logRef} className="h-[286px] overflow-y-auto bg-black/30 p-4 font-mono text-xs">
        <p className="mb-2 uppercase text-slate-400">{title} Logs</p>
        {logs.length === 0 ? (
          <div className="grid h-[220px] place-items-center rounded-xl border border-dashed border-line bg-white/[0.02] px-4 text-center text-sm text-slate-500">
            {running ? "Waiting for live output from DeterAgent." : "No active run. Start DeterAgent to stream logs."}
          </div>
        ) : (
          <div className="space-y-1">
            {logs.map((log, index) => (
              <div key={`${log.time}-${log.message}`} className={cx("relative", running && "animate-rise")}>
                {index > 0 && logs[index - 1].tag !== log.tag && (
                  <div className="my-1 flex items-center gap-2 px-2 text-[10px] uppercase tracking-[0.28em] text-slate-500">
                    <span className="h-px flex-1 bg-line/70" />
                    <span>{categoryLabel(log.tag)}</span>
                    <span className="h-px flex-1 bg-line/70" />
                  </div>
                )}
                {running && index === logs.length - 1 && <span className="absolute bottom-0 left-0 h-px w-full animate-stream bg-gradient-to-r from-transparent via-cyanx to-transparent" />}
                {getLogMood(log.message, log.tag) === "heading" ? (
                  <div
                    className={cx(
                      "rounded-lg border px-3 py-2",
                      moodAccentClass(getLogMood(log.message, log.tag)),
                      index > 0 && logs[index - 1].tag !== log.tag && "mt-2"
                    )}
                  >
                    <div className="mt-1 text-sm font-semibold text-white">{log.message}</div>
                  </div>
                ) : (
                  (() => {
                    const lower = log.message.toLowerCase();
                    const isChecking = lower.startsWith("checking");
                    const isVerdict = lower.startsWith("verdict:");
                    const verdictTone =
                      isVerdict && (lower.includes("trust") || lower.includes("execute") || lower.includes("approved"))
                        ? "text-mintx"
                        : isVerdict && (lower.includes("verify") || lower.includes("waiting") || lower.includes("review"))
                          ? "text-orangex"
                          : isVerdict && (lower.includes("block") || lower.includes("fail") || lower.includes("held"))
                            ? "text-red-400"
                            : "";

                    return (
                  <div
                    className={cx(
                      "grid grid-cols-[60px_80px_1fr] items-start gap-2 rounded-md px-2 py-0.5",
                      moodAccentClass(getLogMood(log.message, log.tag)),
                      index > 0 && logs[index - 1].tag !== log.tag && "mt-1"
                    )}
                  >
                    <span className="text-slate-500">{log.time}</span>
                    <span className={cx("w-fit rounded border px-2 py-0.5 text-[10px]", tagClass[log.tag])}>{categoryLabel(log.tag)}</span>
                    <span
                      className={cx(
                        moodClass(getLogMood(log.message, log.tag)),
                        isChecking && "text-slate-500 italic",
                        lower.startsWith("footprint logged") && "text-slate-500",
                        verdictTone
                      )}
                    >
                      {renderInlineMessage(log.message)}
                    </span>
                  </div>
                    );
                  })()
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Shell>
  );
}

function AgentAnswerCard({ completedStep, response }: { completedStep: number; response?: string }) {
  return (
    <Shell className="rounded-2xl p-4">
      <h3 className="mb-3 text-sm font-semibold uppercase text-violet-200">3. Agent Answer</h3>
      <div className="flex gap-3 rounded-xl border border-line bg-white/[0.03] p-4">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-violetx/15 text-violet-200">
          <Bot className="h-5 w-5" />
        </div>
        <p className="min-w-0 text-sm leading-6 text-slate-300">
          {response || "Waiting for live response from DetertAgent."}
        </p>
      </div>
    </Shell>
  );
}

function getExecutionStatus(payload: DashboardPayload | null): "EXECUTED" | "FAILED" | "BLOCKED" | "RUNNING" {
  const rawStatus = (payload?.keeper_status ?? payload?.keeper?.status ?? "").toUpperCase();
  const processState = (payload?.process_state ?? "").toLowerCase();
  const verdict = (payload?.verdict ?? "").toUpperCase();
  const trustScore = payload?.trust_score ?? 0;

  if (rawStatus === "EXECUTED" || payload?.keeper_success === true) return "EXECUTED";
  if (rawStatus === "FAILED" || processState === "failed") return "FAILED";
  if (processState === "running" || rawStatus === "EXECUTING") return "RUNNING";
  if (verdict === "DO NOT TRUST" || trustScore < 70) return "BLOCKED";
  return "RUNNING";
}

function resolveFinalOutcome(payload: DashboardPayload | null): FinalOutcome {
  const rawStatus = (payload?.keeper_status ?? payload?.keeper?.status ?? "").toUpperCase();
  const trustScore = payload?.trust_score ?? 0;
  const verdict = (payload?.verdict ?? "").toUpperCase();

  if (rawStatus === "FAILED") return "FAILED";
  if (trustScore < 70 || verdict === "DO NOT TRUST") return "BLOCKED";
  return "EXECUTED";
}

function LiveRunHeader({
  currentStep,
  currentCategory,
  currentState,
}: {
  currentStep?: string;
  currentCategory?: Tag;
  currentState?: string;
}) {
  const stages = [
    { label: "Agent", step: "Agent Selection", category: "INPUT", color: "text-mintx" },
    { label: "Fetch + Proof", step: "Fetch URL, Log Proof to 0G", category: "FETCH", color: "text-violet-300" },
    { label: "Reason", step: "Agent Response", category: "REASON", color: "text-cyanx" },
    { label: "Trust", step: "Trust Analysis", category: "TRUST", color: "text-orangex" },
    { label: "ENS", step: "Reputation Update", category: "ENS", color: "text-violet-300" },
    { label: "KeeperHub", step: "KeeperHub Gate", category: "EXEC", color: "text-mintx" },
  ] as const;

  const activeIndex = stages.findIndex((stage) => stage.step === currentStep);
  const progress = activeIndex < 0 ? 0 : ((activeIndex + (currentState === "done" ? 1 : 0)) / stages.length) * 100;

  return (
    <Shell className="rounded-2xl p-4">
      <div className="mb-4 flex items-start gap-4">
        <div className="grid h-12 w-12 place-items-center rounded-2xl border border-violetx/50 bg-violetx/15 text-violetx shadow-glow">
          <ShieldCheck className="h-6 w-6" />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold uppercase text-slate-200">Live Traceback</h3>
          <p className="mt-1 text-xs text-slate-400">
            {currentStep ? `${currentStep} · ${currentCategory === "EXEC" ? "KeeperHub" : currentCategory}` : "Waiting"}
          </p>
        </div>
      </div>

      <div className="relative h-2 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-violetx via-cyanx to-mintx transition-all duration-300"
          style={{ width: `${Math.max(4, progress)}%` }}
        />
      </div>

      <div className="mt-4 grid grid-cols-6 gap-2 text-center">
        {stages.map((stage, index) => {
          const isActive = index === activeIndex;
          const isDone = activeIndex > index || (index === activeIndex && currentState === "done");
          const isKeeperHub = stage.category === "EXEC";
          return (
            <div key={stage.step} className="min-w-0">
              <div
                className={cx(
                  "mx-auto grid h-10 w-10 place-items-center rounded-full border transition",
                  isDone
                    ? "border-mintx/40 bg-mintx/10 text-mintx"
                    : isActive
                      ? `border-current/50 bg-current/10 ${stage.color}`
                      : "border-line text-slate-500"
                )}
              >
                {isKeeperHub ? <ShieldCheck className="h-4 w-4" /> : <CircleDot className="h-4 w-4" />}
              </div>
              <p className={cx("mt-2 text-[11px] font-medium", isDone || isActive ? "text-white" : "text-slate-500")}>
                {isKeeperHub ? "KeeperHub" : stage.label}
              </p>
              <p className={cx("mt-1 text-[10px] uppercase", isDone || isActive ? "text-mintx" : "text-slate-500")}>
                {isActive ? currentState ?? "active" : index + 1}
              </p>
            </div>
          );
        })}
      </div>
    </Shell>
  );
}

// function KeeperHubStatusCard({ state, completedStep }: { state: KeeperState; completedStep: number }) {
//   const isSuccess = state === "SUCCESS";
//   const isExecuting = state === "EXECUTING";
//   const isFailed = state === "FAILED";
//   return (
//     <Shell className={cx("rounded-2xl p-4", isSuccess ? "border-mintx/50" : isFailed ? "border-red-500/50" : "border-line")}>
//       <h3 className="mb-3 text-sm font-semibold uppercase text-violet-200">4. KeeperHub Status</h3>
//       <div className={cx("flex items-center gap-4 rounded-xl border p-4", isFailed ? "border-red-500/40 bg-red-500/10" : "border-mintx/40 bg-mintx/10")}>
//         <span className={cx("grid h-11 w-11 place-items-center rounded-full", isExecuting ? "animate-pulse bg-orangex/20 text-orangex" : "bg-mintx/20 text-mintx")}>
//           {isExecuting ? <Radio className="h-5 w-5" /> : <BrainCircuit className="h-5 w-5" />}
//         </span>
//         <div>
//           <p className={cx("text-sm font-semibold uppercase", isExecuting ? "text-orangex" : isFailed ? "text-red-400" : "text-mintx")}>
//             Status: {completedStep < 5 ? "READY TO EXECUTE" : state}
//           </p>
//           <p className="mt-1 text-xs text-slate-300">
//             {isSuccess
//               ? "Execution confirmed. Transaction hash and proof root are available."
//               : isExecuting
//                 ? "KeeperHub is submitting the onchain action."
//                 : "All checks passed. KeeperHub is ready to execute this action."}
//           </p>
//         </div>
//       </div>
//     </Shell>
//   );
// }
function KeeperHubStatusCard({
  state,
  completedStep,
  outcome,
  locked,
}: {
  state: KeeperState;
  completedStep: number;
  outcome: FinalOutcome | null;
  locked: boolean;
}) {
  const isSuccess = state === "SUCCESS";
  const isExecuting = state === "EXECUTING";
  const isFailed = state === "FAILED";
  const isIdle = state === "IDLE";
  const sealedOutcome = locked && outcome ? outcome : null;
  const statusTone =
    sealedOutcome === "EXECUTED"
      ? "text-mintx"
      : sealedOutcome === "FAILED"
        ? "text-red-400"
        : sealedOutcome === "BLOCKED"
          ? "text-orangex"
          : isIdle
            ? "text-slate-500"
            : isExecuting
              ? "text-orangex"
              : isFailed
                ? "text-red-400"
                : "text-mintx";
  return (
    <Shell className={cx("rounded-2xl p-4", isSuccess ? "border-mintx/50" : isFailed ? "border-red-500/50" : "border-line")}>
      <h3 className="mb-3 text-sm font-semibold uppercase text-violet-200">4. KeeperHub Status</h3>
      <div className={cx("flex items-center gap-4 rounded-xl border p-4", isFailed ? "border-red-500/40 bg-red-500/10" : "border-mintx/40 bg-mintx/10")}>
        <span className={cx("grid h-11 w-11 place-items-center rounded-full", isExecuting ? "animate-pulse bg-orangex/20 text-orangex" : "bg-mintx/20 text-mintx")}>
          {isExecuting ? <Radio className="h-5 w-5" /> : <BrainCircuit className="h-5 w-5" />}
        </span>
        <div>
          <p className={cx("text-sm font-semibold uppercase", statusTone)}>
            Status: {sealedOutcome ? sealedOutcome : isIdle ? "--" : state}
          </p>
          <p className="mt-1 text-xs text-slate-300">
          {isIdle
            ? "Waiting for agent run to reach KeeperHub."
            : sealedOutcome === "BLOCKED"
            ? "Trust was below threshold, so the task was blocked."
            : sealedOutcome === "FAILED"
            ? "KeeperHub failed, so the task failed."
            : sealedOutcome === "EXECUTED"
            ? "Task completed successfully and is sealed."
            : state === "SUCCESS"
            ? "Execution confirmed. Transaction hash and proof root are available."
            : state === "EXECUTING"
            ? "KeeperHub is submitting the onchain action."
            : state === "FAILED"
            ? "Execution failed. Check logs for details."
            : "All checks passed. KeeperHub is ready to execute this action."}
        </p>
        </div>
      </div>
    </Shell>
  );
}

function RightPanel({
  isInitial,
  trustReady,
  showConsequence,
  trustScore,
  completedStep,
  decision,
  txHash,
  txLink,
  proofHash,
  selectedAgent,
  hallucinationScore,
  relevanceScore,
  ensBefore,
  ensAfter,
  activityEvents,
}: {
  isInitial: boolean;
  trustReady: boolean;
  showConsequence: boolean;
  trustScore: number;
  completedStep: number;
  decision: string;
  txHash: string;
  txLink?: string;
  proofHash: string;
  selectedAgent: string;
  hallucinationScore?: number;
  relevanceScore?: number;
  ensBefore?: number;
  ensAfter?: number;
  activityEvents: Array<{ step: number; label: string; meta: string; icon: React.ElementType; color: string }>;
}) {
  return (
    <aside className="space-y-4 overflow-y-auto overscroll-contain lg:max-h-[48vh] xl:h-full xl:max-h-none">
      <Shell className="rounded-2xl p-4">
        <div className="flex items-center justify-center gap-3 py-2 text-xs font-semibold uppercase text-mintx">
          <span className="h-2 w-2 rounded-full bg-mintx" /> Live on 0G
          <Sparkles className="h-3 w-3" /> ENS
          <Sparkles className="h-3 w-3" /> KeeperHub
        </div>
      </Shell>

      <TrustScoreWidget
        isInitial={isInitial}
        trustReady={trustReady}
        score={trustScore}
        completedStep={completedStep}
        hallucinationScore={hallucinationScore}
        relevanceScore={relevanceScore}
        ensBefore={ensBefore}
        ensAfter={ensAfter}
      />
      {showConsequence ? <ConsequenceCard score={trustScore} ensBefore={ensBefore} ensAfter={ensAfter} /> : null}
      <OnChainScoringProofCard proofHash={proofHash} />
      <ExecutionSummary
        agentName={selectedAgent}
        decision={decision}
        txHash={txHash}
        txLink={txLink}
        proofHash={proofHash}
      />
    </aside>
  );
}

function TrustScoreWidget({
  isInitial,
  trustReady,
  score,
  completedStep,
  hallucinationScore,
  relevanceScore,
  ensBefore,
  ensAfter,
}: {
  isInitial: boolean;
  trustReady: boolean;
  score: number;
  completedStep: number;
  hallucinationScore?: number;
  relevanceScore?: number;
  ensBefore?: number;
  ensAfter?: number;
}) {
  const neutral = isInitial || !trustReady;
  const deg = neutral ? 0 : (score / 100) * 360;
  const delta = typeof ensBefore === "number" && typeof ensAfter === "number" ? ensAfter - ensBefore : completedStep >= 4 ? 4 : 0;
  const band = neutral ? "neutral" : getTrustBand(score);
  const ringColor =
    band === "trust"
      ? "#34f5a4"
      : band === "verify"
        ? "#ff9d2f"
        : band === "neutral"
          ? "rgba(148,163,184,0.85)"
          : "#ef4444";
  const ringTrack =
    band === "trust"
      ? "rgba(52,245,164,0.16)"
      : band === "verify"
        ? "rgba(255,157,47,0.16)"
        : band === "neutral"
          ? "rgba(148,163,184,0.18)"
          : "rgba(239,68,68,0.18)";
  return (
    <Shell className="rounded-2xl p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-[0.08em]">Trust Score</h3>
        <span
            className={cx(
              "rounded-lg border px-2 py-1 text-[10px] font-semibold uppercase",
              band === "trust"
                ? "border-mintx/40 bg-mintx/10 text-mintx"
                : band === "verify"
                  ? "border-orangex/40 bg-orangex/10 text-orangex"
                  : band === "neutral"
                    ? "border-line bg-white/[0.03] text-slate-400"
                    : "border-red-500/40 bg-red-500/10 text-red-400"
            )}
          >
          {band === "trust" ? "Trust" : band === "verify" ? "Need Verify" : band === "neutral" ? "Awaiting" : "Low Trust"}
        </span>
      </div>
      <div className="grid grid-cols-[1fr_0.9fr] items-center gap-4">
        <div
          className="grid aspect-square place-items-center rounded-full"
          style={{ background: `conic-gradient(${ringColor} ${deg}deg, ${ringTrack} 0deg)` }}
        >
          <div className="grid h-[78%] w-[78%] place-items-center rounded-full bg-[#07111f] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03)]">
            <div className="text-center">
              <div
              className={cx(
                  "text-5xl font-extrabold",
                  band === "trust"
                    ? "text-mintx"
                    : band === "verify"
                      ? "text-orangex"
                      : band === "neutral"
                        ? "text-slate-300"
                        : "text-red-400"
                )}
              >
                {neutral ? "—" : score || "--"}
              </div>
              <div
                className={cx(
                  "text-sm",
                  band === "trust"
                    ? "text-mintx/90"
                    : band === "verify"
                      ? "text-orangex/90"
                      : band === "neutral"
                        ? "text-slate-400"
                        : "text-red-300"
                )}
              >
                /100
              </div>
              <div
                className={cx(
                  "mt-1 text-sm font-medium",
                  band === "trust"
                    ? "text-mintx"
                    : band === "verify"
                      ? "text-orangex"
                      : band === "neutral"
                        ? "text-slate-400"
                        : "text-red-400"
                )}
              >
                {band === "trust" ? "Trust" : band === "verify" ? "Verify" : band === "neutral" ? "Waiting" : "Blocked"}
              </div>
            </div>
          </div>
        </div>
        <div className="space-y-4 border-l border-line pl-4">
          <div>
            <div
              className={cx(
                "text-2xl font-bold",
                band === "trust"
                  ? "text-mintx"
                  : band === "verify"
                    ? "text-orangex"
                    : band === "neutral"
                      ? "text-slate-300"
                      : "text-red-400"
              )}
            >
              {neutral ? "—" : score > 0 ? `${delta >= 0 ? "+" : ""}${delta} up` : "--"}
            </div>
            <p className="text-xs text-slate-400">Trust Change</p>
          </div>
          <div className="text-xs text-slate-400">
            Last Updated
            <br />
            <span className="text-white">{neutral ? "pending" : score > 0 ? "just now" : "pending"}</span>
          </div>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-3 divide-x divide-line border-t border-line pt-4 text-center">
        <Metric value={typeof hallucinationScore === "number" ? String(hallucinationScore) : "--"} label="Grounding" />
        <Metric value={typeof relevanceScore === "number" ? String(relevanceScore) : "--"} label="Relevance" />
        <Metric value={typeof score === "number" ? String(score) : "--"} label="Source Quality" />
      </div>
    </Shell>
  );
}

function getTrustBand(score: number) {
  if (score >= 80) return "trust";
  if (score >= 50) return "verify";
  return "blocked";
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="text-2xl font-semibold text-white">{value}</div>
      <div className="mt-1 text-xs text-slate-400">{label}</div>
    </div>
  );
}

function ConsequenceCard({
  score,
  ensBefore,
  ensAfter,
}: {
  score: number;
  ensBefore?: number;
  ensAfter?: number;
}) {
  const band = getTrustBand(score);
  const before = typeof ensBefore === "number" ? ensBefore : "--";
  const after = typeof ensAfter === "number" ? ensAfter : "--";
  const delta = typeof ensBefore === "number" && typeof ensAfter === "number" ? ensAfter - ensBefore : 0;

  return (
    <Shell className="rounded-2xl p-4">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.08em] text-violet-200">Consequence</h3>
      <div className="grid grid-cols-[1fr_auto] items-center gap-4">
        <div>
          <div className="text-sm text-slate-400">Agent reputation updated</div>
          <div className="mt-2 flex items-center gap-3 text-2xl font-extrabold">
            <span className={cx(band === "trust" ? "text-mintx" : band === "verify" ? "text-orangex" : "text-red-400")}>{before}</span>
            <span className="text-slate-400">→</span>
            <span className={cx(band === "trust" ? "text-mintx" : band === "verify" ? "text-orangex" : "text-red-400")}>{after}</span>
          </div>
        </div>
        <div className={cx("text-right text-sm font-semibold", band === "trust" ? "text-mintx" : band === "verify" ? "text-orangex" : "text-red-400")}>
          {band === "trust" ? "Reward Applied" : band === "verify" ? "Review Recommended" : "Penalty Applied"}
          <div className="mt-1 text-xs font-normal text-slate-500">{delta ? `${delta >= 0 ? "+" : ""}${delta}` : ""}</div>
        </div>
      </div>
    </Shell>
  );
}

function OnChainScoringProofCard({ proofHash }: { proofHash: string }) {
  const displayHash = proofHash && proofHash !== "pending" ? proofHash : "pending";
  const shortHash = displayHash === "pending" ? "pending" : shortenHash(displayHash);

  return (
    <Shell className="rounded-2xl border-mintx/20 bg-gradient-to-br from-emerald-950/25 via-black/10 to-transparent p-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-mintx">On-chain Scoring Proof</h3>
        <span className="rounded-md border border-line px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-slate-400">
          0G
        </span>
      </div>
      <p className="mt-1 text-[12px] leading-5 text-slate-400">Verifiable OG root hash for the final scoring bundle.</p>
      <div className="mt-2 rounded-lg border border-line bg-black/20 px-3 py-2">
        <div className="text-[9px] uppercase tracking-[0.22em] text-slate-500">OG pinned hash</div>
        <div className="mt-1 break-all font-mono text-[12px] leading-5 text-cyanx">{shortHash}</div>
      </div>
    </Shell>
  );
}

function ExecutionSummary({
  agentName,
  decision,
  txHash,
  txLink,
  proofHash,
}: {
  agentName: string;
  decision: string;
  txHash: string;
  txLink?: string;
  proofHash: string;
}) {
  const isBlocked = decision.toUpperCase().includes("BLOCKED");
  const rows = [
    ["Agent", agentName, BrainCircuit],
    ["Decision", decision, ShieldCheck],
    ["Executed By", "KeeperHub", Bot],
    ["Tx Hash", isBlocked ? "None" : txHash, Network],
    ["Proof (0G)", proofHash, FileCheck2],
    ["Time", "Live", Activity],
  ] as const;
  const decisionTone =
    decision.toUpperCase().includes("EXECUTED") || decision.toUpperCase().includes("TRUST")
      ? "text-mintx"
      : decision.toUpperCase().includes("VERIFY")
        ? "text-orangex"
        : decision.toUpperCase().includes("PENDING") || decision.toUpperCase().includes("WAIT")
          ? "text-slate-300"
        : "text-red-400";
  const txHashDisplay = isBlocked ? "None" : typeof txHash === "string" ? shortenHash(txHash) : txHash;
  const proofHashDisplay = typeof proofHash === "string" ? shortenHash(proofHash) : proofHash;
  return (
    <Shell className="rounded-2xl p-3.5">
      <h3 className="mb-2.5 text-sm font-semibold uppercase tracking-[0.08em] text-violet-200">Execution Summary</h3>
      <div className="divide-y divide-line">
        {rows.map(([label, value, Icon]) => (
          <div key={label} className="grid grid-cols-[18px_minmax(0,1fr)_minmax(0,1.15fr)] items-center gap-2 py-2 text-sm">
            <Icon className="h-3.5 w-3.5 text-slate-400" />
            <span className="min-w-0 truncate text-slate-400">{label}</span>
            {label === "Tx Hash" ? (
              txLink && !isBlocked ? (
                <a
                  href={txLink}
                  target="_blank"
                  rel="noreferrer"
                  title={String(value)}
                  className="min-w-0 justify-self-end truncate text-right font-mono text-[12px] text-cyanx transition hover:text-mintx hover:underline hover:decoration-cyanx/40 hover:underline-offset-4"
                >
                  {txHashDisplay}
                </a>
              ) : (
                <span className="min-w-0 justify-self-end truncate text-right font-mono text-[12px] text-cyanx">
                  {txHashDisplay}
                </span>
              )
            ) : label === "Proof (0G)" ? (
              <span className="min-w-0 justify-self-end truncate text-right font-mono text-[12px] text-violet-300">
                {proofHashDisplay}
              </span>
            ) : (
              <span
                className={cx(
                  "min-w-0 justify-self-end truncate text-right",
                  label === "Decision" ? decisionTone : "text-violet-300"
                )}
                title={String(value)}
              >
                {value}
              </span>
            )}
          </div>
        ))}
      </div>
    </Shell>
  );
}

function CompletionSealModal({
  outcome,
  taskId,
  txHash,
  txLink,
  onOk,
}: {
  outcome: FinalOutcome;
  taskId: string;
  txHash?: string;
  txLink?: string;
  onOk: () => void;
}) {
  const title =
    outcome === "EXECUTED"
      ? "Task Completed"
      : outcome === "FAILED"
        ? "Task Failed"
        : "Task Blocked";
  const subtitle =
    outcome === "EXECUTED"
      ? "The run finished successfully and the result is sealed."
      : outcome === "FAILED"
        ? "KeeperHub returned a failure for this run."
        : "The trust score stayed below threshold, so execution was blocked.";
  const tone =
    outcome === "EXECUTED"
      ? "border-mintx/30 bg-mintx/10 text-mintx"
      : outcome === "FAILED"
        ? "border-red-500/30 bg-red-500/10 text-red-400"
        : "border-orangex/30 bg-orangex/10 text-orangex";

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/80 px-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-[28px] border border-white/10 bg-[#07111f] p-6 shadow-[0_25px_90px_rgba(0,0,0,0.45)]">
        <div className="mb-5 flex items-start gap-4">
          <div className={cx("grid h-14 w-14 shrink-0 place-items-center rounded-2xl border", tone)}>
            <ShieldCheck className="h-7 w-7" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Run Sealed</div>
            <h3 className="mt-2 text-2xl font-bold text-white">{title}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-300">{subtitle}</p>
          </div>
        </div>

        <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="text-slate-400">Task ID</span>
            <span className="font-semibold text-white">{taskId ? `#${taskId}` : "pending"}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-slate-400">Outcome</span>
            <span className={cx("font-semibold uppercase tracking-[0.12em]", outcome === "EXECUTED" ? "text-mintx" : outcome === "FAILED" ? "text-red-400" : "text-orangex")}>
              {outcome}
            </span>
          </div>
          <div className="flex items-start justify-between gap-3">
            <span className="text-slate-400">Tx Link</span>
            <div className="max-w-[70%] text-right">
              {txLink ? (
                <a
                  href={txLink}
                  target="_blank"
                  rel="noreferrer"
                  className="break-all font-mono text-xs text-cyanx underline-offset-4 hover:text-mintx hover:underline"
                >
                  {txHash ?? txLink}
                </a>
              ) : (
                <span className="font-mono text-xs text-slate-300">{txHash ?? "not available"}</span>
              )}
            </div>
          </div>
        </div>

        <div className="mt-5 flex justify-end">
          <button
            onClick={onOk}
            className={cx(
              "rounded-xl border px-5 py-3 text-xs font-semibold uppercase tracking-[0.2em] transition",
              outcome === "EXECUTED"
                ? "border-mintx/40 bg-mintx/10 text-mintx hover:bg-mintx/15"
                : outcome === "FAILED"
                  ? "border-red-500/40 bg-red-500/10 text-red-300 hover:bg-red-500/15"
                  : "border-orangex/40 bg-orangex/10 text-orangex hover:bg-orangex/15"
            )}
          >
            OK
          </button>
        </div>
        <div className="mt-4 text-center text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
          Verified by DeterAgent
        </div>
      </div>
    </div>
  );
}

function ActivityTimeline({
  completedStep,
  events,
}: {
  completedStep: number;
  events: Array<{ step: number; label: string; meta: string; icon: React.ElementType; color: string }>;
}) {
  return (
    <Shell className="rounded-2xl p-4">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase">Real-Time Updates</h3>
        <button className="text-xs text-violet-300">View All</button>
      </div>
      {events.length === 0 ? (
        <div className="grid h-[208px] place-items-center rounded-xl border border-dashed border-line bg-white/[0.02] px-4 text-center text-sm text-slate-500">
          Timeline appears after live output arrives from Agent.
        </div>
      ) : (
        <div className="space-y-4">
          {events.map((item, index) => {
            const Icon = item.icon;
            const isLive = completedStep >= item.step;
            return (
              <div key={item.label} className="relative grid grid-cols-[28px_56px_1fr] gap-3">
                {index < events.length - 1 && <span className="absolute left-3.5 top-8 h-8 w-px bg-line" />}
                <span className={cx("z-10 grid h-7 w-7 place-items-center rounded-full border", isLive ? "border-current bg-current/10 " + item.color : "border-slate-700 text-slate-600")}>
                  <Icon className="h-4 w-4" />
                </span>
                <span className="pt-1 text-xs text-slate-500">{""}</span>
                <div>
                  <p className={cx("text-xs font-semibold", isLive ? item.color : "text-slate-500")}>{item.label}</p>
                  <p className="mt-1 text-xs text-slate-400">{item.meta}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <button className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-violetx/30 bg-violetx/10 px-3 py-3 text-xs font-semibold uppercase text-violet-200">
        View Full Activity Log <ChevronRight className="h-4 w-4" />
      </button>
    </Shell>
  );
}
