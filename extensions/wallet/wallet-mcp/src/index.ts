#!/usr/bin/env bun
/**
 * MCP da Wallet do DataBolsa — entry stdio. FINO de propósito: reusa o motor de tools de
 * @databolsa/mcp por import relativo (bundlado no build). Só muda: contrato
 * (/openapi-wallet.json), fallback estático (openapi-wallet.yaml), nome do server e envs.
 *
 *   DATABOLSA_API_URL     default https://api.databolsa.com
 *   DATABOLSA_API_KEY     chave db_live_... (a mesma da plataforma)
 *   DATABOLSA_WORKSPACE   id da organização em que agir (default: workspace pessoal)
 */
import { fileURLToPath } from "node:url";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ApiClient } from "../../../../packages/core/mcp/src/api-client";
import { createServer } from "../../../../packages/core/mcp/src/server";

function staticCandidates(): string[] {
  return [
    fileURLToPath(new URL("./openapi.yaml", import.meta.url)),
    fileURLToPath(new URL("../../../../api/openapi-wallet.yaml", import.meta.url)),
  ];
}

const workspace = process.env.DATABOLSA_WORKSPACE?.trim();
const api = new ApiClient({
  baseUrl: process.env.DATABOLSA_API_URL,
  apiKey: process.env.DATABOLSA_API_KEY,
  specPath: "/openapi-wallet.json",
  ...(workspace ? { headers: { "x-databolsa-workspace": workspace } } : {}),
});

const { server, toolCount, apiOrigin } = await createServer({
  apiClient: api,
  serverName: "databolsa-wallet",
  staticSpecCandidates: staticCandidates(),
});
await server.connect(new StdioServerTransport());

process.stderr.write(`[databolsa-wallet-mcp] stdio pronto — ${toolCount} tools, API: ${apiOrigin}\n`);
