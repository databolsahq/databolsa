/**
 * Núcleo transport-agnóstico: monta o McpServer e registra uma tool por
 * operação do contrato. `stdio.ts` e `http.ts` apenas escolhem o transporte —
 * a superfície de tools é idêntica nos dois.
 */
import { readFileSync } from "node:fs";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ApiClient } from "./api-client";
import { buildObjectFunctionTool, sessaoComGrafo } from "./object-function-tool";
import { loadSpecContext, type Operation, type SpecContext } from "./openapi";
import { buildTools, type ToolCallHook, type ToolDef } from "./tools";

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
   * PERFIL da sessão — um nome de `x-profiles` do contrato (`default`, `full`).
   * A sessão só expõe as operações cujas capacidades (`x-capability`) o perfil inclui E cujo
   * lifecycle (`x-lifecycle`) o perfil aceita. Default: env `DATABOLSA_MCP_PROFILE`; ausente
   * = `default` quando o contrato declara perfis (a superfície inicial curada; `full` é escolha
   * explícita). Contrato sem `x-profiles` (o de uma extensão) segue inteiro.
   * Perfil desconhecido é ERRO com a lista dos válidos — não degrada para zero tools.
   */
  profile?: string;
  /**
   * ADMISSÃO POR SESSÃO, além do perfil: operações que o perfil deixou de fora pela CAPACIDADE e
   * que o host libera porque a sessão tem credencial, instalação ou consentimento. Nunca readmite
   * o que saiu pelo LIFECYCLE — operação retirada por gate só volta pelo perfil `full`.
   *
   * NÃO tem default desde 02/09/2026: o contrato core deixou de ter capacidade `account` (a
   * carteira e o perfil de investidor são da extensão Wallet, com contrato e scopes próprios),
   * então não há mais "conta" para uma credencial readmitir aqui. O gancho fica para o host que
   * componha capacidade condicionada à sessão; sem ele, o perfil decide sozinho.
   */
  admit?: (op: Operation) => boolean;
  /**
   * Recorte por CONTEXTO, aplicado depois do perfil: o host compõe a sessão com o que o
   * principal tem instalado (ex.: as tools da Wallet só quando a extensão está instalada no
   * workspace). Diferente do perfil, filtrar tudo aqui NÃO é erro — é um workspace sem nada.
   */
  filter?: (op: Operation) => boolean;
  /** Notas do host para o começo das `instructions` (o que está e o que não está nesta sessão). */
  notes?: string[];
  /** Chamado ao fim de cada tool (log, metering, auditoria). Erro no hook não afeta a tool. */
  onToolCall?: ToolCallHook;
  /** Tools de extensões instaladas, cada uma com contrato e credencial próprios (ver `ToolContribution`). */
  contributions?: ToolContribution[];
}

/**
 * Uma CONTRIBUIÇÃO de tools vinda de OUTRO contrato — a extensão instalada no workspace da
 * sessão, com OpenAPI, credencial e data plane próprios. O host compõe: descobre a instalação,
 * carrega o contrato dela, troca a credencial, e entrega aqui as operações já filtradas. O
 * servidor só registra, com uma regra: tool de contribuição NUNCA sobrescreve o Core nem outra
 * contribuição — colisão de nome é descartada e nomeada em `collisions`.
 */
export interface ToolContribution {
  /** Nome estável da contribuição (o id da extensão), para notas e diagnóstico. */
  name: string;
  operations: Operation[];
  /** Cliente da contribuição: origem do data plane dela e a credencial trocada para ela. */
  apiClient: ApiClient;
  /** Nota do host para as `instructions` (o que esta contribuição cobre). */
  note?: string;
}

