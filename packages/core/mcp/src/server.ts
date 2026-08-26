/**
 * Núcleo transport-agnóstico: monta o McpServer e registra uma tool por
 * operação do contrato. `stdio.ts` e `http.ts` apenas escolhem o transporte —
 * a superfície de tools é idêntica nos dois.
 */
import { readFileSync } from "node:fs";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ApiClient } from "./api-client";
import { loadSpecContext, type Operation, type SpecContext } from "./openapi";
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
  /**
   * PERFIL da sessão — um nome de `x-profiles` do contrato (ex.: `context`, `market`).
   * A sessão só expõe as operações cujas capacidades (`x-capability`) o perfil inclui.
   * Default: env `DATABOLSA_MCP_PROFILE`; ausente = superfície completa, como sempre foi.
   * Perfil desconhecido é ERRO com a lista dos válidos — não degrada para zero tools.
   */
  profile?: string;
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

/**
 * APLICA O PERFIL, quando há um. Exportada porque o guarda tem de poder falhar em teste.
 *
 * Três recusas deliberadas, todas ERRO e nunca degradação silenciosa:
 * - perfil pedido num spec sem `x-profiles` (contrato antigo, ou o do Advisor);
 * - perfil que o spec não declara (typo devolveria zero tools com cara de "não há operações");
 * - perfil cujo filtro devolve zero operações (spec e perfis divergiram — contrato quebrado).
 *
 * `full` continua passando por aqui: é um perfil declarado como os outros, e tratá-lo como
 * caso especial criaria o segundo caminho que uma das duas listas esquece.
 */
export function aplicarPerfil(
  operations: Operation[],
  profiles: SpecContext["profiles"],
  profile: string | undefined,
): { visiveis: Operation[]; notaDePerfil?: string } {
  if (!profile) return { visiveis: operations };
  const def = profiles?.[profile];
  if (!def) {
    const validos = Object.keys(profiles ?? {});
    throw new Error(
      validos.length
        ? `perfil "${profile}" não existe neste contrato. Válidos: ${validos.join(", ")}.`
        : `o contrato carregado não declara perfis (\`x-profiles\`) — atualize a API/spec ou remova DATABOLSA_MCP_PROFILE.`,
    );
  }
  const capacidades = new Set(def.capabilities);
  const visiveis = operations.filter((op) => op.capability !== undefined && capacidades.has(op.capability));
  if (visiveis.length === 0) {
    throw new Error(`perfil "${profile}" filtrou TODAS as ${operations.length} operações — spec e perfis divergem; contrato quebrado.`);
  }
  return {
    visiveis,
    notaDePerfil:
      `PERFIL ATIVO: ${profile} — ${visiveis.length} de ${operations.length} operações do contrato ` +
      `(capacidades: ${def.capabilities.join(", ")}). ${def.description ?? ""} ` +
      `A superfície completa existe e está fora desta sessão de propósito; se uma pergunta ` +
      `precisar dela, diga isso ao usuário em vez de responder que o dado não existe.`,
  };
}

export async function createServer(opts: CreateServerOptions = {}): Promise<CreateServerResult> {
  const api =
    opts.apiClient ??
    new ApiClient({
      baseUrl: process.env.DATABOLSA_API_URL,
      apiKey: process.env.DATABOLSA_API_KEY,
    });

  const { operations, profiles, instructionsFor } = await cachedOperations(api, opts.staticSpecCandidates);
  const { visiveis, notaDePerfil } = aplicarPerfil(operations, profiles, opts.profile ?? process.env.DATABOLSA_MCP_PROFILE);
  const tools = buildTools(visiveis, api);
  // O digest dentro das instruções é recortado pelas tools que este server EXPÕE — um perfil
  // sem o grafo não carrega o vocabulário do grafo no texto que o cliente lê antes de tudo.
  const instructions = instructionsFor(visiveis.map((op) => op.operationId));

  // `instructions` é o único texto que o cliente MCP lê ANTES de escolher uma tool. Sem ele
  // o agente via 131 nomes planos em camelCase e nada dizendo o que o servidor cobre — a CLI
  // tinha índice navegável (`databolsa --list`) e a IA, que é quem mais precisa, não tinha.
  const server = new McpServer(
    { name: opts.serverName ?? SERVER_NAME, version: SERVER_VERSION },
    { instructions: notaDePerfil ? `${notaDePerfil}\n\n${instructions}` : instructions },
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
