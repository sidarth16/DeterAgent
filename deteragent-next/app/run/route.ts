import path from "path";
import { spawn } from "child_process";
import { NextResponse } from "next/server";
import { clearDashboardState, saveDashboardState } from "@/lib/dashboard-store";

const pythonBin = process.env.PYTHON_BIN || "python3";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { task?: string; urls?: string[] };
  const task = body.task?.trim() || "When was Uniswap launched and who created it?";
  const repoRoot = path.resolve(process.cwd(), "..");

  await clearDashboardState();
  await saveDashboardState({
    task,
    task_id: null,
    events: [],
    keeper_status: "PENDING",
    agents: [],
    trace_steps: [],
    trust_score: 0,
    hallucination_score: 0,
    relevance_score: 0,
    proof_hash: "pending",
    process_state: "running",
    last_refresh: Date.now(),
  });

  const child = spawn(pythonBin, ["main.py", task], {
    cwd: repoRoot,
    env: {
      ...process.env,
      TASK: task,
      PYTHONUNBUFFERED: "1",
    },
    stdio: ["ignore", "inherit", "inherit"],
    detached: false,
  });

  child.on("error", async (error) => {
    await saveDashboardState({
      task,
      task_id: null,
      events: [
        {
          time: new Date().toLocaleTimeString(),
          category: "EXEC",
          line: `Failed to start agent: ${String(error.message || error)}`,
        },
      ],
      keeper_status: "FAILED",
      agents: [],
      trace_steps: [],
      trust_score: 0,
      hallucination_score: 0,
      relevance_score: 0,
      proof_hash: "pending",
      process_state: "failed",
      last_refresh: Date.now(),
    });
  });

  return NextResponse.json({ ok: true, pid: child.pid });
}
