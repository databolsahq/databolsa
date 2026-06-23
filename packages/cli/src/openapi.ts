/**
 * Carrega o contrato OpenAPI e extrai a lista de operações que viram comandos.
 *
 * Fonte primária: `/openapi.json` vivo da API (gerado em
 * `packages/api/src/lib/openapi.ts`), então os comandos acompanham a API sozinhos.
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
  in: "path" | "query";
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

/** `api/openapi.yaml` relativo a este módulo (packages/cli/src/ → raiz). */
const STATIC_SPEC = fileURLToPath(new URL("../../../api/openapi.yaml", import.meta.url));

export async function loadOperations(api: ApiClient): Promise<Operation[]> {
  return extractOperations(await loadSpec(api));
}

async function loadSpec(api: ApiClient): Promise<unknown> {
  try {
    return await api.fetchOpenApi();
  } catch (liveErr) {
    try {
      return parseYaml(await readFile(STATIC_SPEC, "utf8"));
    } catch (staticErr) {
      throw new Error(
        `Não foi possível carregar o OpenAPI. A API em ${api.origin} está no ar? ` +
          `(live: ${(liveErr as Error).message}; estático: ${(staticErr as Error).message})`,
      );
    }
  }
}

function extractOperations(spec: unknown): Operation[] {
  const paths = (spec as { paths?: Record<string, Record<string, unknown>> }).paths ?? {};
  const ops: Operation[] = [];
  for (const [path, item] of Object.entries(paths)) {
    const get = (item as Record<string, unknown>).get as
      | { operationId?: string; summary?: string; description?: string; tags?: string[]; parameters?: RawParam[] }
      | undefined;
    if (!get?.operationId) continue;
    ops.push({
      operationId: get.operationId,
      path,
      summary: get.summary,
      description: get.description,
      tags: get.tags ?? [],
      params: (get.parameters ?? [])
        .map(toParamSpec)
        .filter((p): p is ParamSpec => p !== null),
    });
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
