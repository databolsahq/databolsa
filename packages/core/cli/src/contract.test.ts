import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { buildCommands } from "./commands";
import { extractOperations, staticSpecCandidates } from "./openapi";

/**
 * A CLI deriva os comandos do contrato em runtime, igual ao MCP. O que faltava era a
 * asserção de que a derivação COBRE o contrato inteiro.
 *
 * O MCP tem esse gate (`packages/core/mcp/src/contract.test.ts`: uma tool por operação e
 * `operations.length > 100`); a CLI só testava resolução de caminho do spec. Um extrator que
 * silenciosamente parasse de casar com um verbo, ou uma operação que perdesse o operationId,
 * sumiria da CLI sem nenhum teste vermelho — a mesma classe de omissão que deixou a interface
 * do SDK driftar (ver packages/core/sdk/src/surface.test.ts).
 *
 * Lê o spec do repo, sem rede.
 */
function specDoRepo(): unknown {
  const candidatos = staticSpecCandidates(import.meta.url);
  for (const p of candidatos) {
    try {
      return parse(readFileSync(p, "utf8"));
    } catch {
      /* tenta o próximo */
    }
  }
  throw new Error(`nenhum spec encontrado em: ${candidatos.join(", ")}`);
}

test("todo operationId do contrato vira um comando da CLI", () => {
  const operations = extractOperations(specDoRepo());
  expect(operations.length, "o contrato deve ter operações").toBeGreaterThan(60);

  const commands = buildCommands(operations);
  expect(commands.size).toBe(operations.length);

  const faltando = operations.map((o) => o.operationId).filter((id) => !commands.has(id));
  expect(faltando, `operações sem comando: ${faltando.join(", ")}`).toEqual([]);
});

test("todo comando declara método, caminho e categoria", () => {
  const commands = [...buildCommands(extractOperations(specDoRepo())).values()];
  const quebrados = commands
    .filter((c) => !c.method || !c.path?.startsWith("/") || c.tags.length === 0)
    .map((c) => c.operationId);
  expect(quebrados, `comandos malformados: ${quebrados.join(", ")}`).toEqual([]);
});

// Duas vezes o mesmo defeito: um param que aponta pra `#/components/schemas/*` sem
// `type` próprio caía em "string", e o body ia serializado — foi o que deixou a escrita
// de documento estruturado inutilizável pela CLI. A segunda vez veio por `allOf: [{$ref}]`,
// que é como a OpenAPI 3.0 pendura description/deprecated numa referência.
//
// O caso vive num spec SINTÉTICO desde que a operação original saiu do contrato: o defeito
// é do extrator, não daquela rota, e amarrá-lo a um operationId concreto já custou o teste
// uma vez. Enquanto o contrato não voltar a ter body estruturado, é aqui que ele fica.
const SPEC_BODY_ESTRUTURADO = {
  openapi: "3.0.3",
  info: { title: "t", version: "0" },
  paths: {
    "/v1/coisas": {
      post: {
        operationId: "criarCoisa",
        tags: ["Teste"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["md"],
                properties: {
                  md: { type: "string" },
                  doc: { allOf: [{ $ref: "#/components/schemas/DocInput" }], description: "sob allOf" },
                  cru: { $ref: "#/components/schemas/DocInput" },
                },
              },
            },
          },
        },
        responses: { 200: { description: "ok" } },
      },
    },
  },
  components: { schemas: { DocInput: { type: "object", properties: { kind: { type: "string" } } } } },
};

test("param que referencia um schema é objeto, inclusive embrulhado em allOf", () => {
  const op = extractOperations(SPEC_BODY_ESTRUTURADO).find((o) => o.operationId === "criarCoisa");
  expect(op, "o spec sintético deve produzir a operação").toBeDefined();

  const md = op!.params.find((p) => p.name === "md");
  expect(md?.type, "texto simples continua string").toBe("string");
  expect(md?.required, "sem obrigatório, uma chamada vazia parece válida").toBe(true);

  const doc = op!.params.find((p) => p.name === "doc");
  expect(doc?.type, "`$ref` sob allOf — objeto, nunca string").toBe("object");

  const cru = op!.params.find((p) => p.name === "cru");
  expect(cru?.type, "`$ref` direto — objeto, nunca string").toBe("object");
});

test("query enum referenciada permanece string e preserva os valores", () => {
  const search = extractOperations(specDoRepo()).find((o) => o.operationId === "searchDocuments");
  expect(search, "searchDocuments deve existir no contrato").toBeDefined();

  const entityType = search!.params.find((p) => p.name === "entity_type");
  expect(entityType?.type).toBe("string");
  expect(entityType?.enum).toContain("fiagro");
  expect(entityType?.enum).toContain("fidc");
});
