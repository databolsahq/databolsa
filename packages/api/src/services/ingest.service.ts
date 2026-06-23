import { ingestRepo, type RunRecord, type SourceHealthRaw, type SourceRollup } from "../repositories/ingest.repo";

// Heurística de debug; o frescor "certo" é por-fonte (max_age no connector).
const STALE_DAYS = 7;

export type SourceStatus = "ok" | "stale" | "error" | "no_data";

function ageDays(lastFetch: string | null): number | null {
  if (!lastFetch) return null;
  const ms = Date.now() - new Date(lastFetch).getTime();
  if (Number.isNaN(ms)) return null;
  return Math.floor(ms / 86_400_000);
}

function sourceStatus(h: SourceHealthRaw | undefined, r: SourceRollup | undefined, age: number | null): SourceStatus {
  if (r?.fatal || (r?.err ?? 0) > 0 || (h?.failed_validation ?? 0) > 0) return "error";
  if (age === null) return "no_data";
  if (age > STALE_DAYS) return "stale";
  return "ok";
}

function runSummary(r: RunRecord) {
  return {
    run_id: r.run_id,
    trigger: r.trigger,
    started_at: r.started_at,
    finished_at: r.finished_at,
    duration_s: r.duration_s,
    exit: r.exit,
    ok: r.exit === 0,
    error_count: r.errors?.length ?? 0,
  };
}

export const ingestService = {
  // Última execução + saúde por fonte (frescor recalculado AGORA a partir do
  // last_fetch absoluto gravado na run) + histórico recente. Um arquivo do lake
  // por run; nada de Postgres. Endpoint isento de cache (ver middleware/cache.ts)
  // porque a versão do cache só vira no reload do Postgres, não em novas runs.
  async health() {
    const [latest, recent] = await Promise.all([ingestRepo.latest(), ingestRepo.recent(20)]);
    if (!latest) {
      return { latest: null, sources: [], recent_runs: [] };
    }
    const names = Array.from(
      new Set([...Object.keys(latest.health ?? {}), ...Object.keys(latest.sources ?? {})]),
    ).sort();

    const sources = names.map((source) => {
      const h = latest.health?.[source];
      const r = latest.sources?.[source];
      const last_fetch = h?.last_fetch ?? null;
      const age = ageDays(last_fetch);
      return {
        source,
        status: sourceStatus(h, r, age),
        last_fetch,
        age_days: age,
        datasets: h?.datasets ?? r?.datasets ?? 0,
        missing: h?.missing ?? 0,
        failed_validation: h?.failed_validation ?? 0,
        // Rollup da ÚLTIMA run (0 quando a fonte não participou dela).
        ok: r?.ok ?? 0,
        skip: r?.skip ?? 0,
        miss: r?.miss ?? 0,
        err: r?.err ?? 0,
        rows: r?.rows ?? 0,
        duration_s: r?.duration_s ?? null,
      };
    });

    return {
      latest: { ...runSummary(latest), errors: latest.errors ?? [] },
      sources,
      recent_runs: recent.map(runSummary),
    };
  },
};
