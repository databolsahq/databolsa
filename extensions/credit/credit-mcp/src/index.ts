#!/usr/bin/env bun
/**
 * MCP da mesa de crédito do DataBolsa — entry stdio. FINO de propósito: reusa o motor de
 * tools de @databolsa/mcp por import relativo (bundlado no build). Só muda:
 * contrato (/openapi-credit.json), fallback estático (openapi-credit.yaml),
 * nome do server e envs.
 *
 *   DATABOLSA_CREDIT_API_URL     default https://api.databolsa.com
 *   DATABOLSA_CREDIT_API_KEY     chave pessoal db_live_... (crie em /conta, aba Chaves de API)
 *   DATABOLSA_CREDIT_WORKSPACE   id da organização em que agir (header x-databolsa-workspace)
 */
import { fileURLToPath } from "node:url";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ApiClient } from "../../../../packages/core/mcp/src/api-client";
import { createServer } from "../../../../packages/core/mcp/src/server";

function staticCandidates(): string[] {
  return [
    // pacote publicado: dist/openapi.yaml (copiado no build, é o contrato CREDIT)
    fileURLToPath(new URL("./openapi.yaml", import.meta.url)),
    // árvore de fonte: raiz do repo
    fileURLToPath(new URL("../../../../api/openapi-credit.yaml", import.meta.url)),
  ];
}

const workspace = process.env.DATABOLSA_CREDIT_WORKSPACE?.trim();
const api = new ApiClient({
  baseUrl: process.env.DATABOLSA_CREDIT_API_URL,
  apiKey: process.env.DATABOLSA_CREDIT_API_KEY,
  specPath: "/openapi-credit.json",
  ...(workspace ? { headers: { "x-databolsa-workspace": workspace } } : {}),
});

const { server, toolCount, apiOrigin } = await createServer({
  apiClient: api,
  serverName: "databolsa-credit",
  staticSpecCandidates: staticCandidates(),
});
await server.connect(new StdioServerTransport());

process.stderr.write(`[databolsa-credit-mcp] stdio pronto — ${toolCount} tools, API: ${apiOrigin}\n`);
