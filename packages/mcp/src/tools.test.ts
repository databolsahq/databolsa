import { expect, test } from "bun:test";
import type { ApiClient } from "./api-client";
import type { Operation, ParamSpec } from "./openapi";
import { annotationsFor, buildTools, zodFor, zodForOutput } from "./tools";

// BUG-0017 (2º site): zodFor gerava z.coerce.boolean() p/ params type:boolean —
// "false" virava true. Hoje nenhum param do contrato é boolean (dead), mas o
// gerador deve estar correto p/ quando algum surgir.
test("zodFor(boolean): 'false' → false (não true)", () => {
  const p: ParamSpec = { name: "flag", in: "query", required: false, type: "boolean" };
  const schema = zodFor(p);
  expect(schema.parse("false")).toBe(false);
  expect(schema.parse("true")).toBe(true);
  expect(schema.parse(false)).toBe(false);
  expect(schema.parse(true)).toBe(true);
});

test("zodFor(string) segue string; enum segue enum", () => {
  const s = zodFor({ name: "ticker", in: "query", required: true, type: "string" });
  expect(s.parse("PETR4")).toBe("PETR4");
  const e = zodFor({ name: "adjusted", in: "query", required: false, type: "string", enum: ["raw", "adj"] });
  expect(e.parse("adj")).toBe("adj");
});

// BUG-0064: z.coerce.number() cru coage "" → 0 (Number("")===0). Um param
// numérico OPCIONAL vazio ("sem filtro" do LLM) tem que virar AUSENTE, não 0
// (senão pl_max: "" vira filtro "<=0" — recorrência do BUG-0037 na camada client).
test("zodFor(number, opcional): '' → ausente (undefined), não 0", () => {
  const p: ParamSpec = { name: "pl_max", in: "query", required: false, type: "number" };
  const schema = zodFor(p);
  expect(schema.parse("")).toBeUndefined();
  expect(schema.parse("   ")).toBeUndefined();
  expect(schema.parse(undefined)).toBeUndefined();
});

test("zodFor(number, opcional): string numérica válida converte", () => {
  const p: ParamSpec = { name: "pl_max", in: "query", required: false, type: "number" };
  const schema = zodFor(p);
  expect(schema.parse("12.5")).toBe(12.5);
});

test("zodFor(number, opcional): não-finito (Infinity/NaN) é rejeitado", () => {
  const p: ParamSpec = { name: "pl_max", in: "query", required: false, type: "number" };
  const schema = zodFor(p);
  expect(() => schema.parse("Infinity")).toThrow();
  expect(() => schema.parse("not-a-number")).toThrow();
});

test("zodForOutput resolve refs, obrigatórios e nullable", () => {
  const schema = zodForOutput(
    { $ref: "#/components/schemas/Quote" },
    {
      Quote: {
        type: "object",
        properties: {
          ticker: { type: "string" },
          price: { type: ["number", "null"] },
        },
        required: ["ticker", "price"],
      },
    },
  );
  expect(schema.parse({ ticker: "PETR4", price: 31.2 })).toEqual({ ticker: "PETR4", price: 31.2 });
  expect(schema.parse({ ticker: "PETR4", price: null })).toEqual({ ticker: "PETR4", price: null });
  expect(() => schema.parse({ ticker: "PETR4" })).toThrow();
});

test("annotations classificam leitura, escrita aditiva e escrita destrutiva", () => {
  const annotate = (method: Operation["method"], operationId = "example") =>
    annotationsFor({ ...operation(undefined), operationId, method });

  expect(annotate("get")).toEqual({
    readOnlyHint: true,
    openWorldHint: false,
    destructiveHint: false,
  });
  expect(annotate("post", "createPortfolio")).toEqual({
    readOnlyHint: false,
    openWorldHint: true,
    destructiveHint: false,
  });
  expect(annotate("post", "addPortfolioTransaction")).toEqual({
    readOnlyHint: false,
    openWorldHint: true,
    destructiveHint: false,
  });
  expect(annotate("delete", "deletePortfolio")).toEqual({
    readOnlyHint: false,
    openWorldHint: true,
    destructiveHint: true,
  });
  expect(annotate("patch", "updatePortfolio")).toEqual({
    readOnlyHint: false,
    openWorldHint: true,
    destructiveHint: true,
  });
  expect(annotate("post", "createThesis")).toEqual({
    readOnlyHint: false,
    openWorldHint: true,
    destructiveHint: false,
  });
  expect(annotate("post", "exportThesis")).toEqual({
    readOnlyHint: false,
    openWorldHint: true,
    destructiveHint: false,
  });
  expect(annotate("put", "updateThesis")).toEqual({
    readOnlyHint: false,
    openWorldHint: true,
    destructiveHint: true,
  });
  expect(annotate("post", "publishThesis")).toEqual({
    readOnlyHint: false,
    openWorldHint: true,
    destructiveHint: true,
  });
  expect(annotate("post", "reconcilePortfolioAsset").destructiveHint).toBe(true);
  expect(annotate("post", "reorderTheses")).toEqual({
    readOnlyHint: false,
    openWorldHint: true,
    destructiveHint: true,
  });
});

function operation(responseSchema: Operation["responseSchema"]): Operation {
  return {
    operationId: "getQuote",
    path: "/v1/quotes/{ticker}",
    method: "get",
    tags: ["Quotes"],
    params: [{ name: "ticker", in: "path", required: true, type: "string" }],
    responseSchema,
  };
}

test("tool declara outputSchema e devolve o mesmo objeto em structuredContent", async () => {
  const api = {
    request: async () => ({ ok: true, status: 200, body: { ticker: "PETR4", price: 31.2 } }),
  } as unknown as ApiClient;
  const tool = buildTools(
    [
      operation({
        type: "object",
        properties: { ticker: { type: "string" }, price: { type: "number" } },
        required: ["ticker", "price"],
      }),
    ],
    api,
  )[0]!;

  expect(tool.config.annotations).toEqual({
    readOnlyHint: true,
    openWorldHint: false,
    destructiveHint: false,
  });
  expect(tool.config.outputSchema.safeParse({ ticker: "PETR4", price: 31.2 }).success).toBe(true);
  const result = await tool.handler({ ticker: "PETR4" });
  expect(result.structuredContent).toEqual({ ticker: "PETR4", price: 31.2 });
  expect(JSON.parse(result.content[0]!.text)).toEqual(result.structuredContent);
});

test("resposta array é envolvida em objeto para structuredContent MCP", async () => {
  const api = {
    request: async () => ({ ok: true, status: 200, body: [{ ticker: "PETR4" }] }),
  } as unknown as ApiClient;
  const tool = buildTools([operation({ type: "array", items: { type: "object" } })], api)[0]!;

  const result = await tool.handler({ ticker: "PETR4" });
  expect(result.structuredContent).toEqual({ result: [{ ticker: "PETR4" }] });
  expect(tool.config.outputSchema.safeParse(result.structuredContent).success).toBe(true);
});
