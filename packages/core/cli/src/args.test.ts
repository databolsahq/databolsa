import { expect, test } from "bun:test";
import { bindArgs, CliError, nearest } from "./args";
import type { CommandSpec } from "./commands";

/**
 * O espécime de comando SÓ COM OPÇÕES — nenhum posicional, um enum obrigatório, um padrão de
 * data, um inteiro com faixa e um booleano. Era `getMarketExpectations` até 03/09/2026, quando a
 * rota saiu do contrato; `rankObjects` tem a mesma forma e os parâmetros aqui são os DELE.
 */
const rank: CommandSpec = {
  operationId: "rankObjects",
  path: "/v1/objects/rank",
  method: "get",
  tags: ["objects"],
  positionals: [],
  options: [
    { name: "kind", in: "query", required: true, type: "string", enum: ["company", "equity_security", "fund", "instrument", "data_series"] },
    { name: "fact", in: "query", required: true, type: "string" },
    { name: "measure", in: "query", required: false, type: "string", enum: ["value", "delta", "pct_change"] },
    { name: "at", in: "query", required: false, type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
    { name: "limit", in: "query", required: false, type: "integer", minimum: 1, maximum: 200 },
    { name: "exclude_out_of_prior", in: "query", required: false, type: "boolean" },
  ],
};

/** O mínimo que satisfaz os dois obrigatórios — o resto de cada teste vem depois. */
const BASE = ["--kind", "equity_security", "--fact", "close"];

const stock: CommandSpec = {
  operationId: "getStockIndicators",
  path: "/v1/stocks/{ticker}/indicators",
  method: "get",
  tags: ["stocks"],
  positionals: [
    { name: "ticker", in: "path", required: true, type: "string", pattern: "^[A-Z][A-Z0-9]{3}[0-9]{0,2}$" },
  ],
  options: [],
};

/** Executa e devolve a mensagem do CliError (falha o teste se não estourar). */
function messageOf(spec: CommandSpec, rest: string[]): string {
  try {
    bindArgs(spec, rest);
  } catch (err) {
    expect(err).toBeInstanceOf(CliError);
    return (err as CliError).message;
  }
  throw new Error(`esperava CliError para: ${rest.join(" ")}`);
}

// ── enum ──────────────────────────────────────────────────────────────────────

test("enum inequívoco aceita outra caixa e normaliza para o valor do contrato", () => {
  expect(bindArgs(rank, [...BASE, "--measure", "DELTA"]).query.measure).toBe("delta");
  expect(bindArgs(rank, [...BASE, "--measure=Pct_change"]).query.measure).toBe("pct_change");
});

test("enum inválido nomeia o valor rejeitado e lista os aceitos", () => {
  const msg = messageOf(rank, [...BASE, "--measure", "variacao"]);
  expect(msg).toContain('"variacao"');
  expect(msg).toContain("--measure");
  expect(msg).toContain("value, delta, pct_change");
});

test("enum inválido sugere o valor mais próximo", () => {
  expect(messageOf(rank, [...BASE, "--measure", "delat"])).toContain("delta");
});

// ── pattern ───────────────────────────────────────────────────────────────────

test("data fora do formato diz qual é o formato esperado", () => {
  const msg = messageOf(rank, [...BASE, "--at", "24/07/2026"]);
  expect(msg).toContain('"24/07/2026"');
  expect(msg).toContain("--at");
  expect(msg).toContain("AAAA-MM-DD");
});

test("valor vazio numa flag com padrão continua sendo ignorado (não vira erro)", () => {
  expect(bindArgs(rank, [...BASE, "--at="]).query.at).toBe("");
});

test("posicional só com a caixa errada é normalizado (petr4 → PETR4)", () => {
  expect(bindArgs(stock, ["petr4"]).path).toBe("/v1/stocks/PETR4/indicators");
});

test("posicional que não é ticker explica o formato em vez de deixar a API dar 400", () => {
  const msg = messageOf(stock, ["Petrobras ON"]);
  expect(msg).toContain('"Petrobras ON"');
  expect(msg).toContain("<ticker>");
  expect(msg).toContain("PETR4");
});

// ── flags e argumentos ────────────────────────────────────────────────────────

test("opção desconhecida sugere a próxima e lista as válidas", () => {
  const msg = messageOf(rank, [...BASE, "--measures", "delta"]);
  expect(msg).toContain("--measures");
  expect(msg).toContain("--measure");
});

test("opção obrigatória ausente diz quais valores ela aceita", () => {
  const msg = messageOf(rank, ["--fact", "close"]);
  expect(msg).toContain("--kind");
  expect(msg).toContain("company, equity_security");
});

test("valor faltando numa opção de enum já lista os aceitos", () => {
  expect(messageOf(rank, [...BASE, "--measure"])).toContain("value, delta, pct_change");
});

test("booleano com valor em token separado não vira posicional", () => {
  const bound = bindArgs(rank, [...BASE, "--exclude_out_of_prior", "false"]);
  expect(bound.query.exclude_out_of_prior).toBe(false);
});

test("booleano com valor sem sentido é rejeitado em vez de virar true", () => {
  expect(messageOf(rank, [...BASE, "--exclude_out_of_prior=talvez"])).toContain("true ou false");
});

test("inteiro fracionário é rejeitado com o valor recebido", () => {
  const msg = messageOf(rank, [...BASE, "--limit", "1.5"]);
  expect(msg).toContain("inteiro");
  expect(msg).toContain('"1.5"');
});

test("faixa numérica do contrato é validada antes da API", () => {
  expect(messageOf(rank, [...BASE, "--limit", "0"])).toContain("maior ou igual a 1");
  expect(messageOf(rank, [...BASE, "--limit", "201"])).toContain("menor ou igual a 200");
  expect(bindArgs(rank, [...BASE, "--limit", "200"]).query.limit).toBe(200);
});

test("posicional faltando mostra a linha de uso", () => {
  const msg = messageOf(stock, []);
  expect(msg).toContain("<ticker>");
  expect(msg).toContain("databolsa getStockIndicators <ticker>");
});

test("posicional sobrando nomeia o que sobrou", () => {
  expect(messageOf(stock, ["PETR4", "VALE3"])).toContain('"VALE3"');
});

// ── sugestão ──────────────────────────────────────────────────────────────────

test("nearest sugere só quando o palpite é plausível", () => {
  expect(nearest("listObject", ["listObjects", "listObjectLinks"])).toBe("listObjects");
  expect(nearest("carteira", ["listObjects", "listObjectLinks"])).toBeUndefined();
});
