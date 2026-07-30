/**
 * Carrega o contrato OpenAPI e extrai a lista de operações que viram tools MCP.
 *
 * Fonte primária: `/openapi.json` vivo da API, então as tools acompanham a API
 * sozinhas.
 * Fallback: o `api/openapi.yaml` versionado no repo, para o `tools/list`
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
   * `object` e `array` existem aqui porque o contrato os usa em requestBody. Sem
   * eles, `normalizeType` colapsava tudo que não fosse escalar em "string" e o
   * schema MCP declarava `doc: string` para um parâmetro que o servidor só aceita
   * como objeto — nenhuma chamada de `createThesis` podia passar, por MCP ou CLI.
   */
  type: "string" | "number" | "integer" | "boolean" | "object" | "array";
  description?: string;
  enum?: string[];
  default?: unknown;
  /** Tipo dos itens, quando `type === "array"`. */
  items?: ParamSpec["type"];
  /** Faixa declarada no contrato. Antes era descartada, então o schema que o cliente
   *  MCP vê não expressava o `maximum` real de `limit` (1.000 na maioria das
   *  operações, 20.000 em cinco séries) e o LLM não tinha como respeitá-lo. */
  minimum?: number;
  maximum?: number;
}

export interface JsonSchema {
  $ref?: string;
  type?: string | string[];
  description?: string;
  enum?: unknown[];
  const?: unknown;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  additionalProperties?: boolean | JsonSchema;
  anyOf?: JsonSchema[];
  oneOf?: JsonSchema[];
  allOf?: JsonSchema[];
  nullable?: boolean;
  minimum?: number;
  maximum?: number;
  default?: unknown;
}

export interface Operation {
  operationId: string;
  /** chave do spec, ex.: `/v1/stocks/{ticker}` */
  path: string;
  /** Verbo HTTP — operações de escrita (post/put/patch/delete) também viram tools. */
  method: "get" | "post" | "put" | "patch" | "delete";
  summary?: string;
  description?: string;
  tags: string[];
  params: ParamSpec[];
  /** Corpo JSON da primeira resposta 2xx documentada. Alimenta outputSchema MCP. */
  responseSchema?: JsonSchema;
  /** Registry compartilhado para resolver `$ref: #/components/schemas/*`. */
  schemas?: Record<string, JsonSchema>;
}

interface RawParam {
  name: string;
  in: string;
  required?: boolean;
  description?: string;
  schema?: JsonSchema;
}

/**
 * Caminhos candidatos do `openapi.yaml` estático, em ordem de tentativa. O layout
 * difere entre o pacote PUBLICADO e a árvore de FONTE:
 *   1) `./openapi.yaml` — ao lado do bundle no pacote publicado (`dist/openapi.yaml`,
 *      copiado pelo build; incluído via `files: ["dist"]`).
 *   2) `../../../api/openapi.yaml` — layout de fonte no repo (`packages/mcp/src/` → raiz).
 * O publicado acha (1); rodando do fonte em dev acha (2). Antes esta era a única
 * tentativa e, no publicado, `import.meta.url`=`…/dist/index.js` resolvia p/
 * `…/node_modules/api/openapi.yaml` (inexistente) → o MCP nem bootava offline.
 */
export function staticSpecCandidates(moduleUrl: string = import.meta.url): string[] {
  return [
    fileURLToPath(new URL("./openapi.yaml", moduleUrl)),
    fileURLToPath(new URL("../../../api/openapi.yaml", moduleUrl)),
  ];
}

export async function loadOperations(api: ApiClient): Promise<Operation[]> {
  return extractOperations(await loadSpec(api));
}

