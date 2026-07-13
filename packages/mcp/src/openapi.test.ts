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

test("requestBody de PATCH vira params in:body (achatado), junto com o path param", () => {
  const op = extractOperations(FAKE_SPEC).find((o) => o.operationId === "updateThing")!;
  expect(op.params.find((p) => p.name === "id")?.in).toBe("path");
  const name = op.params.find((p) => p.name === "name")!;
  expect(name.in).toBe("body");
  expect(name.required).toBe(true);
});
