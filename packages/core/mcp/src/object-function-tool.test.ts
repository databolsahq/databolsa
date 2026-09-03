import { describe, expect, test } from "bun:test";
import { buildObjectFunctionTool, OBJECT_FUNCTION_TOOL_NAME, sessaoComGrafo } from "./object-function-tool";
import { catalogoDeFuncoes, FUNCOES_DO_REGISTRY, inputsDoContrato, TETO_DO_CATALOGO } from "./object-function";
import type { Operation } from "./openapi";

const op = (operationId: string, params: Operation["params"] = []): Operation => ({
  operationId,
  path: `/v1/x/${operationId}`,
  method: "get",
  tags: [],
  params,
});

describe("executeObjectFunction no MCP", () => {
  test("só entra quando a sessão enxerga o grafo — perfil sem getObject fica sem a tool", () => {
    expect(sessaoComGrafo([op("getObject"), op("listQuotes")])).toBe(true);
    expect(sessaoComGrafo([op("listQuotes"), op("getStockIndicators")])).toBe(false);
  });

  test("a tool é leitura pura e valida o input ANTES de qualquer chamada", async () => {
    const tool = buildObjectFunctionTool({
      baseUrl: "https://api.example.test",
      apiKey: "k",
      operations: [op("listQuotes", [{ name: "ticker", in: "path", type: "string", required: true }, { name: "from", in: "query", type: "string", required: false }])],
    });
    expect(tool.name).toBe(OBJECT_FUNCTION_TOOL_NAME);
    expect(tool.config.annotations).toEqual({ readOnlyHint: true, openWorldHint: false, destructiveHint: false });
    // `bogus` não é input de market.quotes.history: a recusa precisa vir da validação, sem
    // rede — o teste não tem servidor nenhum atrás de api.example.test.
    const r = await tool.handler({ subject: { resolve: "PETR4" }, function: "market.quotes.history", input: { bogus: 1 } });
    expect(r.isError).toBe(true);
    expect((r.content[0] as { text: string }).text).toContain("não é input de market.quotes.history");
  });

  test("o catálogo de funções vai na descrição — o cliente lê o registry antes de escolher", () => {
    const tool = buildObjectFunctionTool({ baseUrl: "https://api.example.test", operations: [] });
    expect(tool.config.description).toContain("market.quotes.history");
    expect(tool.config.description).toContain("credit.regulation.terms");
  });
});

describe("o catálogo na descrição não vira enumeração longa", () => {
  const inputs = inputsDoContrato([op("listQuotes", [{ name: "from", in: "query", type: "string", required: false }])]);

  test("abaixo do teto: a linha por função, com tipos e inputs", () => {
    const texto = catalogoDeFuncoes(inputs);
    expect(texto).toContain("market.quotes.history → ");
    expect(texto).toContain("input: from:string");
    expect(texto).not.toContain("describeCapabilities");
  });

  test("acima do teto: só os ids e onde pedir o resto — nem tipos nem inputs", () => {
    const texto = catalogoDeFuncoes(inputs, { teto: 3 });
    // Todos os ids continuam publicados: quem já sabe o nome não perde a chamada.
    for (const id of FUNCOES_DO_REGISTRY) expect(texto).toContain(id);
    expect(texto).not.toContain("input:");
    expect(texto).not.toContain("→");
    expect(texto).toContain("aspects de getObject");
    expect(texto).toContain("describeCapabilities");
  });

  test("o teto default fica acima das funções de hoje — nada muda no prompt agora", () => {
    expect(FUNCOES_DO_REGISTRY.length).toBeLessThanOrEqual(TETO_DO_CATALOGO);
    expect(catalogoDeFuncoes(inputs)).toBe(catalogoDeFuncoes(inputs, { teto: TETO_DO_CATALOGO }));
  });
});
