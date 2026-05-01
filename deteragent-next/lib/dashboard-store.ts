import { promises as fs } from "fs";
import path from "path";

export const DASHBOARD_STATE_PATH = path.join(process.cwd(), ".deteragent-dashboard.json");

export async function saveDashboardState(payload: unknown) {
  await fs.writeFile(DASHBOARD_STATE_PATH, JSON.stringify(payload, null, 2), "utf8");
}

export async function clearDashboardState() {
  try {
    await fs.unlink(DASHBOARD_STATE_PATH);
  } catch {
    // Ignore missing file.
  }
}

export async function loadDashboardState<T = unknown>(): Promise<T | null> {
  try {
    const raw = await fs.readFile(DASHBOARD_STATE_PATH, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}
