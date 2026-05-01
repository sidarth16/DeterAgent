import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";

const AGENT_CACHE_PATH = path.resolve(process.cwd(), "..", "logs", "agent_scores.json");

export async function GET() {
  try {
    const raw = await fs.readFile(AGENT_CACHE_PATH, "utf8");
    const payload = JSON.parse(raw) as { agents?: unknown[] };
    if (Array.isArray(payload.agents)) {
      return NextResponse.json({ agents: payload.agents });
    }
  } catch {
    // Fall through to an empty snapshot if the cache has not been created yet.
  }

  return NextResponse.json({ agents: [] });
}
