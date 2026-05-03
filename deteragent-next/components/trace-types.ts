"use client";

export type TracePhaseKey = "agent" | "research" | "verify" | "execute" | "enforce";

export type TraceStatus = "success" | "warning" | "failed";

export type TraceLog = {
  time?: string;
  tag?: string;
  message: string;
  step?: string;
  state?: string;
};

export type ChecklistState = "success" | "warning" | "failed" | "pending";

export type ChecklistRow = {
  label: string;
  meta: string;
  state: ChecklistState;
};

export type LogGroup = {
  heading: string;
  logs: TraceLog[];
};
