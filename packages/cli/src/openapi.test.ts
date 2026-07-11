import { expect, test } from "bun:test";
import { staticSpecCandidates } from "./openapi";

// Layout do PACOTE PUBLICADO: o bundle vira node_modules/@databolsa/cli/dist/index.js.
const PUBLISHED = "file:///home/u/proj/node_modules/@databolsa/cli/dist/index.js";
// Layout de FONTE no repo: packages/cli/src/openapi.ts.
const SOURCE = "file:///home/u/databolsa/packages/cli/src/openapi.ts";

test("publicado: candidato aponta p/ o openapi.yaml ao lado do bundle (dist/)", () => {
  const cands = staticSpecCandidates(PUBLISHED);
  // O BUG-0016: o único candidato antigo resolvia p/ node_modules/api/openapi.yaml.
  // Agora o 1º candidato é dist/openapi.yaml (copiado pelo build) — este é o fix.
  expect(cands[0]).toBe("/home/u/proj/node_modules/@databolsa/cli/dist/openapi.yaml");
  expect(cands.some((p) => p.endsWith("/@databolsa/cli/dist/openapi.yaml"))).toBe(true);
  // E o candidato antigo (relativo à fonte) NÃO deve ser o único — antes apontava
  // p/ este caminho inexistente no pacote publicado.
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
