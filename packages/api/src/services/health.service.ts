import { VERSION } from "../lib/config";
import { freshnessRepo } from "../repositories/freshness.repo";

export const healthService = {
  async status() {
    let dataFreshness: Record<string, string> = {};
    let status: "ok" | "degraded" = "ok";
    try {
      dataFreshness = await freshnessRepo.dataFreshness();
    } catch (err) {
      console.error("[databolsa-api] health check failed:", err);
      status = "degraded";
    }
    return { status, version: VERSION, data_freshness: dataFreshness };
  },
};
