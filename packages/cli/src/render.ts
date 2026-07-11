/**
 * Renderizador genérico JSON → terminal. Como os comandos são dinâmicos (um
 * por operação do contrato), não há template por operação: inferimos a forma
 * do corpo e escolhemos um layout.
 *
 *  - lista / paginado (`{ data: [...] }`) → tabela de colunas + rodapé de paginação
 *  - objeto único                         → lista chave/valor, com objetos/arrays
 *                                           aninhados "explodidos" e indentados
 *  - escalar / texto                      → impresso direto
 *
 * `--json` curto-circuita para JSON.stringify cru (espelha o MCP), tratado em
 * `index.ts` antes de chegar aqui.
 *
 * Tabelas mantêm a célula compacta (JSON numa linha): explodir dentro de uma
 * coluna quebraria o alinhamento — para o objeto inteiro use `--json | jq`.
 */

const MAX_COLS = 12;
const MAX_CELL = 48;
/** Arrays de escalares até este tamanho (em chars) ficam inline: `[a, b, c]`. */
const INLINE_ARRAY_MAX = 60;
const INDENT = "  ";

const useColor = process.stdout.isTTY === true;
function bold(s: string): string {
  return useColor ? `\x1b[1m${s}\x1b[0m` : s;
}

export function render(body: unknown, json: boolean): string {
  if (json) return JSON.stringify(body, null, 2);
  return pretty(body);
}

function pretty(body: unknown): string {
  if (body === null || body === undefined) return "(vazio)";
  if (typeof body !== "object") return String(body);

  if (Array.isArray(body)) return renderTable(body);

  const obj = body as Record<string, unknown>;
  const arrayKey = listKey(obj);
  if (arrayKey) {
    const table = renderTable(obj[arrayKey] as unknown[]);
    const footer = renderFooter(obj, arrayKey);
    return footer ? `${table}\n\n${footer}` : table;
  }

  return renderKeyValue(obj);
}

/**
 * Detecta a propriedade-lista de um wrapper paginado. O contrato usa `data`
 * (com `meta.next_cursor`); aceitamos também `items`/`results`. Fallback: se há
 * exatamente uma propriedade array, é ela. Senão, não é tabela (chave/valor).
 */
function listKey(obj: Record<string, unknown>): string | null {
  for (const k of ["data", "items", "results"]) {
    if (Array.isArray(obj[k])) return k;
  }
  const arrays = Object.keys(obj).filter((k) => Array.isArray(obj[k]));
  return arrays.length === 1 ? arrays[0]! : null;
}

/** Lista chave/valor para um objeto único, com aninhados explodidos. */
function renderKeyValue(obj: Record<string, unknown>): string {
  return kvLines(obj, 0).join("\n");
}

function pad(level: number): string {
  return INDENT.repeat(level);
}

/**
 * Um valor é "inline" (cabe à direita da chave) quando é escalar, vazio, ou um
 * array só de escalares e curto. Caso contrário vira um bloco indentado abaixo.
 */
function isInlineValue(v: unknown): boolean {
  if (v === null || v === undefined || typeof v !== "object") return true;
  if (Array.isArray(v)) {
    if (v.length === 0) return true;
    const allScalar = v.every((x) => x === null || typeof x !== "object");
    return allScalar && inlineValue(v).length <= INLINE_ARRAY_MAX;
  }
  return Object.keys(v).length === 0;
}

function inlineValue(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (Array.isArray(v)) return `[${v.map((x) => (x === null || x === undefined ? "" : String(x))).join(", ")}]`;
  if (typeof v === "object") return "{}";
  return String(v);
}

function kvLines(obj: Record<string, unknown>, level: number): string[] {
  const keys = Object.keys(obj);
  if (!keys.length) return [`${pad(level)}(objeto vazio)`];

  // alinha só as chaves com valor inline (as de bloco abrem linha própria).
  const inlineKeys = keys.filter((k) => isInlineValue(obj[k]));
  const width = inlineKeys.length ? Math.max(...inlineKeys.map((k) => k.length)) : 0;

  const lines: string[] = [];
  for (const k of keys) {
    const v = obj[k];
    if (isInlineValue(v)) {
      lines.push(`${pad(level)}${bold(k.padEnd(width))}  ${inlineValue(v)}`.trimEnd());
    } else if (Array.isArray(v)) {
      lines.push(`${pad(level)}${bold(k)}`);
      lines.push(...arrayLines(v, level + 1));
    } else {
      lines.push(`${pad(level)}${bold(k)}`);
      lines.push(...kvLines(v as Record<string, unknown>, level + 1));
    }
  }
  return lines;
}

/** Array com objetos (ou itens longos): um marcador `-` por item. */
function arrayLines(arr: unknown[], level: number): string[] {
  const out: string[] = [];
  for (const item of arr) {
    if (isInlineValue(item)) {
      out.push(`${pad(level)}- ${inlineValue(item)}`.trimEnd());
    } else if (Array.isArray(item)) {
      out.push(`${pad(level)}-`);
      out.push(...arrayLines(item, level + 1));
    } else {
      const sub = kvLines(item as Record<string, unknown>, level + 1);
      // o marcador toma o lugar da indentação na primeira linha; as demais
      // já estão em pad(level + 1), alinhando com o conteúdo após "- ".
      sub[0] = `${pad(level)}- ${sub[0]!.trimStart()}`;
      out.push(...sub);
    }
  }
  return out;
}

function renderTable(rows: unknown[]): string {
  if (!rows.length) return "(sem resultados)";

  // linhas escalares (não-objetos) → uma por linha.
  if (rows.every((r) => r === null || typeof r !== "object")) {
    return rows.map((r) => formatCell(r)).join("\n");
  }

  const objects = rows.map((r) => (r && typeof r === "object" && !Array.isArray(r) ? (r as Record<string, unknown>) : { valor: r }));

  // colunas = união das chaves, na ordem de primeira aparição, com teto.
  const cols: string[] = [];
  for (const row of objects) {
    for (const k of Object.keys(row)) {
      if (!cols.includes(k)) cols.push(k);
      if (cols.length >= MAX_COLS) break;
    }
    if (cols.length >= MAX_COLS) break;
  }

  const cells = objects.map((row) => cols.map((c) => formatCell(row[c])));
  const widths = cols.map((c, i) => Math.max(c.length, ...cells.map((row) => row[i]!.length)));

  const sep = (s: string, i: number) => s.padEnd(widths[i]!);
  const header = cols.map((c, i) => bold(sep(c, i))).join("  ");
  const rule = widths.map((w) => "-".repeat(w)).join("  ");
  const lines = cells.map((row) => row.map((cell, i) => sep(cell, i)).join("  ").trimEnd());

  const dropped = objects.reduce((max, row) => Math.max(max, Object.keys(row).length), 0) > cols.length;
  const out = [header, rule, ...lines];
  if (dropped) out.push(`(colunas truncadas em ${MAX_COLS}; use --json para o objeto completo)`);
  return out.join("\n");
}

/** Demais chaves de um wrapper paginado viram um rodapé enxuto. */
function renderFooter(obj: Record<string, unknown>, omit: string): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    if (k === omit) continue;
    if (v === null || v === undefined) continue;
    parts.push(`${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`);
  }
  return parts.join("  ·  ");
}

function formatCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = typeof v === "object" ? JSON.stringify(v) : String(v);
  return truncate(s, MAX_CELL);
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}
