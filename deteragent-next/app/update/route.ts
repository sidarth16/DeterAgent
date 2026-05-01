import { NextResponse } from "next/server";
import { loadDashboardState, saveDashboardState } from "@/lib/dashboard-store";

const STALE_AFTER_MS = 15000;

function mergePayload(existing: Record<string, unknown>, incoming: Record<string, unknown>) {
  return {
    ...existing,
    ...incoming,
    selected_agent:
      typeof existing.selected_agent === "object" && existing.selected_agent && typeof incoming.selected_agent === "object" && incoming.selected_agent
        ? { ...(existing.selected_agent as Record<string, unknown>), ...(incoming.selected_agent as Record<string, unknown>) }
        : incoming.selected_agent ?? existing.selected_agent,
    keeper:
      typeof existing.keeper === "object" && existing.keeper && typeof incoming.keeper === "object" && incoming.keeper
        ? { ...(existing.keeper as Record<string, unknown>), ...(incoming.keeper as Record<string, unknown>) }
        : incoming.keeper ?? existing.keeper,
  };
}

function appendEvent(existing: Record<string, unknown>, incoming: Record<string, unknown>) {
  const events = Array.isArray(existing.events) ? existing.events : [];
  return [...events, incoming];
}

export async function GET() {
  const payload = await loadDashboardState();

  if (!payload) {
    return new NextResponse(null, { status: 204 });
  }

  const lastRefresh = typeof (payload as { last_refresh?: number }).last_refresh === "number"
    ? (payload as { last_refresh: number }).last_refresh
    : 0;

  if (!lastRefresh || Date.now() - lastRefresh > STALE_AFTER_MS) {
    return new NextResponse(null, { status: 204 });
  }

  return NextResponse.json(payload);
}

export async function POST(request: Request) {
  const incoming = (await request.json()) as Record<string, unknown>;
  const existing = (await loadDashboardState<Record<string, unknown>>()) ?? {};
  const { event, patch, ...rest } = incoming;
  const payload = mergePayload(existing, rest) as Record<string, unknown>;

  if (event && typeof event === "object") {
    payload.events = appendEvent(existing, event as Record<string, unknown>);
  }

  if (patch && typeof patch === "object") {
    Object.assign(payload, patch as Record<string, unknown>);
  }

  payload.last_refresh = Date.now();
  await saveDashboardState(payload);
  return NextResponse.json({ ok: true, payload });
}
