import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";

const AGENT_CACHE_PATH = path.resolve(process.cwd(), "..", "logs", "agent_scores.json");
const DEFAULT_AGENTS = [
  "agentx01.deteragent.eth",
  "agentx02.deteragent.eth",
  "agentx03.deteragent.eth",
];

export async function GET() {
  try {
    const raw = await fs.readFile(AGENT_CACHE_PATH, "utf8");
    const payload = JSON.parse(raw) as { agents?: unknown[] };
    if (Array.isArray(payload.agents)) {
      const cachedAgents = payload.agents.filter(
        (agent): agent is Record<string, unknown> => Boolean(agent) && typeof agent === "object" && typeof (agent as Record<string, unknown>).name === "string"
      );
      const cacheByName = new Map(
        cachedAgents.map((agent) => [String(agent.name), agent])
      );

      const agents = DEFAULT_AGENTS.map((name) => {
        const cached = cacheByName.get(name);
        return cached
          ? cached
          : {
              name,
              trust_score: 0,
              total_checks: 0,
              agent_type: "specialist",
            };
      });

      return NextResponse.json({ agents });
    }
  } catch {
    // Fall through to an empty snapshot if the cache has not been created yet.
  }

  return NextResponse.json({
    agents: DEFAULT_AGENTS.map((name) => ({
      name,
      trust_score: 0,
      total_checks: 0,
      agent_type: "specialist",
    })),
  });
}
