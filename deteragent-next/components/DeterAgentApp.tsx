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
  Sparkles,
  Users,
  Zap,
} from "lucide-react";
import type React from "react";
import { useEffect, useRef, useState } from "react";

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

type SidebarAgent = {
  name: string;
  score: number;
  status: string;
  color: string;
  active: boolean;
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
      transactionHash?: string;
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
  const [keeperState, setKeeperState] = useState<KeeperState>("IDLE");
  const [dashboardData, setDashboardData] = useState<DashboardPayload | null>(null);
  const [chainAgents, setChainAgents] = useState<DashboardAgent[]>([]);

  useEffect(() => {
    let isMounted = true;

    async function syncDashboard() {
      try {
        const response = await fetch("/update", { cache: "no-store" });
        if (response.status === 204 || !response.ok) return;

        const payload = (await response.json()) as DashboardPayload;
        if (isMounted) {
          setDashboardData(payload);
          if (payload.events?.length) {
            setVisibleLogs(toEventLines(payload));
          }
          const txHash = payload.keeper?.workflow_result?.tx_hash ?? payload.keeper?.workflow_result?.transactionHash;
          const keeperSuccess = payload.keeper_success === true || payload.keeper_status === "EXECUTED" || payload.keeper?.status === "EXECUTED";
          const status = payload.keeper?.status || payload.keeper_status;

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
    setKeeperState("READY TO EXECUTE");

    void fetch("/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        task: task || dashboardData?.task || "When was Uniswap launched and who created it?",
      }),
    }).catch(() => {
      setVisibleLogs([{ time: "", tag: "TRUST", message: "Failed to start main.py from the UI." }]);
      setRunning(false);
    });
  }

  return (
    <main className="min-h-screen p-4 text-slate-100 lg:p-6">
      <div className="grid min-h-[calc(100vh-32px)] grid-cols-1 gap-4 xl:grid-cols-[270px_minmax(720px,1fr)_330px]">
        <Sidebar agents={chainAgents.length ? chainAgents : dashboardData?.agents ?? []} />

        <section className="min-w-0 space-y-4">
          <TopInputBar task={dashboardData?.task ?? task} setTask={setTask} runAgent={runAgent} running={running} />
          <LiveRunHeader
            currentStep={dashboardData?.current_step}
            currentCategory={dashboardData?.current_category}
            currentState={dashboardData?.current_step_state}
          />
          <LogPanel title="Live Traceback Output" logs={visibleLogs} running={running} />

          <div className="grid gap-4 lg:grid-cols-[1fr_0.78fr]">
            <AgentAnswerCard completedStep={dashboardData?.task_id ? 1 : -1} response={dashboardData?.response} />
            <KeeperHubStatusCard state={keeperState} completedStep={dashboardData?.task_id ? 1 : -1} />
          </div>
        </section>

        <RightPanel
          trustScore={dashboardData?.trust_score ?? 0}
          completedStep={dashboardData?.task_id ? 1 : -1}
          decision={dashboardData?.keeper_status ?? "PENDING"}
          txHash={dashboardData?.keeper?.workflow_result?.tx_hash ?? dashboardData?.keeper?.workflow_result?.transactionHash ?? "pending"}
          proofHash={dashboardData?.proof_hash ?? "pending"}
          selectedAgent={dashboardData?.selected_agent?.name ?? "Awaiting selection"}
          hallucinationScore={dashboardData?.hallucination_score}
          relevanceScore={dashboardData?.relevance_score}
          ensBefore={dashboardData?.ens_before}
          ensAfter={dashboardData?.ens_after}
          activityEvents={buildActivityEvents(dashboardData?.trace_steps)}
        />
      </div>
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
    { label: "Executions", icon: Play },
    { label: "Proofs", icon: ShieldCheck },
    { label: "Analytics", icon: BarChart3 },
    { label: "Settings", icon: Settings },
  ];

  return (
    <Shell className="flex min-h-[calc(100vh-32px)] flex-col rounded-2xl p-4">
      <div className="mb-6 flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-xl border border-violetx/50 bg-violetx/15 shadow-glow">
          <ShieldCheck className="h-6 w-6 text-violetx" />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold">DeterAgent</h1>
          <p className="text-xs leading-5 text-slate-400">Trust & Execution Layer<br />for AI Agents</p>
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
          Waiting for live agent selection from `main.py`.
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
        {["0G Storage", "ENS Service", "KeeperHub", "Blockchain"].map((item) => (
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
      <div className="mb-2 text-xs font-semibold uppercase text-violet-300">User Input / Task</div>
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
            {running ? "Waiting for live output from `main.py`." : "No active run. Start `main.py` to stream logs."}
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
        <p className="text-sm leading-6 text-slate-300">
          {response || "Waiting for live response from `main.py`."}
        </p>
      </div>
    </Shell>
  );
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
            {currentStep ? `${currentStep} · ${currentCategory === "EXEC" ? "KeeperHub" : currentCategory}` : "Waiting for `main.py`."}
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
function KeeperHubStatusCard({ state, completedStep }: { state: KeeperState; completedStep: number }) {
  const isSuccess = state === "SUCCESS";
  const isExecuting = state === "EXECUTING";
  const isFailed = state === "FAILED";
  const isIdle = state === "IDLE";
  return (
    <Shell className={cx("rounded-2xl p-4", isSuccess ? "border-mintx/50" : isFailed ? "border-red-500/50" : "border-line")}>
      <h3 className="mb-3 text-sm font-semibold uppercase text-violet-200">4. KeeperHub Status</h3>
      <div className={cx("flex items-center gap-4 rounded-xl border p-4", isFailed ? "border-red-500/40 bg-red-500/10" : "border-mintx/40 bg-mintx/10")}>
        <span className={cx("grid h-11 w-11 place-items-center rounded-full", isExecuting ? "animate-pulse bg-orangex/20 text-orangex" : "bg-mintx/20 text-mintx")}>
          {isExecuting ? <Radio className="h-5 w-5" /> : <BrainCircuit className="h-5 w-5" />}
        </span>
        <div>
          <p className={cx(
            "text-sm font-semibold uppercase",
            isIdle
              ? "text-slate-500"
              : isExecuting
              ? "text-orangex"
              : isFailed
              ? "text-red-400"
              : "text-mintx"
          )}>
            Status: {isIdle ? "--" : state}
          </p>
          <p className="mt-1 text-xs text-slate-300">
          {isIdle
            ? "Waiting for agent run to reach KeeperHub."
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
  trustScore,
  completedStep,
  decision,
  txHash,
  proofHash,
  selectedAgent,
  hallucinationScore,
  relevanceScore,
  ensBefore,
  ensAfter,
  activityEvents,
}: {
  trustScore: number;
  completedStep: number;
  decision: string;
  txHash: string;
  proofHash: string;
  selectedAgent: string;
  hallucinationScore?: number;
  relevanceScore?: number;
  ensBefore?: number;
  ensAfter?: number;
  activityEvents: Array<{ step: number; label: string; meta: string; icon: React.ElementType; color: string }>;
}) {
  return (
    <aside className="space-y-4">
      <Shell className="rounded-2xl p-4">
        <div className="flex items-center justify-center gap-3 py-2 text-xs font-semibold uppercase text-mintx">
          <span className="h-2 w-2 rounded-full bg-mintx" /> Live on 0G
          <Sparkles className="h-3 w-3" /> ENS
          <Sparkles className="h-3 w-3" /> KeeperHub
        </div>
      </Shell>

      <TrustScoreWidget
        score={trustScore}
        completedStep={completedStep}
        hallucinationScore={hallucinationScore}
        relevanceScore={relevanceScore}
        ensBefore={ensBefore}
        ensAfter={ensAfter}
      />
      <ExecutionSummary
        agentName={selectedAgent}
        decision={decision}
        txHash={txHash}
        proofHash={proofHash}
      />
      <ActivityTimeline completedStep={completedStep} events={activityEvents} />
    </aside>
  );
}

function TrustScoreWidget({
  score,
  completedStep,
  hallucinationScore,
  relevanceScore,
  ensBefore,
  ensAfter,
}: {
  score: number;
  completedStep: number;
  hallucinationScore?: number;
  relevanceScore?: number;
  ensBefore?: number;
  ensAfter?: number;
}) {
  const deg = (score / 100) * 360;
  const delta = typeof ensBefore === "number" && typeof ensAfter === "number" ? ensAfter - ensBefore : completedStep >= 4 ? 4 : 0;
  return (
    <Shell className="rounded-2xl p-4">
      <h3 className="mb-4 text-sm font-semibold uppercase">Trust Score</h3>
      <div className="grid grid-cols-[1fr_0.9fr] items-center gap-4">
        <div
          className="grid aspect-square place-items-center rounded-full"
          style={{ background: score > 0 ? `conic-gradient(#34f5a4 ${deg}deg, rgba(255,255,255,0.08) 0deg)` : "rgba(255,255,255,0.04)" }}
        >
          <div className="grid h-[78%] w-[78%] place-items-center rounded-full bg-[#07111f]">
            <div className="text-center">
              <div className="text-5xl font-extrabold text-mintx">{score || "--"}</div>
              <div className="text-sm text-mintx">/100</div>
              <div className="mt-1 text-sm text-mintx">{score > 0 ? "Live" : "Waiting"}</div>
            </div>
          </div>
        </div>
        <div className="space-y-5">
          <div>
            <div className="text-2xl font-bold text-mintx">{score > 0 ? `${delta >= 0 ? "+" : ""}${delta} up` : "--"}</div>
            <p className="text-xs text-slate-400">Trust Increase</p>
          </div>
          <div className="text-xs text-slate-400">
            Last Updated
            <br />
            <span className="text-white">{score > 0 ? "just now" : "pending"}</span>
          </div>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-3 divide-x divide-line border-t border-line pt-4 text-center">
        <Metric value={typeof hallucinationScore === "number" ? String(hallucinationScore) : "--"} label="Hallucination" />
        <Metric value={typeof relevanceScore === "number" ? String(relevanceScore) : "--"} label="Relevance" />
        <Metric value={typeof score === "number" ? String(score) : "--"} label="Source Quality" />
      </div>
    </Shell>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="text-2xl font-semibold text-white">{value}</div>
      <div className="mt-1 text-xs text-slate-400">{label}</div>
    </div>
  );
}

function ExecutionSummary({
  agentName,
  decision,
  txHash,
  proofHash,
}: {
  agentName: string;
  decision: string;
  txHash: string;
  proofHash: string;
}) {
  const rows = [
    ["Agent", agentName, BrainCircuit],
    ["Decision", decision, ShieldCheck],
    ["Executed By", "KeeperHub", Bot],
    ["Tx Hash", txHash, Network],
    ["Proof (0G)", proofHash, FileCheck2],
    ["Time", "Live", Activity],
  ] as const;
  return (
    <Shell className="rounded-2xl p-4">
      <h3 className="mb-3 text-sm font-semibold uppercase">Execution Summary</h3>
      <div className="divide-y divide-line">
        {rows.map(([label, value, Icon]) => (
          <div key={label} className="grid grid-cols-[20px_1fr_auto] items-center gap-2 py-3 text-sm">
            <Icon className="h-4 w-4 text-slate-400" />
            <span className="text-slate-400">{label}</span>
            <span
              className={cx(
                "text-right",
                label === "Decision" ? "text-mintx" : label === "Tx Hash" ? "text-cyanx" : "text-violet-300"
              )}
            >
              {value}
            </span>
          </div>
        ))}
      </div>
    </Shell>
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
          Timeline appears after live output arrives from `main.py`.
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
