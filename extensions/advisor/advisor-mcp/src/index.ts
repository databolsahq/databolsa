#!/usr/bin/env bun
/**
 * MCP do DataBolsa Advisor — entry stdio. FINO de propósito: reusa o motor de
 * tools de @databolsa/mcp por import relativo (bundlado no build). Só muda:
 * contrato (/openapi-advisor.json), fallback estático (openapi-advisor.yaml),
 * nome do server e envs.
 *
 *   DATABOLSA_ADVISOR_API_URL     default https://api.databolsa.com
 *   DATABOLSA_ADVISOR_API_KEY     chave pessoal db_live_... (crie em /conta, aba Chaves de API)
 *
 * O workspace vem da CHAVE, fixado quando ela foi emitida — este processo não o escolhe.
 */
import { fileURLToPath } from "node:url";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ApiClient } from "../../../../packages/core/mcp/src/api-client";
import { createServer } from "../../../../packages/core/mcp/src/server";

function staticCandidates(): string[] {
  return [
    // pacote publicado: dist/openapi.yaml (copiado no build, é o contrato ADVISOR)
    fileURLToPath(new URL("./openapi.yaml", import.meta.url)),
    // árvore de fonte: raiz do repo
    fileURLToPath(new URL("../../../../api/openapi-advisor.yaml", import.meta.url)),
  ];
}

const api = new ApiClient({
  baseUrl: process.env.DATABOLSA_ADVISOR_API_URL,
  apiKey: process.env.DATABOLSA_ADVISOR_API_KEY,
  specPath: "/openapi-advisor.json",
});

const { server, toolCount, apiOrigin } = await createServer({
  apiClient: api,
  serverName: "databolsa-advisor",
  staticSpecCandidates: staticCandidates(),
});
await server.connect(new StdioServerTransport());

process.stderr.write(`[databolsa-advisor-mcp] stdio pronto — ${toolCount} tools, API: ${apiOrigin}\n`);
