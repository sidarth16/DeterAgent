"use client";

import type { ElementType } from "react";
import PhaseCard from "@/components/PhaseCard";
import type { ChecklistRow, TraceLog, TracePhaseKey, TraceStatus } from "@/components/trace-types";

function firstMatch(liveLogs: TraceLog[], pattern: RegExp) {
  return liveLogs.find((log) => pattern.test(log.message))?.message ?? "";
}

type PhaseMetrics = {
  selectedAgent?: string;
  agentCount?: number;
  sourceCount?: number;
  flaggedCount?: number;
  trustScore?: number;
  relevanceScore?: number;
  hallucinationScore?: number;
  ensBefore?: number;
  ensAfter?: number;
};

function formatScore(value?: number) {
  if (typeof value !== "number" || Number.isNaN(value)) return null;
  return `${value}/100`;
}

function checklistForPhase(
  phase: TracePhaseKey,
  summary: string,
  liveLogs: TraceLog[],
  status: TraceStatus,
  metrics?: PhaseMetrics
): ChecklistRow[] {
  const count = metrics?.sourceCount ?? Number(summary.match(/\d+/)?.[0] ?? firstMatch(liveLogs, /\d+/).match(/\d+/)?.[0] ?? "");
  const rawTrustScore = metrics?.trustScore ?? Number(firstMatch(liveLogs, /trust score/i).match(/(\d+)/)?.[1] ?? summary.match(/(\d+)/)?.[1] ?? 0);
  const trustScore = Number.isFinite(rawTrustScore) ? rawTrustScore : 0;
  const trust = `${trustScore || 0}/100`;
  const ensChange =
    metrics?.ensBefore !== undefined && metrics?.ensAfter !== undefined
      ? `${metrics.ensBefore} → ${metrics.ensAfter}`
      : summary.includes("→")
        ? summary
        : firstMatch(liveLogs, /\d+\s*→\s*\d+/);
  const selectedAgent = metrics?.selectedAgent || firstMatch(liveLogs, /selected\s+[^.]+/i) || summary.replace(/^Selected\s+/i, "") || "agentx02";
  const sourceCount = count ? `${count} sources` : "3 sources";
  const blocked = /prevented|blocked|failed/i.test(summary) || liveLogs.some((log) => /prevented|blocked|failed/i.test(log.message));
  const issueCount = metrics?.flaggedCount ?? Number(summary.match(/(\d+)\s+issues?/i)?.[1] ?? 0);
  const issues = `${issueCount || 0} issues`;
  const hallucinationCount = typeof metrics?.hallucinationScore === "number" ? metrics.hallucinationScore : issueCount;
  const groundingMeta = `${hallucinationCount || 0} flagged`;
  const trustMeta = formatScore(trustScore) ?? trust;
  const relevanceMeta = formatScore(metrics?.relevanceScore ?? (status === "failed" ? 0 : trustScore || 100)) ?? trust;
  const trustedVerdict = (trustScore || 0) >= 80 && (metrics?.flaggedCount ?? issueCount) === 0 && status !== "failed";

  if (phase === "agent") {
    return [
      { label: "Read ENS scores", meta: `${metrics?.agentCount ?? 4} agents`, state: "success" },
      { label: "Rank agents", meta: "by trust", state: "success" },
      { label: "Select agent", meta: selectedAgent, state: "success" },
    ];
  }

  if (phase === "research") {
    return [
      { label: "Fetch URLs", meta: sourceCount, state: "success" },
      // { label: "Validate sources", meta: "optional", state: "success" },
      { label: "Upload proof", meta: firstMatch(liveLogs, /0x[a-fA-F0-9]+/i) || "0G", state: "success" },
      { label: "Generate response", meta: "done", state: "success" },
    ];
  }

  if (phase === "verify") {
    return [
      { label: "Grounding check", meta: issues, state: issueCount > 0 ? "warning" : "success" },
      // { label: "Grounding scan", meta: groundingMeta, state: issueCount > 0 ? "warning" : "success" },
      { label: "Relevance check", meta: relevanceMeta, state: status === "failed" ? "failed" : "success" },
      { label: "Compute trust", meta: trustMeta, state: status === "failed" ? "failed" : "success" },
      { label: "Trust verdict", meta: trustedVerdict ? "TRUSTED" : "UNTRUSTED", state: trustedVerdict ? "success" : "failed" },
    ];
  }

  if (phase === "execute") {
    const txHashIssue = /failed to retrieve txhash|tx hash unavailable|txhash unavailable/i.test(summary) || liveLogs.some((log) =>
      /failed to retrieve txhash|tx hash unavailable|txhash unavailable/i.test(log.message)
    );
    const keeperFailed = /keeperhub workflow: failed|execution failed/i.test(summary) || liveLogs.some((log) =>
      /keeperhub workflow: failed|execution failed/i.test(log.message)
    );
    return [
      { label: "Evaluate trust gate", meta: blocked ? "blocked" : "allowed", state: blocked ? "warning" : "success" },
      { label: "Prepare execution", meta: blocked ? "skipped" : "ready", state: blocked ? "warning" : "success" },
      { label: "Trigger KeeperHub", meta: blocked ? "skipped" : keeperFailed ? "failed" : "success", state: blocked || keeperFailed ? "warning" : "success" },
      { label: "Confirm execution", meta: txHashIssue ? "tx hash unavailable" : "completed", state: keeperFailed ? "warning" : txHashIssue ? "warning" : "success" },
    ];
  }

  return [
    { label: "Compute delta", meta: ensChange || "63 → 54", state: "success" },
    { label: "Update ENS score", meta: `${metrics?.ensAfter ?? "updated"}`, state: "success" },
    { label: "Store proof", meta: firstMatch(liveLogs, /0x[a-fA-F0-9]+/i) || "0xabc...", state: "success" },
    { label: "Confirm update", meta: "success", state: "success" },
  ];
}

export interface TracePhaseProps {
  phase: TracePhaseKey;
  initial?: boolean;
  title: string;
  summary: string;
  status: TraceStatus;
  expanded: boolean;
  active: boolean;
  completed?: boolean;
  icon: ElementType;
  highlights: string[];
  liveLogs: TraceLog[];
  highlighted?: boolean;
  badge?: string;
  currentLine?: string;
  metrics?: PhaseMetrics;
  onToggle: () => void;
}

export default function TracePhase({
  phase,
  initial = false,
  title,
  summary,
  status,
  expanded,
  active,
  completed = false,
  icon,
  highlights,
  liveLogs,
  highlighted = false,
  badge,
  currentLine,
  metrics,
  onToggle,
}: TracePhaseProps) {
  const checklist = checklistForPhase(phase, summary, liveLogs, status, metrics);

  return (
    <PhaseCard
      title={title.toUpperCase()}
      initial={initial}
      summary={summary}
      status={status}
      expanded={expanded}
      active={active}
      completed={completed}
      icon={icon}
      badge={badge}
      checklist={checklist}
      logs={liveLogs}
      currentLine={currentLine}
      highlighted={highlighted}
      phase={phase}
      metrics={metrics}
      onToggle={onToggle}
    />
  );
}
