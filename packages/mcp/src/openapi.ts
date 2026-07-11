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
  type: "string" | "number" | "integer" | "boolean";
  description?: string;
  enum?: string[];
  default?: unknown;
}

export interface Operation {
  operationId: string;
  /** chave do spec, ex.: `/v1/stocks/{ticker}` */
  path: string;
  /** Verbo HTTP — operações de escrita (post/delete) também viram tools. */
  method: "get" | "post" | "delete";
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
  schema?: { type?: string | string[]; enum?: unknown[]; default?: unknown; description?: string };
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
    content?: Record<string, { schema?: { properties?: Record<string, RawParam["schema"] & { description?: string }>; required?: string[] } }>;
  };
}

const METHODS = ["get", "post", "delete"] as const;

function extractOperations(spec: unknown): Operation[] {
  const paths = (spec as { paths?: Record<string, Record<string, unknown>> }).paths ?? {};
  const ops: Operation[] = [];
  for (const [path, item] of Object.entries(paths)) {
    for (const method of METHODS) {
      const raw = (item as Record<string, unknown>)[method] as RawOperation | undefined;
      if (!raw?.operationId) continue;
      const params = (raw.parameters ?? []).map(toParamSpec).filter((p): p is ParamSpec => p !== null);
      // requestBody (JSON) vira parâmetros `in:"body"` — achatado no input da tool.
      const bodySchema = raw.requestBody?.content?.["application/json"]?.schema;
      const requiredBody = new Set(bodySchema?.required ?? []);
      for (const [name, schema] of Object.entries(bodySchema?.properties ?? {})) {
        params.push({
          name,
          in: "body",
          required: requiredBody.has(name),
          type: normalizeType(schema?.type),
          description: schema?.description,
          enum: Array.isArray(schema?.enum) ? schema.enum.map(String) : undefined,
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
    type: normalizeType(schema.type),
    description: p.description ?? schema.description,
    enum: Array.isArray(schema.enum) ? schema.enum.map(String) : undefined,
    default: schema.default,
  };
}

function normalizeType(t: string | string[] | undefined): ParamSpec["type"] {
  const v = Array.isArray(t) ? t.find((x) => x !== "null") : t;
  if (v === "integer") return "integer";
  if (v === "number") return "number";
  if (v === "boolean") return "boolean";
  return "string";
}