async function loadSpec(api: ApiClient): Promise<unknown> {
  try {
    return await api.fetchOpenApi();
  } catch (liveErr) {
    let staticErr: unknown;
    for (const path of staticSpecCandidates()) {
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
    content?: Record<string, { schema?: JsonSchema }>;
  };
  responses?: Record<string, { content?: Record<string, { schema?: JsonSchema }> }>;
}

/**
 * Resolve `$ref` local até o schema concreto. Body params do contrato apontam para
 * `#/components/schemas/*` (ex.: `doc` → ReportDocInput) e, sem resolver, `schema.type`
 * vem `undefined` — que `normalizeType` tratava como "string". Era o mecanismo exato
 * do createThesis quebrado. O limite de profundidade evita ciclo de $ref.
 */
function resolveRef(
  schema: JsonSchema | undefined,
  schemas: Record<string, JsonSchema>,
  depth = 0,
): JsonSchema | undefined {
  if (!schema?.$ref || depth > 8) return schema;
  const prefix = "#/components/schemas/";
  if (!schema.$ref.startsWith(prefix)) return schema;
  const key = decodeURIComponent(schema.$ref.slice(prefix.length).replace(/~1/g, "/").replace(/~0/g, "~"));
  const target = schemas[key];
  return target ? resolveRef(target, schemas, depth + 1) : schema;
}

/** ParamSpec a partir de um JsonSchema já resolvido, comum a query e body. */
function specFrom(
  name: string,
  where: ParamSpec["in"],
  required: boolean,
  raw: JsonSchema | undefined,
  schemas: Record<string, JsonSchema>,
  description?: string,
): ParamSpec {
  const schema = resolveRef(raw, schemas) ?? {};
  const type = normalizeType(schema);
  const items =
    type === "array" ? normalizeType(resolveRef(schema.items, schemas) ?? {}) : undefined;
  return {
    name,
    in: where,
    required,
    type,
    description: description ?? schema.description,
    enum: Array.isArray(schema.enum) ? schema.enum.map(String) : undefined,
    default: schema.default,
    items,
    minimum: typeof schema.minimum === "number" ? schema.minimum : undefined,
    maximum: typeof schema.maximum === "number" ? schema.maximum : undefined,
  };
}

const METHODS = ["get", "post", "put", "patch", "delete"] as const;

export function extractOperations(spec: unknown): Operation[] {
  const document = spec as {
    paths?: Record<string, Record<string, unknown>>;
    components?: { schemas?: Record<string, JsonSchema> };
  };
  const paths = document.paths ?? {};
  const schemas = document.components?.schemas ?? {};
  const ops: Operation[] = [];
  for (const [path, item] of Object.entries(paths)) {
    for (const method of METHODS) {
      const raw = (item as Record<string, unknown>)[method] as RawOperation | undefined;
      if (!raw?.operationId) continue;
      const params = (raw.parameters ?? [])
        .map((p) => toParamSpec(p, schemas))
        .filter((p): p is ParamSpec => p !== null);
      // requestBody (JSON) vira parâmetros `in:"body"` — achatado no input da tool.
      const bodySchema = resolveRef(raw.requestBody?.content?.["application/json"]?.schema, schemas);
      const requiredBody = new Set(bodySchema?.required ?? []);
      for (const [name, schema] of Object.entries(bodySchema?.properties ?? {})) {
        params.push(specFrom(name, "body", requiredBody.has(name), schema, schemas));
      }
      ops.push({
        operationId: raw.operationId,
        path,
        method,
        summary: raw.summary,
        description: raw.description,
        tags: raw.tags ?? [],
        params,
        responseSchema: successResponseSchema(raw),
        schemas,
      });
    }
  }
  return ops.sort((a, b) => a.operationId.localeCompare(b.operationId));
}

function successResponseSchema(op: RawOperation): JsonSchema | undefined {
  const successes = Object.entries(op.responses ?? {})
    .filter(([status]) => /^2\d\d$/.test(status))
    .sort(([a], [b]) => Number(a) - Number(b));
  for (const [, response] of successes) {
    const schema = response.content?.["application/json"]?.schema;
    if (schema) return schema;
  }
  return undefined;
}

function toParamSpec(p: RawParam, schemas: Record<string, JsonSchema>): ParamSpec | null {
  if (p.in !== "path" && p.in !== "query") return null;
  return specFrom(p.name, p.in, p.required ?? p.in === "path", p.schema, schemas, p.description);
}

/**
 * Tipo do parâmetro a partir do schema RESOLVIDO. O fallback para "string" só vale
 * para schema sem tipo declarado e sem forma de objeto/array — antes ele engolia
 * também `$ref` e `type: object`, e era assim que um ReportDoc virava string.
 */
function normalizeType(schema: JsonSchema): ParamSpec["type"] {
  const t = schema.type;
  const v = Array.isArray(t) ? t.find((x) => x !== "null") : t;
  if (v === "integer") return "integer";
  if (v === "number") return "number";
  if (v === "boolean") return "boolean";
  if (v === "array" || (!v && schema.items)) return "array";
  if (v === "object" || (!v && schema.properties)) return "object";
  return "string";
}
