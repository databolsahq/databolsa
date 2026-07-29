/**
 * Converte cada operação do OpenAPI em uma tool MCP: input schema (Zod) a
 * partir dos parâmetros (path + query) e um handler que reescreve o path,
 * monta a query e chama a API. 501/404 viram texto "fora do preview" — espelha
 * o `NotInPreviewError` do SDK — em vez de explodir.
 */
import { z, type ZodTypeAny } from "zod";
import type { ApiClient } from "./api-client";
import type { JsonSchema, Operation, ParamSpec } from "./openapi";

export interface ToolResult {
  content: { type: "text"; text: string }[];
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
  /** CallToolResult do SDK é passthrough; o index signature satisfaz o tipo. */
  [key: string]: unknown;
}

export interface ToolDef {
  name: string;
  config: {
    title?: string;
    description: string;
    /** ZodRawShape (mapa nome → validador), como o SDK espera. */
    inputSchema: Record<string, ZodTypeAny>;
    /** Contrato do `structuredContent`, derivado da resposta 2xx do OpenAPI. */
    outputSchema: ZodTypeAny;
    /** Impacto explícito exigido por clientes como o ChatGPT. */
    annotations: {
      readOnlyHint: boolean;
      openWorldHint: boolean;
      destructiveHint: boolean;
    };
  };
  handler: (args: Record<string, unknown>) => Promise<ToolResult>;
}

export function buildTools(operations: Operation[], api: ApiClient): ToolDef[] {
  return operations.map((op) => toTool(op, api));
}

function toTool(op: Operation, api: ApiClient): ToolDef {
  const inputSchema: Record<string, ZodTypeAny> = {};
  for (const p of op.params) inputSchema[p.name] = zodFor(p);
  const pathParams = new Set(op.params.filter((p) => p.in === "path").map((p) => p.name));
  const bodyParams = new Set(op.params.filter((p) => p.in === "body").map((p) => p.name));
  const method = (op.method ?? "get").toUpperCase() as "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  const output = outputFor(op);

  return {
    name: op.operationId,
    config: {
      title: op.summary,
      description: describe(op),
      inputSchema,
      outputSchema: output.schema,
      annotations: annotationsFor(op),
    },
    handler: async (args) => {
      let path = op.path;
      const query: Record<string, unknown> = {};
      const body: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(args ?? {})) {
        if (value === undefined) continue;
        if (pathParams.has(key)) path = path.replace(`{${key}}`, encodeURIComponent(String(value)));
        else if (bodyParams.has(key)) body[key] = value;
        else query[key] = value;
      }

      const res = await api.request(method, path, query, bodyParams.size > 0 ? body : undefined);
      if (res.ok) {
        const structuredContent = output.wrap ? { result: res.body } : (res.body as Record<string, unknown>);
        return {
          structuredContent,
          // Mesmo payload em texto mantém compatibilidade com clientes MCP antigos.
          content: [{ type: "text", text: stringify(structuredContent) }],
        };
      }

      const preview = res.status === 501 || res.status === 404;
      const text = preview
        ? `Recurso não disponível neste preview da API (HTTP ${res.status})${res.detail ? `: ${res.detail}` : ""}.`
        : `Erro da API (HTTP ${res.status})${res.detail ? `: ${res.detail}` : ""}.`;
      return { content: [{ type: "text", text }], isError: true };
    },
  };
}

const DESTRUCTIVE_POSTS = new Set([
  "publishThesis",
  "reconcilePortfolioAsset",
  "reorderTheses",
]);

const OPEN_WORLD_WRITES = new Set([
  "addPortfolioAsset",
  "addPortfolioTransaction",
  "createPortfolio",
  "createThesis",
  "deletePortfolio",
  "deletePortfolioTransaction",
  "deleteThesis",
  "exportThesis",
  "importPortfolioFile",
  "importThesisFile",
  "publishThesis",
  "reconcilePortfolioAsset",
  "removePortfolioAsset",
  "reorderTheses",
  "updatePortfolio",
  "updatePortfolioAsset",
  "updatePortfolioTransaction",
  "updateThesis",
]);

/**
 * GETs só consultam. DELETE/PUT/PATCH apagam ou sobrescrevem; os POSTs listados
 * também alteram estado existente ou tornam conteúdo público. Escritas ficam no
 * ambiente privado do DataBolsa, exceto operações que podem criar, alterar,
 * remover ou exportar carteiras e teses em URLs e perfis publicamente acessíveis.
 */
