/**
 * Parser de argv, sem dependência. Duas etapas:
 *
 *  1. `parseGlobals()` — varre os tokens, captura as flags globais
 *     (`--json`, `--help/-h`, `--list`, `--version`, `--api-url <url>`),
 *     elege o primeiro token livre como comando e devolve o resto cru.
 *  2. `bindArgs(spec, rest)` — já com o `CommandSpec` resolvido (sabemos quais
 *     opções são booleanas), liga posicionais aos params de path e `--flags`
 *     aos de query, coage por tipo e substitui no path.
 */
import type { CommandSpec } from "./commands";
import type { ParamSpec } from "./openapi";

export class CliError extends Error {
  constructor(
    message: string,
    readonly spec?: CommandSpec,
  ) {
    super(message);
    this.name = "CliError";
  }
}

export interface GlobalArgs {
  command?: string;
  /** tokens após o comando, sem as globais — posicionais + opções do comando. */
  rest: string[];
  json: boolean;
  help: boolean;
  list: boolean;
  version: boolean;
  apiUrl?: string;
}

export function parseGlobals(argv: string[]): GlobalArgs {
  const out: GlobalArgs = { rest: [], json: false, help: false, list: false, version: false };

  for (let i = 0; i < argv.length; i++) {
    const tok = argv[i]!;

    // --api-url <url> | --api-url=<url> (global, consome valor)
    if (tok === "--api-url" || tok.startsWith("--api-url=")) {
      const eq = tok.indexOf("=");
      if (eq >= 0) {
        out.apiUrl = tok.slice(eq + 1);
      } else {
        const next = argv[i + 1];
        if (next === undefined) throw new CliError("--api-url requer um valor (uma URL).");
        out.apiUrl = next;
        i++;
      }
      continue;
    }

    if (tok === "--json") {
      out.json = true;
      continue;
    }
    if (tok === "--help" || tok === "-h") {
      out.help = true;
      continue;
    }
    if (tok === "--list") {
      out.list = true;
      continue;
    }
    if (tok === "--version" || tok === "-v") {
      out.version = true;
      continue;
    }

    // primeiro token livre (não-flag) é o comando; o resto é cru.
    if (out.command === undefined && !tok.startsWith("-")) {
      out.command = tok;
      continue;
    }
    out.rest.push(tok);
  }

  return out;
}

export interface BoundArgs {
  /** path do spec com os posicionais substituídos (ainda com prefixo `/v1`). */
  path: string;
  /** params de query, já coagidos. */
  query: Record<string, string | number | boolean>;
  /** params `in: body` (operações de escrita), já coagidos. */
  body: Record<string, string | number | boolean>;
}

export function bindArgs(spec: CommandSpec, rest: string[]): BoundArgs {
  const positionals: string[] = [];
  const query: Record<string, string | number | boolean> = {};
  const optByName = new Map(spec.options.map((o) => [o.name, o]));

  for (let i = 0; i < rest.length; i++) {
    const tok = rest[i]!;

    if (tok.startsWith("--")) {
      let name = tok.slice(2);
      let value: string | undefined;
      const eq = name.indexOf("=");
      if (eq >= 0) {
        value = name.slice(eq + 1);
        name = name.slice(0, eq);
      }

      const opt = optByName.get(name);
      if (!opt) throw new CliError(`Opção desconhecida: --${name}`, spec);

      if (opt.type === "boolean") {
        query[name] = value === undefined ? true : value !== "false";
        continue;
      }

      if (value === undefined) {
        const next = rest[i + 1];
        if (next === undefined || next.startsWith("--")) {
          throw new CliError(`A opção --${name} requer um valor.`, spec);
        }
        value = next;
        i++;
      }
      query[name] = coerce(opt, value, spec);
      continue;
    }

    positionals.push(tok);
  }

  if (positionals.length < spec.positionals.length) {
    const missing = spec.positionals.slice(positionals.length).map((p) => `<${p.name}>`);
    throw new CliError(`Faltam argumentos: ${missing.join(" ")}`, spec);
  }
  if (positionals.length > spec.positionals.length) {
    throw new CliError(
      `Argumentos demais: esperava ${spec.positionals.length}, recebi ${positionals.length}.`,
      spec,
    );
  }
  for (const opt of spec.options) {
    if (opt.required && !(opt.name in query)) {
      throw new CliError(`Falta a opção obrigatória: --${opt.name}`, spec);
    }
  }

  let path = spec.path;
  spec.positionals.forEach((p, idx) => {
    path = path.replace(`{${p.name}}`, encodeURIComponent(positionals[idx]!));
  });

  // separa as flags de body (escrita) das de query — ambas chegam como --flag
  const bodyNames = new Set(spec.options.filter((o) => o.in === "body").map((o) => o.name));
  const body: Record<string, string | number | boolean> = {};
  for (const name of Object.keys(query)) {
    if (bodyNames.has(name)) {
      body[name] = query[name]!;
      delete query[name];
    }
  }

  return { path, query, body };
}

function coerce(p: ParamSpec, value: string, spec: CommandSpec): string | number | boolean {
  if (p.enum && p.enum.length && !p.enum.includes(value)) {
    throw new CliError(`Valor inválido para --${p.name}: "${value}". Opções: ${p.enum.join(", ")}.`, spec);
  }
  if (p.type === "number" || p.type === "integer") {
    const n = Number(value);
    // Number("") === 0 e Number("Infinity") === Infinity passariam num teste de NaN;
    // exigimos um número finito e não-vazio para não mandar 0/Infinity silenciosos.
    if (value.trim() === "" || !Number.isFinite(n)) {
      throw new CliError(`--${p.name} espera um número, recebi "${value}".`, spec);
    }
    return n;
  }
  if (p.type === "boolean") return value !== "false";
  return value;
}
