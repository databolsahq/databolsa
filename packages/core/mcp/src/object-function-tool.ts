/**
 * `executeObjectFunction` como tool MCP — a primeira tool do servidor que NÃO é uma operação
 * do contrato. A casca é fina de propósito: schema, formatação de resultado e nada mais; a
 * execução inteira (sujeito, validação, `fnAny`, explicação de recusa) mora em
 * `object-function.ts`, para toda casca executar o mesmo núcleo.
 *
 * Só entra quando a sessão enxerga o grafo (perfil com `object-context`): oferecer a função
 * num perfil sem `getObject`/`resolveObject` seria um capítulo sem o mapa que o explica. O
 * contrato do Advisor não tem grafo, então o perfil advisor nunca a recebe.
 */
import { z } from "zod";
import { DataBolsa } from "../../sdk/src/index";
import {
  catalogoDeFuncoes,
  executarFuncaoDeObjeto,
  inputsDoContrato,
  FUNCOES_DO_REGISTRY,
  KINDS_COM_FUNCAO,
  type ObjectFunctionArgs,
} from "./object-function";
import type { Operation } from "./openapi";
import type { ToolDef } from "./tools";

export const OBJECT_FUNCTION_TOOL_NAME = "executeObjectFunction";

export interface ObjectFunctionToolOptions {
  /** Origem da API (a mesma do ApiClient da sessão). */
  baseUrl: string;
  /** Bearer da sessão, quando houver — a mesma credencial das outras tools. */
  apiKey?: string | null;
  /** TODAS as operações do contrato (não só as visíveis): os inputs derivam da operação por baixo. */
  operations: readonly Operation[];
}

export function buildObjectFunctionTool(opts: ObjectFunctionToolOptions): ToolDef {
  const inputs = inputsDoContrato(opts.operations);
  const db = new DataBolsa(opts.baseUrl, { apiKey: opts.apiKey ?? undefined });
  return {
    name: OBJECT_FUNCTION_TOOL_NAME,
    config: {
      title: "Executar função de objeto",
      description:
        "Executa UMA função do registry sobre UM objeto do grafo (empresa, papel, fundo, instrumento, índice, série), " +
        "sem precisar saber qual rota responde: cotações, indicadores, proventos, ratings, debêntures, documentos, insiders, " +
        "composição de índice, pontos de série. O sujeito é o objeto (entity_id ou texto + kind); `input` traz só filtros. " +
        "Funções, tipos e inputs aceitos (só estes; boolean é true/false): " +
        catalogoDeFuncoes(inputs) +
        ". Ambiguidade volta com os candidatos; função que o tipo não tem volta com as disponíveis. " +
        "Prefira esta tool a procurar a rota especializada quando já souber QUAL objeto e QUAL capítulo quer.",
      inputSchema: {
        subject: z
          .object({
            entity_id: z.string().optional().describe("Id publicado do objeto (pub_…), de resolveObject/getObject/aresta."),
            resolve: z.string().optional().describe("Texto para resolver quando não há id: ticker, CNPJ, ISIN, código ou nome."),
            kind: z.enum(KINDS_COM_FUNCAO).optional().describe("Estreita a resolução ao tipo. Obrigatório quando o texto pode casar mais de um tipo."),
            subkind: z.string().optional().describe("Recorta dentro do tipo: fii, fidc, debenture, bdr…"),
          })
          .describe("UM objeto: `entity_id` OU `resolve` (+ `kind`). Nunca os dois vazios."),
        function: z.enum(FUNCOES_DO_REGISTRY as [string, ...string[]]).describe("Id da função no registry (lista fechada)."),
        input: z.record(z.unknown()).optional().describe("Filtros da função (from, to, limit, cursor, perAgency…). NUNCA o sujeito: ticker/cnpj/isin vêm do objeto."),
        series: z.string().optional().describe("Papel (PETR3/PETR4) quando a função é por papel e a companhia tem vários."),
        at: z.string().optional().describe("Corte temporal ISO (YYYY-MM-DD): retrato responde em `at`, série responde até `to`."),
      },
      outputSchema: z.object({}).passthrough(),
      annotations: { readOnlyHint: true, openWorldHint: false, destructiveHint: false },
    },
    handler: async (args) => {
      const r = await executarFuncaoDeObjeto(db, args as unknown as ObjectFunctionArgs, inputs);
      if (!r.ok) {
        return {
          content: [{ type: "text", text: `Não executado: ${r.message}` }],
          structuredContent: { error: { message: r.message } },
          isError: true,
        };
      }
      const structuredContent = r.body as Record<string, unknown>;
      return { structuredContent, content: [{ type: "text", text: JSON.stringify(structuredContent) }] };
    },
  };
}

/** A sessão enxerga o grafo? Sem `getObject` visível, a função ficaria sem o mapa que a explica. */
export function sessaoComGrafo(visiveis: readonly Operation[]): boolean {
  return visiveis.some((op) => op.operationId === "getObject");
}