export function annotationsFor(op: Operation): ToolDef["config"]["annotations"] {
  const readOnlyHint = op.method === "get";
  const destructiveHint =
    !readOnlyHint &&
    (op.method === "delete" ||
      op.method === "put" ||
      op.method === "patch" ||
      DESTRUCTIVE_POSTS.has(op.operationId));
  const openWorldHint = !readOnlyHint && OPEN_WORLD_WRITES.has(op.operationId);
  return { readOnlyHint, openWorldHint, destructiveHint };
}

interface OutputSpec {
  schema: ZodTypeAny;
  /** MCP exige `structuredContent` objeto; arrays/primitivos ficam sob `result`. */
  wrap: boolean;
}

function outputFor(op: Operation): OutputSpec {
  const schemas = op.schemas ?? {};
  const body = zodForOutput(op.responseSchema, schemas);
  if (isObjectSchema(op.responseSchema, schemas)) return { schema: body, wrap: false };
  return {
    schema: z.object({ result: body.describe("Corpo da resposta da API DataBolsa.") }).passthrough(),
    wrap: true,
  };
}

/** Converte o subconjunto de JSON Schema usado pelo OpenAPI em Zod para o SDK MCP. */
export function zodForOutput(
  schema: JsonSchema | undefined,
  schemas: Record<string, JsonSchema> = {},
  resolving: ReadonlySet<string> = new Set(),
): ZodTypeAny {
  if (!schema) return z.unknown();

  if (schema.$ref) {
    const target = localRef(schema.$ref, schemas);
    if (!target || resolving.has(schema.$ref)) return z.unknown().describe(schema.description ?? schema.$ref);
    const next = new Set(resolving);
    next.add(schema.$ref);
    return withDescription(zodForOutput(target, schemas, next), schema.description);
  }

  const variants = schema.oneOf ?? schema.anyOf;
  if (variants?.length) {
    const options = variants.map((item) => zodForOutput(item, schemas, resolving));
    const union = options.length === 1 ? options[0]! : z.union(options as [ZodTypeAny, ZodTypeAny, ...ZodTypeAny[]]);
    return nullable(withDescription(union, schema.description), schema);
  }

  if (schema.allOf?.length) {
    const parts = schema.allOf.map((item) => zodForOutput(item, schemas, resolving));
    let intersection = parts[0] ?? z.unknown();
    for (const part of parts.slice(1)) intersection = z.intersection(intersection, part);
    return nullable(withDescription(intersection, schema.description), schema);
  }

  if (schema.const !== undefined) {
    if (schema.const === null) return withDescription(z.null(), schema.description);
    return nullable(withDescription(literal(schema.const), schema.description), schema);
  }
  if (schema.enum?.length) {
    const hasNull = schema.enum.includes(null);
    const values = schema.enum.filter((value) => value !== null).map(literal);
    if (values.length === 0) return withDescription(z.null(), schema.description);
    const enumeration = values.length === 1 ? values[0]! : z.union(values as [ZodTypeAny, ZodTypeAny, ...ZodTypeAny[]]);
    const described = withDescription(enumeration, schema.description);
    return hasNull ? described.nullable() : nullable(described, schema);
  }

  const types = Array.isArray(schema.type) ? schema.type : schema.type ? [schema.type] : [];
  const type = types.find((item) => item !== "null");
  let base: ZodTypeAny;
  if (type === "object" || schema.properties) {
    const required = new Set(schema.required ?? []);
    const shape: Record<string, ZodTypeAny> = {};
    for (const [name, property] of Object.entries(schema.properties ?? {})) {
      const validator = zodForOutput(property, schemas, resolving);
      shape[name] = required.has(name) ? validator : validator.optional();
    }
    if (schema.additionalProperties && typeof schema.additionalProperties === "object") {
      base = z.object(shape).catchall(zodForOutput(schema.additionalProperties, schemas, resolving));
    } else {
      // Respostas podem ganhar campos de forma compatível antes do próximo contrato gerado.
      base = z.object(shape).passthrough();
    }
  } else if (type === "array") {
    base = z.array(zodForOutput(schema.items, schemas, resolving));
  } else if (type === "integer") {
    base = z.number().int();
  } else if (type === "number") {
    base = z.number();
  } else if (type === "boolean") {
    base = z.boolean();
  } else if (type === "null") {
    base = z.null();
  } else if (type === "string") {
    base = z.string();
  } else {
    base = z.unknown();
  }

  return nullable(withDescription(base, schema.description), schema);
}

