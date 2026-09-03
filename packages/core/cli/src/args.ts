/**
 * Parser de argv, sem dependência. Duas etapas:
 *
 *  1. `parseGlobals()` — varre os tokens, captura as flags globais
 *     (`--json`, `--help/-h`, `--list`, `--version`, `--api-url <url>`),
 *     elege o primeiro token livre como comando e devolve o resto cru.
 *  2. `bindArgs(spec, rest)` — já com o `CommandSpec` resolvido (sabemos quais
 *     opções são booleanas), liga posicionais aos params de path e `--flags`
 *     aos de query, coage por tipo e substitui no path.
 *
 * Toda mensagem de erro de uso nomeia o valor rejeitado E o que é aceito. Esta
 * CLI também é dirigida por agentes: mensagem genérica ("veja a ajuda") custa
 * uma rodada inteira de tentativa e erro para quem não pode ler o help.
 */
import { usageLine, type CommandSpec } from "./commands";
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
  /** params de query, já coagidos. Sempre escalares: o contrato não tem param de
   *  query estruturado, e a query string não teria como carregá-lo. */
  query: Record<string, string | number | boolean>;
  /** params `in: body` (operações de escrita), já coagidos. Objeto/array aqui já vêm
   *  desserializados de JSON — ver `parseStructured`. */
  body: Record<string, unknown>;
}

