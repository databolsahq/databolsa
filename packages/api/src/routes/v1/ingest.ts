import { Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { ingestHealth } from "@databolsa/contract";
import { ingestService } from "../../services/ingest.service";
import { ok } from "../../lib/openapi";

// Saúde do ingest: última run + saúde por fonte + histórico recente, lidos do
// ledger no data lake (data/_runs/). Endpoint vivo (sem cache Redis).
export const ingest = new Hono().get(
  "/",
  describeRoute({
    tags: ["System"],
    operationId: "getIngestHealth",
    summary: "Saúde da ingestão (última run, fontes, histórico)",
    responses: ok(ingestHealth, "Saúde da ingestão"),
  }),
  async (c) => c.json(await ingestService.health()),
);