export interface CreateServerResult {
  server: McpServer;
  toolCount: number;
  apiOrigin: string;
  /** Tools de contribuição descartadas por colidirem com o Core ou com outra contribuição. */
  collisions: { contribution: string; tool: string }[];
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
 * APLICA O PERFIL. Exportada porque o guarda tem de poder falhar em teste.
 *
 * Sem perfil pedido: `default` quando o contrato declara perfis — a superfície inicial é
 * curada e fail-closed, e ausência de escolha nunca abre `full`. Contrato sem `x-profiles`
 * (o de uma extensão, que não carrega lifecycle) segue inteiro, como sempre.
 *
 * Dois eixos por operação: a CAPACIDADE (`x-capability` ∈ perfil) e o LIFECYCLE
 * (`x-lifecycle` ∈ `lifecycles` do perfil, quando o perfil declara o eixo; operação sem
 * carimbo passa). É a mesma regra do perfil default do agente — uma definição só.
 *
 * Três recusas deliberadas, todas ERRO e nunca degradação silenciosa:
 * - perfil pedido num spec sem `x-profiles` (contrato antigo, ou o de uma extensão);
 * - perfil que o spec não declara (typo devolveria zero tools com cara de "não há operações");
 * - perfil cujo filtro devolve zero operações (spec e perfis divergiram — contrato quebrado).
 *
 * `full` continua passando por aqui: é um perfil declarado como os outros, e tratá-lo como
 * caso especial criaria o segundo caminho que uma das duas listas esquece.
 *
 * `admit` readmite, POR SESSÃO, operações barradas só pela capacidade — nunca as barradas
 * pelo lifecycle. Hoje ninguém o passa no core: o contrato não tem mais capacidade fora dos
 * perfis. O gancho fica para o host que componha uma sessão com capacidade condicionada.
 */
export function aplicarPerfil(
  operations: Operation[],
  profiles: SpecContext["profiles"],
  profile: string | undefined,
  admit?: (op: Operation) => boolean,
): { visiveis: Operation[]; notaDePerfil?: string; perfil?: string } {
  const nome = profile ?? (profiles?.default ? "default" : undefined);
  if (!nome) return { visiveis: operations };
  const def = profiles?.[nome];
  if (!def) {
    const validos = Object.keys(profiles ?? {});
    throw new Error(
      validos.length
        ? `perfil "${nome}" não existe neste contrato. Válidos: ${validos.join(", ")}.`
        : `o contrato carregado não declara perfis (\`x-profiles\`) — atualize a API/spec ou remova DATABOLSA_MCP_PROFILE.`,
    );
  }
  const capacidades = new Set(def.capabilities);
  const lifecycles = def.lifecycles ? new Set(def.lifecycles) : undefined;
  const peloLifecycle = (op: Operation) => op.lifecycle === undefined || lifecycles === undefined || lifecycles.has(op.lifecycle);
  const pelaCapacidade = (op: Operation) => op.capability !== undefined && capacidades.has(op.capability);
  const doPerfil = operations.filter((op) => peloLifecycle(op) && pelaCapacidade(op));
  if (doPerfil.length === 0) {
    throw new Error(`perfil "${nome}" filtrou TODAS as ${operations.length} operações — spec e perfis divergem; contrato quebrado.`);
  }
  const admitidas = admit ? operations.filter((op) => peloLifecycle(op) && !pelaCapacidade(op) && admit(op)) : [];
  const visiveis = admitidas.length ? operations.filter((op) => doPerfil.includes(op) || admitidas.includes(op)) : doPerfil;
  const retiradas = lifecycles ? operations.filter((op) => pelaCapacidade(op) && !peloLifecycle(op)).length : 0;
  const implicito = profile === undefined;
  return {
    visiveis,
    perfil: nome,
    notaDePerfil:
      `PERFIL ATIVO: ${nome}${implicito ? " (o default de uma sessão sem perfil)" : ""}: ${visiveis.length} de ${operations.length} operações do contrato ` +
      `(capacidades: ${def.capabilities.join(", ")}${admitidas.length ? `; mais ${admitidas.length} admitidas por esta sessão` : ""}). ${def.description ?? ""} ` +
      (retiradas
        ? `${retiradas} operações especializadas foram retiradas deste perfil porque a superfície de objetos responde por elas (\`x-lifecycle: on-demand\`); o perfil \`full\` as expõe. ` +
          `Se uma pergunta precisar de operação fora desta sessão, diga isso ao usuário em vez de responder que o dado não existe.`
        : // Sem operação retida por gate, o perfil é o contrato inteiro de leitura; não anunciar uma gaveta que não existe.
          `Nenhuma operação está retida por gate: o perfil é o contrato inteiro de leitura. O que uma operação especializada ` +
          `apagada respondia continua acessível pelos Objects: resolveObject, getObjectFacts, getObjectHistory, listObjectLinks e getObjectLinkHistory.`),
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
  const { visiveis: doPerfil, notaDePerfil } = aplicarPerfil(
    operations,
    profiles,
    opts.profile ?? process.env.DATABOLSA_MCP_PROFILE,
    opts.admit,
  );
  const visiveis = opts.filter ? doPerfil.filter(opts.filter) : doPerfil;
  const tools = buildTools(visiveis, api, opts.onToolCall);
  const { collisions, notas: notasDeContribuicao } = contribuir(tools, opts.contributions ?? [], opts.onToolCall);
  // A única tool que não é operação do contrato: `executeObjectFunction`, quando a sessão
  // enxerga o grafo. Os inputs derivam do contrato COMPLETO — a operação especializada por
  // baixo pode estar fora do perfil e a função continua válida (quem chama é o SDK, na API).
  if (sessaoComGrafo(visiveis)) {
    tools.push(buildObjectFunctionTool({ baseUrl: api.origin, apiKey: api.credential, operations }));
  }
  // O digest dentro das instruções é recortado pelas tools que este server EXPÕE — um perfil
  // sem o grafo não carrega o vocabulário do grafo no texto que o cliente lê antes de tudo.
  const instructions = instructionsFor(visiveis.map((op) => op.operationId));

  // `instructions` é o único texto que o cliente MCP lê ANTES de escolher uma tool. Sem ele
  // o agente via 131 nomes planos em camelCase e nada dizendo o que o servidor cobre — a CLI
  // tinha índice navegável (`databolsa --list`) e a IA, que é quem mais precisa, não tinha.
  const server = new McpServer(
    { name: opts.serverName ?? SERVER_NAME, version: SERVER_VERSION },
    { instructions: [...(opts.notes ?? []), ...(notaDePerfil ? [notaDePerfil] : []), ...notasDeContribuicao, instructions].join("\n\n") },
  );
  for (const tool of tools) {
    server.registerTool(tool.name, tool.config, tool.handler);
  }

  return { server, toolCount: tools.length, apiOrigin: api.origin, collisions };
}

/**
 * Anexa as contribuições às tools do Core, em ordem. O Core sempre ganha; entre contribuições,
 * a primeira registrada ganha. A colisão é descartada e devolvida — nunca silenciosa, nunca
 * uma tool trocada por baixo do cliente. Exportada para o guarda testar sem transporte.
 */
export function contribuir(
  tools: ToolDef[],
  contributions: readonly ToolContribution[],
  onToolCall?: ToolCallHook,
): { collisions: CreateServerResult["collisions"]; notas: string[] } {
  const nomes = new Set(tools.map((t) => t.name));
  const collisions: CreateServerResult["collisions"] = [];
  const notas: string[] = [];
  for (const c of contributions) {
    let aceitas = 0;
    for (const tool of buildTools(c.operations, c.apiClient, onToolCall)) {
      if (nomes.has(tool.name)) {
        collisions.push({ contribution: c.name, tool: tool.name });
        continue;
      }
      nomes.add(tool.name);
      tools.push(tool);
      aceitas += 1;
    }
    if (c.note) notas.push(`${c.note} (${aceitas} tools)`);
  }
  return { collisions, notas };
}

function packageVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version?: string };
    return pkg.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}