export function bindArgs(spec: CommandSpec, rest: string[]): BoundArgs {
  const positionals: string[] = [];
  // Acumulador largo: as flags de query e de body chegam misturadas (ambas são
  // `--flag`) e só são separadas no fim. Um param estruturado — objeto/array — existe
  // hoje apenas em body, mas o tipo tem de comportá-lo até a separação acontecer.
  const query: Record<string, unknown> = {};
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
      if (!opt) throw new CliError(unknownOptionMessage(name, spec), spec);

      if (opt.type === "boolean") {
        // `--flag false` (valor em token separado) caía no ramo de posicionais e
        // estourava "argumentos demais"; só consumimos o próximo se for booleano.
        if (value === undefined && isBooleanLiteral(rest[i + 1])) {
          value = rest[i + 1];
          i++;
        }
        query[name] = value === undefined ? true : parseBoolean(opt, value, spec);
        continue;
      }

      if (value === undefined) {
        const next = rest[i + 1];
        if (next === undefined || next.startsWith("--")) {
          throw new CliError(`A opção --${name} requer um valor${acceptedSuffix(opt)}.`, spec);
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
    const head = missing.length === 1 ? "Falta o argumento" : "Faltam os argumentos";
    throw new CliError(`${head} ${missing.join(", ")} em ${usageLine(spec)}.`, spec);
  }
  if (positionals.length > spec.positionals.length) {
    const extra = positionals.slice(spec.positionals.length).map(quote);
    const head = extra.length === 1 ? "Argumento inesperado" : "Argumentos inesperados";
    throw new CliError(`${head}: ${extra.join(", ")} — ${usageLine(spec)} aceita ${spec.positionals.length}.`, spec);
  }

  const missingOpts = spec.options.filter((o) => o.required && !(o.name in query));
  if (missingOpts.length) {
    const head = missingOpts.length === 1 ? "Falta a opção obrigatória" : "Faltam as opções obrigatórias";
    throw new CliError(
      `${head}: ${missingOpts.map((o) => `--${o.name}${acceptedSuffix(o)}`).join("; ")}.`,
      spec,
    );
  }

  let path = spec.path;
  spec.positionals.forEach((p, idx) => {
    // Posicionais também passam pelo coerce: antes iam crus para o path e um
    // ticker em minúscula só falhava na API, com 400 sem instrução.
    const value = String(coerce(p, positionals[idx]!, spec));
    path = path.replace(`{${p.name}}`, encodeURIComponent(value));
  });

  // separa as flags de body (escrita) das de query — ambas chegam como --flag
  const bodyNames = new Set(spec.options.filter((o) => o.in === "body").map((o) => o.name));
  const body: Record<string, unknown> = {};
  for (const name of Object.keys(query)) {
    if (bodyNames.has(name)) {
      body[name] = query[name]!;
      delete query[name];
    }
  }

  // Depois da separação, o que restou em `query` é escalar por construção: só params
  // de body podem ser objeto/array no contrato, e eles acabaram de sair daqui.
  return { path, query: query as Record<string, string | number | boolean>, body };
}

function coerce(p: ParamSpec, value: string, spec: CommandSpec): string | number | boolean | unknown[] | object {
  const label = paramLabel(p);
  if (p.enum && p.enum.length) return matchEnum(p, value, label, spec);
  // Param estruturado (objeto/array) chega da linha de comando sempre como texto:
  // `--doc '{"kind":"report",...}'`, `--ids '["a","b"]'`. Sem este parse o corpo saía
  // com o JSON como STRING e o servidor recusava — era o mesmo defeito do MCP, e
  // deixava `theses create` inutilizável pela CLI.
  if (p.type === "object" || p.type === "array") return parseStructured(p, value, label, spec);
  if (p.type === "number" || p.type === "integer") {
    const n = Number(value);
    // Number("") === 0 e Number("Infinity") === Infinity passariam num teste de NaN;
    // exigimos um número finito e não-vazio para não mandar 0/Infinity silenciosos.
    if (value.trim() === "" || !Number.isFinite(n)) {
      throw new CliError(`${label} espera um número, recebi ${quote(value)}.`, spec);
    }
    if (p.type === "integer" && !Number.isInteger(n)) {
      throw new CliError(`${label} espera um número inteiro, recebi ${quote(value)}.`, spec);
    }
    if (p.minimum !== undefined && n < p.minimum) {
      throw new CliError(`${label} deve ser maior ou igual a ${p.minimum}, recebi ${n}.`, spec);
    }
    if (p.maximum !== undefined && n > p.maximum) {
      throw new CliError(`${label} deve ser menor ou igual a ${p.maximum}, recebi ${n}.`, spec);
    }
    return n;
  }
  if (p.type === "boolean") return parseBoolean(p, value, spec);
  return matchPattern(p, value, label, spec);
}

/**
 * JSON da linha de comando → valor estruturado, com erro que diz o que veio errado.
 * Um JSON inválido aqui é erro do usuário e tem de ser dito no cliente; mandar a
 * string crua faria o servidor devolver 400 sem apontar o problema real.
 */
function parseStructured(p: ParamSpec, value: string, label: string, spec: CommandSpec): unknown[] | object {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch (err) {
    throw new CliError(
      `${label} espera JSON ${p.type === "array" ? "de lista" : "de objeto"} e não pôde ser lido: ` +
        `${(err as Error).message}. Dica: para arquivos grandes use o comando de importação, ` +
        `que recebe o caminho em vez do conteúdo.`,
      spec,
    );
  }
  if (p.type === "array" && !Array.isArray(parsed)) {
    throw new CliError(`${label} espera uma lista JSON (ex.: '["a","b"]'), recebi ${typeof parsed}.`, spec);
  }
  if (p.type === "object" && (typeof parsed !== "object" || parsed === null || Array.isArray(parsed))) {
    throw new CliError(`${label} espera um objeto JSON (ex.: '{"campo":1}'), recebi ${typeof parsed}.`, spec);
  }
  return parsed as unknown[] | object;
}

/** `--flag` para query/body, `<nome>` para posicional de path. */
function paramLabel(p: ParamSpec): string {
  return p.in === "path" ? `<${p.name}>` : `--${p.name}`;
}

function quote(value: string): string {
  return `"${value}"`;
}

function matchEnum(p: ParamSpec, value: string, label: string, spec: CommandSpec): string {
  const values = p.enum!;
  if (values.includes(value)) return value;

  // Enum cujos valores se distinguem sem depender de caixa: aceitamos `--indicator IPCA`
  // e normalizamos para `ipca`. Quem chama não tem como adivinhar a caixa do contrato,
  // e rejeitar só por isso não protege nada.
  const insensitive = new Set(values.map((v) => v.toLowerCase())).size === values.length;
  const hit = values.find((v) => v.toLowerCase() === value.toLowerCase());
  if (insensitive && hit) return hit;

  const guess = nearest(value, values);
  throw new CliError(
    `Valor inválido ${quote(value)} para ${label}; use: ${values.join(", ")}.` +
      (guess ? ` Você quis dizer ${quote(guess)}?` : ""),
    spec,
  );
}

/**
 * O contrato fixa a caixa de tickers (PETR4) e de slugs (renda-fixa). Quando só a
 * caixa separa o valor do padrão, corrigimos aqui — é inequívoco e evita um 400 da
 * API sem instrução. Fora disso, a mensagem descreve o formato esperado.
 */
function matchPattern(p: ParamSpec, value: string, label: string, spec: CommandSpec): string {
  if (!p.pattern) return value;
  // Valor vazio (`--from "$VAR"` com a var não definida) já era descartado antes de
  // virar querystring; validá-lo aqui quebraria scripts que sempre passam a flag.
  if (value === "") return value;
  let re: RegExp;
  try {
    re = new RegExp(p.pattern);
  } catch {
    return value; // padrão que o JS não compila: deixa a API validar.
  }
  if (re.test(value)) return value;
  for (const alt of [value.toUpperCase(), value.toLowerCase()]) {
    if (alt !== value && re.test(alt)) return alt;
  }
  throw new CliError(`Valor inválido ${quote(value)} para ${label}; ${patternHint(p.pattern)}.`, spec);
}

const ISO_DATE_PATTERN = "^\\d{4}-\\d{2}-\\d{2}$";
const TICKER_PATTERN = "^[A-Z][A-Z0-9]{3}[0-9]{0,2}$";

function patternHint(pattern: string): string {
  if (pattern === ISO_DATE_PATTERN) return "use uma data no formato AAAA-MM-DD (ex.: 2026-07-24)";
  if (pattern === TICKER_PATTERN) return "use um código de negociação da B3 (ex.: PETR4, HGLG11)";
  return `o valor precisa casar com ${pattern}`;
}

const BOOL_TRUE = new Set(["true", "1"]);
const BOOL_FALSE = new Set(["false", "0"]);

function isBooleanLiteral(token: string | undefined): boolean {
  if (token === undefined) return false;
  const v = token.toLowerCase();
  return BOOL_TRUE.has(v) || BOOL_FALSE.has(v);
}

function parseBoolean(p: ParamSpec, value: string, spec: CommandSpec): boolean {
  const v = value.toLowerCase();
  if (BOOL_TRUE.has(v)) return true;
  if (BOOL_FALSE.has(v)) return false;
  // Antes qualquer coisa != "false" virava true: `--adjusted=nao` ligava a flag.
  throw new CliError(`${paramLabel(p)} espera true ou false, recebi ${quote(value)}.`, spec);
}

/** Sufixo que enumera o que a opção aceita — enum, formato ou tipo. */
function acceptedSuffix(p: ParamSpec): string {
  if (p.enum && p.enum.length) return ` (use: ${p.enum.join(", ")})`;
  if (p.pattern) return ` (${patternHint(p.pattern)})`;
  if (p.type === "integer") return " (número inteiro)";
  if (p.type === "number") return " (número)";
  return "";
}

/** Acima disso, listar todas as opções vira ruído — o --help é melhor destino. */
const MAX_LISTED_OPTIONS = 12;

function unknownOptionMessage(name: string, spec: CommandSpec): string {
  const names = spec.options.map((o) => o.name);
  const guess = nearest(name, names);
  const where = !names.length
    ? "esta operação não aceita opções"
    : names.length <= MAX_LISTED_OPTIONS
      ? `opções: ${names.map((n) => `--${n}`).join(", ")}`
      : `veja as opções em: databolsa ${spec.operationId} --help`;
  return (
    `Opção desconhecida --${name} em ${spec.operationId}.` +
    (guess ? ` Você quis dizer --${guess}?` : "") +
    ` (${where})`
  );
}

/**
 * Melhor candidato por distância de edição, ou `undefined` quando o palpite não
 * é plausível — sugerir qualquer coisa é pior que não sugerir nada.
 */
export function nearest(value: string, candidates: string[]): string | undefined {
  const v = value.toLowerCase();
  let best: string | undefined;
  let bestScore = Number.POSITIVE_INFINITY;
  for (const c of candidates) {
    const d = editDistance(v, c.toLowerCase());
    if (d < bestScore) {
      bestScore = d;
      best = c;
    }
  }
  // Tolerância proporcional: 1 erro em nomes curtos, ~1/3 em nomes longos.
  return bestScore <= Math.max(1, Math.floor(value.length / 3)) ? best : undefined;
}

function editDistance(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min(row[j - 1]! + 1, prev[j]! + 1, prev[j - 1]! + cost);
    }
    prev = row;
  }
  return prev[b.length]!;
}
