/**
 * Carrega o contrato OpenAPI e extrai a lista de operações que viram comandos.
 *
 * Fonte primária: `/openapi.json` vivo da API, então os comandos acompanham a
 * API sozinhos.
 * Fallback: o `api/openapi.yaml` versionado no repo, para `--list`
 * funcionar mesmo se a API estiver momentaneamente fora (as chamadas, claro,
 * ainda exigem a API no ar).
 */
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";
import type { ApiClient } from "./api-client";

export interface ParamSpec {
  name: string;
  in: "path" | "query" | "body";
  required: boolean;
  /**
   * `object`/`array` existem porque o contrato os usa em requestBody (`doc`, `tags`,
   * `ids`). Sem eles, `normalizeType` colapsava `$ref`/`type: object` em "string" e a
   * flag saía no corpo como JSON serializado, que o servidor recusa — `theses create`
   * era inutilizável pela CLI pelo mesmo motivo que pelo MCP.
   */
  type: "string" | "number" | "integer" | "boolean" | "object" | "array";
  description?: string;
  enum?: string[];
  /** regex do contrato (`schema.pattern`) — valida no cliente antes do 400 da API. */
  pattern?: string;
  default?: unknown;
}

export interface Operation {
  operationId: string;
  /** chave do spec, ex.: `/v1/stocks/{ticker}` */
  path: string;
  /** Verbo HTTP — operações de escrita (post/put/patch/delete) também viram comandos. */
  method: "get" | "post" | "put" | "patch" | "delete";
  summary?: string;
  description?: string;
  tags: string[];
  params: ParamSpec[];
}

interface RawParam {
  name: string;
  in: string;
  required?: boolean;
  description?: string;
  schema?: {
    type?: string | string[];
    enum?: unknown[];
    pattern?: string;
    default?: unknown;
    description?: string;
    /** Presente nos params estruturados do requestBody (`doc` → ReportDocInput). */
    $ref?: string;
    items?: unknown;
    properties?: unknown;
  };
}

/**
 * Caminhos candidatos do `openapi.yaml` estático, em ordem de tentativa. O layout
 * difere entre o pacote PUBLICADO e a árvore de FONTE:
 *   1) `./openapi.yaml` — ao lado do bundle no pacote publicado (`dist/openapi.yaml`,
 *      copiado pelo build; incluído via `files: ["dist"]`).
 *   2) `../../../api/openapi.yaml` — layout de fonte no repo (`packages/cli/src/` → raiz).
 * O publicado acha (1); rodando do fonte em dev acha (2). Antes esta era a única
 * tentativa e, no publicado, `import.meta.url`=`…/dist/index.js` resolvia p/
 * `…/node_modules/api/openapi.yaml` (inexistente) → fallback offline morto.
 */
export function staticSpecCandidates(moduleUrl: string = import.meta.url): string[] {
  return [
    fileURLToPath(new URL("./openapi.yaml", moduleUrl)),
    fileURLToPath(new URL("../../../api/openapi.yaml", moduleUrl)),
  ];
}

export interface LoadOperationsOptions {
  /** Fallback estático próprio (a casca advisor aponta o openapi-advisor.yaml bundlado). */
  staticCandidates?: string[];
}

export async function loadOperations(api: ApiClient, opts?: LoadOperationsOptions): Promise<Operation[]> {
  return extractOperations(await loadSpec(api, opts));
}

async function loadSpec(api: ApiClient, opts?: LoadOperationsOptions): Promise<unknown> {
  try {
    return await api.fetchOpenApi();
  } catch (liveErr) {
    let staticErr: unknown;
    for (const path of opts?.staticCandidates ?? staticSpecCandidates()) {
      try {
        return parseYaml(await readFile(path, "utf8"));
      } catch (err) {
        staticErr = err;
      }
    }
    throw new Error(
      `Não foi possível carregar o OpenAPI. A API em ${api.origin} está no ar? ` +
        `(live: ${(liveErr as Error).message}; estático: ${(staticErr as Error).message})`,
    );
  }
}

interface RawOperation {
  operationId?: string;
  summary?: string;
  description?: string;
  tags?: string[];
  parameters?: RawParam[];
  requestBody?: {
    content?: Record<string, { schema?: { properties?: Record<string, RawParam["schema"] & { description?: string }>; required?: string[] } }>;
  };
}

const METHODS = ["get", "post", "put", "patch", "delete"] as const;

export function extractOperations(spec: unknown): Operation[] {
  const paths = (spec as { paths?: Record<string, Record<string, unknown>> }).paths ?? {};
  const ops: Operation[] = [];
  for (const [path, item] of Object.entries(paths)) {
    for (const method of METHODS) {
      const raw = (item as Record<string, unknown>)[method] as RawOperation | undefined;
      if (!raw?.operationId) continue;
      const params = (raw.parameters ?? []).map(toParamSpec).filter((p): p is ParamSpec => p !== null);
      // requestBody (JSON) vira parâmetros `in:"body"` — na CLI eles viram --flags.
      const bodySchema = raw.requestBody?.content?.["application/json"]?.schema;
      const requiredBody = new Set(bodySchema?.required ?? []);
      for (const [name, schema] of Object.entries(bodySchema?.properties ?? {})) {
        params.push({
          name,
          in: "body",
          required: requiredBody.has(name),
          type: normalizeType(schema),
          description: schema?.description,
          enum: Array.isArray(schema?.enum) ? schema.enum.map(String) : undefined,
          pattern: typeof schema?.pattern === "string" ? schema.pattern : undefined,
          default: schema?.default,
        });
      }
      ops.push({
        operationId: raw.operationId,
        path,
        method,
        summary: raw.summary,
        description: raw.description,
        tags: raw.tags ?? [],
        params,
      });
    }
  }
  return ops.sort((a, b) => a.operationId.localeCompare(b.operationId));
}

function toParamSpec(p: RawParam): ParamSpec | null {
  if (p.in !== "path" && p.in !== "query") return null;
  const schema = p.schema ?? {};
  return {
    name: p.name,
    in: p.in,
    required: p.required ?? p.in === "path",
    type: normalizeType(schema),
    description: p.description ?? schema.description,
    enum: Array.isArray(schema.enum) ? schema.enum.map(String) : undefined,
    pattern: typeof schema.pattern === "string" ? schema.pattern : undefined,
    default: schema.default,
  };
}

/**
 * Tipo do parâmetro. `$ref` não traz `type`, então `schema.$ref` presente já implica
 * objeto — é o caso de `doc` (→ ReportDocInput), e tratá-lo como "string" era a causa
 * do corpo sair serializado.
 *
 * `allOf: [{$ref}]` conta como a mesma coisa: é como a OpenAPI 3.0 pendura
 * description/deprecated numa referência, e sem isto anotar o campo o rebaixava
 * de volta a "string" — o defeito original, por outro caminho.
 */
function normalizeType(
  schema:
    | { type?: string | string[]; $ref?: string; items?: unknown; properties?: unknown; allOf?: { $ref?: string }[] }
    | undefined,
): ParamSpec["type"] {
  const t = schema?.type;
  const v = Array.isArray(t) ? t.find((x) => x !== "null") : t;
  if (v === "integer") return "integer";
  if (v === "number") return "number";
  if (v === "boolean") return "boolean";
  if (v === "array" || (!v && schema?.items)) return "array";
  const wrapsRef = schema?.allOf?.length === 1 && Boolean(schema.allOf[0]?.$ref);
  if (v === "object" || (!v && (schema?.properties || schema?.$ref || wrapsRef))) return "object";
  return "string";
}
