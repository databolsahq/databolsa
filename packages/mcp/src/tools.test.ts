import { expect, test } from "bun:test";
import type { ParamSpec } from "./openapi";
import { zodFor } from "./tools";

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
