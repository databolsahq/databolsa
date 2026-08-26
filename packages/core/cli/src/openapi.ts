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

interface RawSchema {
  type?: string | string[];
  enum?: unknown[];
  pattern?: string;
  default?: unknown;
  description?: string;
  $ref?: string;
  items?: RawSchema;
  properties?: Record<string, RawSchema>;
  required?: string[];
  allOf?: RawSchema[];
}

interface RawParam {
  name: string;
  in: string;
  required?: boolean;
  description?: string;
  schema?: RawSchema;
}

/**
 * Caminhos candidatos do `openapi.yaml` estático, em ordem de tentativa. O layout
 * difere entre o pacote PUBLICADO e a árvore de FONTE:
 *   1) `./openapi.yaml` — ao lado do bundle no pacote publicado (`dist/openapi.yaml`,
 *      copiado pelo build; incluído via `files: ["dist"]`).
 *   2) `../../../../api/openapi.yaml` — layout de fonte no repo (`packages/core/cli/src/` → raiz).
 * O publicado acha (1); rodando do fonte em dev acha (2). Antes esta era a única
 * tentativa e, no publicado, `import.meta.url`=`…/dist/index.js` resolvia p/
 * `…/node_modules/api/openapi.yaml` (inexistente) → fallback offline morto.
 */
export function staticSpecCandidates(moduleUrl: string = import.meta.url): string[] {
  return [
    fileURLToPath(new URL("./openapi.yaml", moduleUrl)),
    fileURLToPath(new URL("../../../../api/openapi.yaml", moduleUrl)),
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
    content?: Record<string, { schema?: RawSchema }>;
  };
}

const METHODS = ["get", "post", "put", "patch", "delete"] as const;

export function extractOperations(spec: unknown): Operation[] {
  const document = spec as {
    paths?: Record<string, Record<string, unknown>>;
    components?: { schemas?: Record<string, RawSchema> };
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
      // requestBody (JSON) vira parâmetros `in:"body"` — na CLI eles viram --flags.
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
      });
    }
  }
  return ops.sort((a, b) => a.operationId.localeCompare(b.operationId));
}

/** Resolve referências locais para que enum query (`DocumentEntityType`) continue escalar. */
function resolveRef(
  schema: RawSchema | undefined,
  schemas: Record<string, RawSchema>,
  depth = 0,
): RawSchema | undefined {
  if (depth > 8) return schema;
  if (schema?.allOf?.length === 1 && !schema.type && !schema.properties) {
    const inner = resolveRef(schema.allOf[0], schemas, depth + 1);
    return inner ? { ...inner, description: schema.description ?? inner.description } : schema;
  }
  if (!schema?.$ref) return schema;
  const prefix = "#/components/schemas/";
  if (!schema.$ref.startsWith(prefix)) return schema;
  const key = decodeURIComponent(schema.$ref.slice(prefix.length).replace(/~1/g, "/").replace(/~0/g, "~"));
  const target = schemas[key];
  if (!target) return schema;
  const resolved = resolveRef(target, schemas, depth + 1);
  return resolved ? { ...resolved, description: schema.description ?? resolved.description } : schema;
}

function specFrom(
  name: string,
  where: ParamSpec["in"],
  required: boolean,
  raw: RawSchema | undefined,
  schemas: Record<string, RawSchema>,
  description?: string,
): ParamSpec {
  const schema = resolveRef(raw, schemas) ?? {};
  return {
    name,
    in: where,
    required,
    type: normalizeType(schema),
    description: description ?? schema.description,
    enum: Array.isArray(schema.enum) ? schema.enum.map(String) : undefined,
    pattern: typeof schema.pattern === "string" ? schema.pattern : undefined,
    default: schema.default,
  };
}

function toParamSpec(p: RawParam, schemas: Record<string, RawSchema>): ParamSpec | null {
  if (p.in !== "path" && p.in !== "query") return null;
  return specFrom(p.name, p.in, p.required ?? p.in === "path", p.schema, schemas, p.description);
}

/**
 * Tipo depois de resolver `$ref`/`allOf`. Uma referência pode apontar tanto para um
 * objeto (`ReportDocInput`) quanto para um escalar (`DocumentEntityType`); inferir
 * "objeto" só pela presença de `$ref` foi o que fez `--entity_type fiagro` exigir JSON.
 */
function normalizeType(schema: RawSchema | undefined): ParamSpec["type"] {
  const t = schema?.type;
  const v = Array.isArray(t) ? t.find((x) => x !== "null") : t;
  if (v === "integer") return "integer";
  if (v === "number") return "number";
  if (v === "boolean") return "boolean";
  if (v === "array" || (!v && schema?.items)) return "array";
  if (v === "object" || (!v && schema?.properties)) return "object";
  return "string";
}
