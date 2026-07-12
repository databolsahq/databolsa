/**
 * Núcleo transport-agnóstico: monta o McpServer e registra uma tool por
 * operação do contrato. `stdio.ts` e `http.ts` apenas escolhem o transporte —
 * a superfície de tools é idêntica nos dois.
 */
import { readFileSync } from "node:fs";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ApiClient } from "./api-client";
import { loadOperations, type Operation } from "./openapi";
import { buildTools } from "./tools";

export const SERVER_NAME = "databolsa";
export const SERVER_VERSION = packageVersion();

export interface CreateServerOptions {
  /** Client pré-construído (credencial por request). Default: env. */
  apiClient?: ApiClient;
}

export interface CreateServerResult {
  server: McpServer;
  toolCount: number;
  apiOrigin: string;
}

/**
 * Cache das operações por origem da API. No transporte HTTP stateless o server
 * é recriado a cada request — sem cache, cada request re-parsearia o contrato.
 * Falha não fica cacheada: a próxima chamada tenta de novo.
 */
const operationsCache = new Map<string, Promise<Operation[]>>();

function cachedOperations(api: ApiClient): Promise<Operation[]> {
  const hit = operationsCache.get(api.origin);
  if (hit) return hit;
  const pending = loadOperations(api).catch((err) => {
    operationsCache.delete(api.origin);
    throw err;
  });
  operationsCache.set(api.origin, pending);
  return pending;
}

export async function createServer(opts: CreateServerOptions = {}): Promise<CreateServerResult> {
  const api =
    opts.apiClient ??
    new ApiClient({
      baseUrl: process.env.DATABOLSA_API_URL,
      apiKey: process.env.DATABOLSA_API_KEY,
    });

  const operations = await cachedOperations(api);
  const tools = buildTools(operations, api);

  const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });
  for (const tool of tools) {
    server.registerTool(tool.name, tool.config, tool.handler);
  }

  return { server, toolCount: tools.length, apiOrigin: api.origin };
}

function packageVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version?: string };
    return pkg.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}
