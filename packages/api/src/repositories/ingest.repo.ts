import { desc } from "drizzle-orm";
import { db, ingestRuns } from "@databolsa/db";

// A saúde do ingest vive fora do warehouse — um manifesto JSON por execução
// (formato RunLedger, escrito por `databolsa-ingest run`). Antes era lido do
// filesystem (data/_runs/run-*.json), inalcançável pela API num cluster. Agora o
// loader (scripts/load_postgres.py) espelha cada manifesto na tabela ingest_runs e
// a API lê do Postgres — qualquer pod alcança, sem volume compartilhado.

export interface SourceRollup {
  ok: number;
  skip: number;
  miss: number;
  err: number;
  rows: number;
  datasets: number;
  duration_s?: number;
  fatal?: string;
}

export interface SourceHealthRaw {
  last_fetch: string | null;
  age_days: number | null; // gravado na run; o serviço recalcula no request
  datasets: number;
  missing: number;
  failed_validation: number;
}

export interface RunRecord {
  run_id: string;
  trigger: string;
  requested: string;
  force: boolean;
  started_at: string;
  finished_at: string;
  duration_s: number;
  exit: number;
  sources: Record<string, SourceRollup>;
  errors: string[];
  health: Record<string, SourceHealthRaw>;
}

function parse(manifest: string): RunRecord | null {
  try {
    return JSON.parse(manifest) as RunRecord;
  } catch {
    // Manifesto corrompido/parcial não derruba o endpoint — apenas é ignorado.
    return null;
  }
}

async function recentManifests(n: number): Promise<RunRecord[]> {
  const rows = await db
    .select({ manifest: ingestRuns.manifest })
    .from(ingestRuns)
    .orderBy(desc(ingestRuns.startedAt))
    .limit(n);
  return rows.map((r) => parse(r.manifest)).filter((r): r is RunRecord => r !== null);
}

export const ingestRepo = {
  async latest(): Promise<RunRecord | null> {
    const [rec] = await recentManifests(1);
    return rec ?? null;
  },

  async recent(n: number): Promise<RunRecord[]> {
    return recentManifests(n);
  },
};
