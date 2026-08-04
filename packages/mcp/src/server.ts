/**
 * Núcleo transport-agnóstico: monta o McpServer e registra uma tool por
 * operação do contrato. `stdio.ts` e `http.ts` apenas escolhem o transporte —
 * a superfície de tools é idêntica nos dois.
 */
import { readFileSync } from "node:fs";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ApiClient } from "./api-client";
import { loadSpecContext, type SpecContext } from "./openapi";
import { buildTools } from "./tools";

export const SERVER_NAME = "databolsa";
export const SERVER_VERSION = packageVersion();

export interface CreateServerOptions {
  /** Client pré-construído (credencial por request). Default: env. */
  apiClient?: ApiClient;
  /** Nome anunciado do server MCP (default: "databolsa"; advisor: "databolsa-advisor"). */
  serverName?: string;
  /** Fallback estático de spec próprio (repassa ao loadOperations). */
  staticSpecCandidates?: string[];
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
const operationsCache = new Map<string, Promise<SpecContext>>();

function cachedOperations(api: ApiClient, staticCandidates?: string[]): Promise<SpecContext> {
  // Chave inclui o specPath: core e advisor podem viver na MESMA origem
  // (api.databolsa.com) servindo contratos diferentes.
  const key = `${api.origin}${api.specPath}`;
  const hit = operationsCache.get(key);
  if (hit) return hit;
  const pending = loadSpecContext(api, { staticCandidates }).catch((err) => {
    operationsCache.delete(key);
    throw err;
  });
  operationsCache.set(key, pending);
  return pending;
}

export async function createServer(opts: CreateServerOptions = {}): Promise<CreateServerResult> {
  const api =
    opts.apiClient ??
    new ApiClient({
      baseUrl: process.env.DATABOLSA_API_URL,
      apiKey: process.env.DATABOLSA_API_KEY,
    });

  const { operations, instructions } = await cachedOperations(api, opts.staticSpecCandidates);
  const tools = buildTools(operations, api);

  // `instructions` é o único texto que o cliente MCP lê ANTES de escolher uma tool. Sem ele
  // o agente via 131 nomes planos em camelCase e nada dizendo o que o servidor cobre — a CLI
  // tinha índice navegável (`databolsa --list`) e a IA, que é quem mais precisa, não tinha.
  const server = new McpServer(
    { name: opts.serverName ?? SERVER_NAME, version: SERVER_VERSION },
    { instructions },
  );
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
