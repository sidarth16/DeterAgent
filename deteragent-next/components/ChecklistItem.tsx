"use client";

import { AlertTriangle, CheckCircle2, Clock3, XCircle } from "lucide-react";
import type { ChecklistRow } from "@/components/trace-types";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function iconForState(state: ChecklistRow["state"]) {
  if (state === "success") return <CheckCircle2 className="h-4 w-4" />;
  if (state === "failed") return <XCircle className="h-4 w-4" />;
  if (state === "warning") return <AlertTriangle className="h-4 w-4" />;
  return <Clock3 className="h-4 w-4" />;
}

function toneForState(state: ChecklistRow["state"]) {
  if (state === "success") return "text-mintx";
  if (state === "failed") return "text-red-400";
  if (state === "warning") return "text-orangex";
  return "text-slate-500";
}

export default function ChecklistItem({ label, meta, state }: ChecklistRow) {
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 py-1.5">
      <span className={cx("grid h-6 w-6 place-items-center rounded-full", toneForState(state))}>{iconForState(state)}</span>
      <span className="truncate text-sm text-slate-100">{label}</span>
      <span className="truncate text-xs text-slate-400">{meta}</span>
    </div>
  );
}
