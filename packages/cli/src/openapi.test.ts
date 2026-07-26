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

// ── extração de verbos ────────────────────────────────────────────────────────
import { extractOperations } from "./openapi";

const FAKE_SPEC = {
  paths: {
    "/v1/things/{id}": {
      get: { operationId: "getThing" },
      patch: {
        operationId: "updateThing",
        parameters: [{ name: "id", in: "path", schema: { type: "string" } }],
        requestBody: {
          content: { "application/json": { schema: { properties: { name: { type: "string" } }, required: ["name"] } } },
        },
      },
      put: { operationId: "replaceThing" },
      delete: { operationId: "deleteThing" },
    },
    "/v1/things": { post: { operationId: "createThing" } },
  },
};

test("extrai os 5 verbos (get/post/put/patch/delete) como operações", () => {
  const ops = extractOperations(FAKE_SPEC);
  const byId = new Map(ops.map((o) => [o.operationId, o]));
  expect(byId.get("getThing")?.method).toBe("get");
  expect(byId.get("createThing")?.method).toBe("post");
  expect(byId.get("replaceThing")?.method).toBe("put");
  expect(byId.get("updateThing")?.method).toBe("patch");
  expect(byId.get("deleteThing")?.method).toBe("delete");
});

test("requestBody de PATCH vira params in:body (--flags), junto com o posicional de path", () => {
  const op = extractOperations(FAKE_SPEC).find((o) => o.operationId === "updateThing")!;
  expect(op.params.find((p) => p.name === "id")?.in).toBe("path");
  const name = op.params.find((p) => p.name === "name")!;
  expect(name.in).toBe("body");
  expect(name.required).toBe(true);
});
