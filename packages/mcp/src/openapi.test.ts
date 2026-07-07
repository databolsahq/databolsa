import { expect, test } from "bun:test";
import { staticSpecCandidates } from "./openapi";

// Layout do PACOTE PUBLICADO: o bundle vira node_modules/@databolsa/mcp/dist/index.js.
const PUBLISHED = "file:///home/u/proj/node_modules/@databolsa/mcp/dist/index.js";
// Layout de FONTE no repo: packages/mcp/src/openapi.ts.
const SOURCE = "file:///home/u/databolsa/packages/mcp/src/openapi.ts";

test("publicado: candidato aponta p/ o openapi.yaml ao lado do bundle (dist/)", () => {
  const cands = staticSpecCandidates(PUBLISHED);
  // O BUG-0016 (2º site): o único candidato antigo resolvia p/
  // node_modules/api/openapi.yaml → o MCP nem bootava offline.
  expect(cands[0]).toBe("/home/u/proj/node_modules/@databolsa/mcp/dist/openapi.yaml");
  expect(cands.some((p) => p.endsWith("/@databolsa/mcp/dist/openapi.yaml"))).toBe(true);
  expect(cands).toContain("/home/u/proj/node_modules/api/openapi.yaml");
});

test("dev (fonte): candidato aponta p/ a raiz do repo (api/openapi.yaml)", () => {
  const cands = staticSpecCandidates(SOURCE);
  expect(cands).toContain("/home/u/databolsa/api/openapi.yaml");
});

test("retorna caminhos absolutos, sem esquema file://", () => {
  for (const p of staticSpecCandidates(PUBLISHED)) {
    expect(p.startsWith("/")).toBe(true);
    expect(p).not.toContain("file://");
  }
});
