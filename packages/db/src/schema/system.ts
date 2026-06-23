import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core";

// System/operational tables — não são mirror de mart, mas estado de serving que a API
// precisa alcançar de qualquer pod (cluster distribuído). A saúde do ingest morava em
// data/_runs/run-*.json (filesystem), inalcançável pela API num cluster — agora o loader
// (scripts/load_postgres.py) espelha cada manifesto aqui e a API lê do Postgres.

// Um registro por execução do ingest. `manifest` guarda o JSON cru do run-<id>.json
// (formato RunLedger), e a API faz JSON.parse + recalcula idades no request. run_id e
// started_at ficam em colunas próprias só p/ ordenar/filtrar.
export const ingestRuns = pgTable(
  "ingest_runs",
  {
    runId: text("run_id").primaryKey(),
    startedAt: timestamp("started_at", { withTimezone: true, mode: "string" }),
    manifest: text("manifest").notNull(),
  },
  (t) => [index("ingest_runs_started_idx").on(t.startedAt)],
);