function isObjectSchema(
  schema: JsonSchema | undefined,
  schemas: Record<string, JsonSchema>,
  resolving: ReadonlySet<string> = new Set(),
): boolean {
  if (!schema) return false;
  if (schema.$ref) {
    if (resolving.has(schema.$ref)) return false;
    const target = localRef(schema.$ref, schemas);
    if (!target) return false;
    const next = new Set(resolving);
    next.add(schema.$ref);
    return isObjectSchema(target, schemas, next);
  }
  const types = Array.isArray(schema.type) ? schema.type : schema.type ? [schema.type] : [];
  if (types.includes("object") || schema.properties) return true;
  if (schema.allOf?.length) return schema.allOf.every((part) => isObjectSchema(part, schemas, resolving));
  return false;
}

function localRef(ref: string, schemas: Record<string, JsonSchema>): JsonSchema | undefined {
  const prefix = "#/components/schemas/";
  if (!ref.startsWith(prefix)) return undefined;
  return schemas[decodeURIComponent(ref.slice(prefix.length).replace(/~1/g, "/").replace(/~0/g, "~"))];
}

function literal(value: unknown): ZodTypeAny {
  if (value === null) return z.null();
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return z.literal(value);
  return z.unknown();
}

function nullable(base: ZodTypeAny, schema: JsonSchema): ZodTypeAny {
  const types = Array.isArray(schema.type) ? schema.type : schema.type ? [schema.type] : [];
  return schema.nullable || types.includes("null") ? base.nullable() : base;
}

function withDescription(base: ZodTypeAny, description?: string): ZodTypeAny {
  return description ? base.describe(description) : base;
}

function describe(op: Operation): string {
  const lines: string[] = [];
  if (op.summary) lines.push(op.summary);
  if (op.description && op.description !== op.summary) lines.push(op.description);
  if (op.tags.length) lines.push(`Categoria: ${op.tags.join(", ")}.`);
  return lines.join(" ") || op.operationId;
}

/**
 * Boolean robusto p/ param de query: aceita o boolean nativo E as strings
 * "true"/"false". Corrige o footgun do `z.coerce.boolean()`, em que TODA string
 * não-vazia — inclusive "false" — vira `true` (BUG-0017). Hoje nenhum param do
 * contrato é `type: boolean`, mas isto blinda o gerador p/ quando algum surgir.
 */
function boolish(): ZodTypeAny {
  return z.preprocess((v) => {
    if (typeof v === "string") {
      const s = v.trim().toLowerCase();
      if (s === "true") return true;
      if (s === "false") return false;
    }
    return v;
  }, z.boolean());
}

/**
 * Numérico p/ param de query: z.coerce.number() cru coage "" → 0 (Number("")===0),
 * então um param OPCIONAL enviado vazio (o LLM sinalizando "sem filtro") viraria
 * filtro `=0` em vez de ausente (recorrência do BUG-0037 na camada client,
 * BUG-0064) — validação equivalente à do servidor, espelhada aqui pq o client
 * roda fora dele. String vazia/branca → AUSENTE; .finite() rejeita Infinity/NaN.
 */
function numeric(required: boolean): ZodTypeAny {
  const inner = required ? z.coerce.number().finite() : z.coerce.number().finite().optional();
  return z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), inner);
}

export function zodFor(p: ParamSpec): ZodTypeAny {
  let base: ZodTypeAny;
  let isNumeric = false;
  if (p.enum && p.enum.length > 0) {
    base = z.enum(p.enum as [string, ...string[]]);
  } else if (p.type === "number" || p.type === "integer") {
    base = numeric(p.required);
    isNumeric = true;
  } else if (p.type === "boolean") {
    base = boolish();
  } else {
    base = z.string();
  }

  const hints: string[] = [];
  if (p.description) hints.push(p.description);
  if (p.default !== undefined) hints.push(`default: ${String(p.default)}`);
  if (hints.length) base = base.describe(hints.join(" — "));

  // numeric() já embute o optional (o preprocess precisa decidir "" → undefined
  // ANTES do .optional() de fora julgar o valor bruto, senão "" nunca chega a
  // ser convertida e o inner schema recebe undefined sem saber lidar com ele).
  if (isNumeric) return base;
  return p.required ? base : base.optional();
}

function stringify(body: unknown): string {
  try {
    return JSON.stringify(body, null, 2);
  } catch {
    return String(body);
  }
}
