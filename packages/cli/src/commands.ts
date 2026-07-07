/**
 * Converte cada operação do OpenAPI num comando da CLI — o análogo do
 * `buildTools()` do MCP (packages/mcp/src/tools.ts). Parâmetros de path viram
 * argumentos posicionais (na ordem declarada); parâmetros de query viram
 * `--flags`. Sem lógica de negócio: só descreve a superfície e monta a ajuda.
 */
import type { Operation, ParamSpec } from "./openapi";

export interface CommandSpec {
  operationId: string;
  /** chave do spec, ex.: `/v1/stocks/{ticker}` */
  path: string;
  summary?: string;
  description?: string;
  tags: string[];
  /** params `in: path`, na ordem — preenchidos por posicionais. */
  positionals: ParamSpec[];
  /** params `in: query` — preenchidos por `--flags`. */
  options: ParamSpec[];
}

export function buildCommands(operations: Operation[]): Map<string, CommandSpec> {
  const map = new Map<string, CommandSpec>();
  for (const op of operations) {
    map.set(op.operationId, {
      operationId: op.operationId,
      path: op.path,
      summary: op.summary,
      description: op.description,
      tags: op.tags,
      positionals: op.params.filter((p) => p.in === "path"),
      options: op.params.filter((p) => p.in === "query"),
    });
  }
  return map;
}

/** Busca tolerante: operationId exato, depois case-insensitive. */
export function findCommand(commands: Map<string, CommandSpec>, name: string): CommandSpec | undefined {
  const exact = commands.get(name);
  if (exact) return exact;
  const lower = name.toLowerCase();
  for (const [id, spec] of commands) {
    if (id.toLowerCase() === lower) return spec;
  }
  return undefined;
}

function paramSuffix(p: ParamSpec): string {
  const bits: string[] = [];
  if (p.required) bits.push("obrigatório");
  if (p.enum && p.enum.length) bits.push(`opções: ${p.enum.join(", ")}`);
  if (p.default !== undefined) bits.push(`default: ${String(p.default)}`);
  return bits.length ? ` [${bits.join("; ")}]` : "";
}

function typeLabel(p: ParamSpec): string {
  if (p.enum && p.enum.length) return "enum";
  return p.type;
}

export function usageLine(spec: CommandSpec): string {
  const parts = ["databolsa", spec.operationId];
  for (const p of spec.positionals) parts.push(`<${p.name}>`);
  if (spec.options.length) parts.push("[opções]");
  return parts.join(" ");
}

/** Ajuda detalhada de um comando (vai para stdout em `--help`). */
export function commandHelp(spec: CommandSpec): string {
  const lines: string[] = [];
  const headline = spec.summary || spec.description;
  if (headline) lines.push(headline, "");
  lines.push(`Uso: ${usageLine(spec)}`, "");

  if (spec.positionals.length) {
    lines.push("Argumentos:");
    const width = Math.max(...spec.positionals.map((p) => p.name.length));
    for (const p of spec.positionals) {
      const desc = p.description ? ` — ${p.description}` : "";
      lines.push(`  ${p.name.padEnd(width)}  (${typeLabel(p)})${desc}${paramSuffix(p)}`);
    }
    lines.push("");
  }

  if (spec.options.length) {
    lines.push("Opções:");
    const labels = spec.options.map((p) => `--${p.name} <${typeLabel(p)}>`);
    const width = Math.max(...labels.map((l) => l.length));
    spec.options.forEach((p, i) => {
      const desc = p.description ? ` — ${p.description}` : "";
      lines.push(`  ${labels[i]!.padEnd(width)}  ${desc}${paramSuffix(p)}`.trimEnd());
    });
    lines.push("");
  }

  lines.push("Globais: --json  --help, -h  --api-url <url>");
  return lines.join("\n") + "\n";
}

/** Lista todas as operações, agrupadas por tag (vai para stdout em `--list`). */
export function listText(commands: Map<string, CommandSpec>, apiOrigin: string): string {
  const byTag = new Map<string, CommandSpec[]>();
  for (const spec of commands.values()) {
    const tag = spec.tags[0] ?? "outros";
    const list = byTag.get(tag) ?? [];
    list.push(spec);
    byTag.set(tag, list);
  }

  const allIds = [...commands.keys()];
  const width = allIds.length ? Math.max(...allIds.map((id) => id.length)) : 0;

  const lines: string[] = [
    `DataBolsa CLI — ${commands.size} operações (API: ${apiOrigin})`,
    "",
  ];
  for (const tag of [...byTag.keys()].sort()) {
    lines.push(`${tag}`);
    for (const spec of byTag.get(tag)!.sort((a, b) => a.operationId.localeCompare(b.operationId))) {
      lines.push(`  ${spec.operationId.padEnd(width)}  ${spec.summary ?? ""}`.trimEnd());
    }
    lines.push("");
  }
  lines.push("Detalhe de uma operação: databolsa <operação> --help");
  return lines.join("\n") + "\n";
}

export function topUsage(): string {
  return `DataBolsa CLI — cliente de terminal sobre a Serving API aberta.

Uso:
  databolsa <operação> [argumentos] [opções]
  databolsa --list                 lista todas as operações
  databolsa <operação> --help      ajuda de uma operação

Opções globais:
  --json            saída JSON crua (para piping/jq)
  --api-url <url>   sobrescreve DATABOLSA_API_URL
  --help, -h        esta ajuda
  --version         versão da CLI

Ambiente:
  DATABOLSA_API_URL   origem da API (default https://api.databolsa.com)
  DATABOLSA_API_KEY   bearer; obrigatório na API hospedada
                      (crie a chave em databolsa.com/conta)

Exemplos:
  databolsa getStock PETR4
  databolsa screenStocks --sector Bancos --limit 20
  databolsa getStock PETR4 --json | jq .ticker
`;
}
