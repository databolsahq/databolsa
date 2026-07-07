/**
 * Converte cada operação do OpenAPI em uma tool MCP: input schema (Zod) a
 * partir dos parâmetros (path + query) e um handler que reescreve o path,
 * monta a query e chama a API. 501/404 viram texto "fora do preview" — espelha
 * o `NotInPreviewError` do SDK — em vez de explodir.
 */
import { z, type ZodTypeAny } from "zod";
import type { ApiClient } from "./api-client";
import type { Operation, ParamSpec } from "./openapi";

export interface ToolResult {
  content: { type: "text"; text: string }[];
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

  return {
    name: op.operationId,
    config: { title: op.summary, description: describe(op), inputSchema },
    handler: async (args) => {
      let path = op.path;
      const query: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(args ?? {})) {
        if (value === undefined) continue;
        if (pathParams.has(key)) path = path.replace(`{${key}}`, encodeURIComponent(String(value)));
        else query[key] = value;
      }

      const res = await api.get(path, query);
      if (res.ok) return { content: [{ type: "text", text: stringify(res.body) }] };

      const preview = res.status === 501 || res.status === 404;
      const text = preview
        ? `Recurso não disponível neste preview da API (HTTP ${res.status})${res.detail ? `: ${res.detail}` : ""}.`
        : `Erro da API (HTTP ${res.status})${res.detail ? `: ${res.detail}` : ""}.`;
      return { content: [{ type: "text", text }], isError: true };
    },
  };
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

export function zodFor(p: ParamSpec): ZodTypeAny {
  let base: ZodTypeAny;
  if (p.enum && p.enum.length > 0) {
    base = z.enum(p.enum as [string, ...string[]]);
  } else if (p.type === "number" || p.type === "integer") {
    base = z.coerce.number();
  } else if (p.type === "boolean") {
    base = boolish();
  } else {
    base = z.string();
  }

  const hints: string[] = [];
  if (p.description) hints.push(p.description);
  if (p.default !== undefined) hints.push(`default: ${String(p.default)}`);
  if (hints.length) base = base.describe(hints.join(" — "));

  return p.required ? base : base.optional();
}

function stringify(body: unknown): string {
  try {
    return JSON.stringify(body, null, 2);
  } catch {
    return String(body);
  }
}
