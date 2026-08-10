import { expect, test } from "bun:test";
import { bindArgs, CliError, nearest } from "./args";
import type { CommandSpec } from "./commands";

const expectations: CommandSpec = {
  operationId: "getMarketExpectations",
  path: "/v1/macro/expectations",
  method: "get",
  tags: ["macro"],
  positionals: [],
  options: [
    { name: "indicator", in: "query", required: true, type: "string", enum: ["ipca", "selic", "pib", "cambio"] },
    { name: "reference", in: "query", required: false, type: "string" },
    { name: "from", in: "query", required: false, type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
    { name: "limit", in: "query", required: false, type: "integer" },
    { name: "adjusted", in: "query", required: false, type: "boolean" },
  ],
};

const stock: CommandSpec = {
  operationId: "getStock",
  path: "/v1/stocks/{ticker}",
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
  expect(bindArgs(expectations, ["--indicator", "IPCA"]).query.indicator).toBe("ipca");
  expect(bindArgs(expectations, ["--indicator=Selic"]).query.indicator).toBe("selic");
});

test("enum inválido nomeia o valor rejeitado e lista os aceitos", () => {
  const msg = messageOf(expectations, ["--indicator", "inflacao"]);
  expect(msg).toContain('"inflacao"');
  expect(msg).toContain("--indicator");
  expect(msg).toContain("ipca, selic, pib, cambio");
});

test("enum inválido sugere o valor mais próximo", () => {
  expect(messageOf(expectations, ["--indicator", "selik"])).toContain("selic");
});

// ── pattern ───────────────────────────────────────────────────────────────────

test("data fora do formato diz qual é o formato esperado", () => {
  const msg = messageOf(expectations, ["--indicator", "ipca", "--from", "24/07/2026"]);
  expect(msg).toContain('"24/07/2026"');
  expect(msg).toContain("--from");
  expect(msg).toContain("AAAA-MM-DD");
});

test("valor vazio numa flag com padrão continua sendo ignorado (não vira erro)", () => {
  expect(bindArgs(expectations, ["--indicator", "ipca", "--from="]).query.from).toBe("");
});

test("posicional só com a caixa errada é normalizado (petr4 → PETR4)", () => {
  expect(bindArgs(stock, ["petr4"]).path).toBe("/v1/stocks/PETR4");
});

test("posicional que não é ticker explica o formato em vez de deixar a API dar 400", () => {
  const msg = messageOf(stock, ["Petrobras ON"]);
  expect(msg).toContain('"Petrobras ON"');
  expect(msg).toContain("<ticker>");
  expect(msg).toContain("PETR4");
});

// ── flags e argumentos ────────────────────────────────────────────────────────

test("opção desconhecida sugere a próxima e lista as válidas", () => {
  const msg = messageOf(expectations, ["--indicador", "ipca"]);
  expect(msg).toContain("--indicador");
  expect(msg).toContain("--indicator");
});

test("opção obrigatória ausente diz quais valores ela aceita", () => {
  const msg = messageOf(expectations, ["--reference", "2026"]);
  expect(msg).toContain("--indicator");
  expect(msg).toContain("ipca, selic, pib, cambio");
});

test("valor faltando numa opção de enum já lista os aceitos", () => {
  expect(messageOf(expectations, ["--indicator"])).toContain("ipca, selic, pib, cambio");
});

test("booleano com valor em token separado não vira posicional", () => {
  const bound = bindArgs(expectations, ["--indicator", "ipca", "--adjusted", "false"]);
  expect(bound.query.adjusted).toBe(false);
});

test("booleano com valor sem sentido é rejeitado em vez de virar true", () => {
  expect(messageOf(expectations, ["--indicator", "ipca", "--adjusted=talvez"])).toContain("true ou false");
});

test("inteiro fracionário é rejeitado com o valor recebido", () => {
  const msg = messageOf(expectations, ["--indicator", "ipca", "--limit", "1.5"]);
  expect(msg).toContain("inteiro");
  expect(msg).toContain('"1.5"');
});

test("posicional faltando mostra a linha de uso", () => {
  const msg = messageOf(stock, []);
  expect(msg).toContain("<ticker>");
  expect(msg).toContain("databolsa getStock <ticker>");
});

test("posicional sobrando nomeia o que sobrou", () => {
  expect(messageOf(stock, ["PETR4", "VALE3"])).toContain('"VALE3"');
});

// ── sugestão ──────────────────────────────────────────────────────────────────

test("nearest sugere só quando o palpite é plausível", () => {
  expect(nearest("getStok", ["getStock", "listStocks"])).toBe("getStock");
  expect(nearest("carteira", ["getStock", "listStocks"])).toBeUndefined();
});
