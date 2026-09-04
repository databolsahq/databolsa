/**
 * Projeção compartilhada do contrato OpenAPI para clientes e agentes.
 *
 * Este módulo é deliberadamente puro: não lê arquivos, não acessa a rede e não
 * conhece MCP, CLI ou Agents SDK. Cada consumidor carrega o documento como
 * preferir e converte estas operações para a sua própria interface.
 */

export interface ParamSpec {
  name: string;
  in: "path" | "query" | "body";
  required: boolean;
  type: "string" | "number" | "integer" | "boolean" | "object" | "array";
  description?: string;
  enum?: string[];
  pattern?: string;
  default?: unknown;
  items?: ParamSpec["type"];
  /** Forma compacta de objetos e itens de arrays; `*` marca campo obrigatório. */
  shape?: string;
  minimum?: number;
  maximum?: number;
}

export interface JsonSchema {
  $ref?: string;
  type?: string | string[];
  format?: string;
  description?: string;
  enum?: unknown[];
  const?: unknown;
  pattern?: string;
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
  path: string;
  method: "get" | "post" | "put" | "patch" | "delete";
  summary?: string;
  description?: string;
  tags: string[];
  capability?: string;
  lifecycle?: string;
  params: ParamSpec[];
  responseSchema?: JsonSchema;
  schemas?: Record<string, JsonSchema>;
}

interface RawParam {
  name: string;
  in: string;
  required?: boolean;
  description?: string;
  schema?: JsonSchema;
}

interface RawOperation {
  operationId?: string;
  summary?: string;
  description?: string;
  tags?: string[];
  "x-capability"?: string;
  "x-lifecycle"?: string;
  parameters?: RawParam[];
  requestBody?: {
    content?: Record<string, { schema?: JsonSchema }>;
  };
  responses?: Record<string, { content?: Record<string, { schema?: JsonSchema }> }>;
}

const METHODS = ["get", "post", "put", "patch", "delete"] as const;

/** Extrai uma representação única para MCP, agente e CLI. */
export function extractOperations(spec: unknown): Operation[] {
  const document = spec as {
    paths?: Record<string, Record<string, unknown>>;
    components?: { schemas?: Record<string, JsonSchema> };
  };
  const schemas = document.components?.schemas ?? {};
  const operations: Operation[] = [];

  for (const [path, item] of Object.entries(document.paths ?? {})) {
    for (const method of METHODS) {
      const raw = item[method] as RawOperation | undefined;
      if (!raw?.operationId) continue;

      const params = (raw.parameters ?? [])
        .map((param) => toParamSpec(param, schemas))
        .filter((param): param is ParamSpec => param !== null);

      const bodySchema = resolveRef(
        raw.requestBody?.content?.["application/json"]?.schema,
        schemas,
      );
      const requiredBody = new Set(bodySchema?.required ?? []);
      for (const [name, schema] of Object.entries(bodySchema?.properties ?? {})) {
        params.push(specFrom(name, "body", requiredBody.has(name), schema, schemas));
      }

      operations.push({
        operationId: raw.operationId,
        path,
        method,
        summary: raw.summary,
        description: raw.description,
        tags: raw.tags ?? [],
        capability: raw["x-capability"],
        lifecycle: raw["x-lifecycle"],
        params,
        responseSchema: successResponseSchema(raw),
        schemas,
      });
    }
  }

  return operations.sort((a, b) => a.operationId.localeCompare(b.operationId));
}

/** Texto autoral único usado por todas as definitions de tool. */
export function describeOperation(operation: Operation): string {
  const parts: string[] = [];
  if (operation.summary?.trim()) parts.push(operation.summary.trim());
  if (
    operation.description?.trim() &&
    operation.description.trim() !== operation.summary?.trim()
  ) {
    parts.push(operation.description.trim());
  }
  if (operation.tags.length > 0) parts.push(`Categoria: ${operation.tags.join(", ")}.`);
  return parts.join(" ") || operation.operationId;
}

function resolveRef(
  schema: JsonSchema | undefined,
  schemas: Record<string, JsonSchema>,
  depth = 0,
): JsonSchema | undefined {
  if (depth > 8) return schema;
  if (schema?.allOf?.length === 1 && !schema.type && !schema.properties) {
    const inner = resolveRef(schema.allOf[0], schemas, depth + 1);
    return inner ? { ...inner, description: schema.description ?? inner.description } : schema;
  }
  if (!schema?.$ref) return schema;
  const prefix = "#/components/schemas/";
  if (!schema.$ref.startsWith(prefix)) return schema;
  const key = decodeURIComponent(
    schema.$ref.slice(prefix.length).replace(/~1/g, "/").replace(/~0/g, "~"),
  );
  const target = schemas[key];
  if (!target) return schema;
  const resolved = resolveRef(target, schemas, depth + 1);
  return resolved ? { ...resolved, description: schema.description ?? resolved.description } : schema;
}

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
  const structured =
    type === "array" ? resolveRef(schema.items, schemas) : type === "object" ? schema : undefined;

  return {
    name,
    in: where,
    required,
    type,
    description: description ?? schema.description,
    enum: Array.isArray(schema.enum) ? schema.enum.map(String) : undefined,
    pattern: typeof schema.pattern === "string" ? schema.pattern : undefined,
    default: schema.default,
    items,
    shape: summarizeShape(structured, schemas),
    minimum: typeof schema.minimum === "number" ? schema.minimum : undefined,
    maximum: typeof schema.maximum === "number" ? schema.maximum : undefined,
  };
}

function summarizeShape(
  schema: JsonSchema | undefined,
  schemas: Record<string, JsonSchema>,
): string | undefined {
  const target = resolveRef(schema, schemas);
  if (!target?.properties) return undefined;
  const required = new Set(target.required ?? []);
  const fields = Object.entries(target.properties).map(([name, definition]) => {
    const resolved = resolveRef(definition, schemas) ?? {};
    const marker = required.has(name) ? "*" : "";
    const detail = Array.isArray(resolved.enum)
      ? resolved.enum.map(String).join("|")
      : normalizeType(resolved);
    return `${name}${marker} (${detail})`;
  });
  return fields.length > 0
    ? `campos: ${fields.join(", ")} — * é obrigatório`
    : undefined;
}

function successResponseSchema(operation: RawOperation): JsonSchema | undefined {
  const successes = Object.entries(operation.responses ?? {})
    .filter(([status]) => /^2\d\d$/.test(status))
    .sort(([left], [right]) => Number(left) - Number(right));
  for (const [, response] of successes) {
    const schema = response.content?.["application/json"]?.schema;
    if (schema) return schema;
  }
  return undefined;
}

function toParamSpec(
  param: RawParam,
  schemas: Record<string, JsonSchema>,
): ParamSpec | null {
  if (param.in !== "path" && param.in !== "query") return null;
  return specFrom(
    param.name,
    param.in,
    param.required ?? param.in === "path",
    param.schema,
    schemas,
    param.description,
  );
}

function normalizeType(schema: JsonSchema): ParamSpec["type"] {
  const declared = Array.isArray(schema.type)
    ? schema.type.find((type) => type !== "null")
    : schema.type;
  if (declared === "integer") return "integer";
  if (declared === "number") return "number";
  if (declared === "boolean") return "boolean";
  if (declared === "array" || (!declared && schema.items)) return "array";
  if (declared === "object" || (!declared && schema.properties)) return "object";
  return "string";
}
