import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { buildCommands } from "./commands";
import { extractOperations, staticSpecCandidates } from "./openapi";

/**
 * A CLI deriva os comandos do contrato em runtime, igual ao MCP. O que faltava era a
 * asserção de que a derivação COBRE o contrato inteiro.
 *
 * O MCP tem esse gate (`packages/mcp/src/contract.test.ts`: uma tool por operação e
 * `operations.length > 100`); a CLI só testava resolução de caminho do spec. Um extrator que
 * silenciosamente parasse de casar com um verbo, ou uma operação que perdesse o operationId,
 * sumiria da CLI sem nenhum teste vermelho — a mesma classe de omissão que deixou a interface
 * do SDK driftar (ver packages/sdk/src/surface.test.ts).
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
  expect(operations.length, "o contrato deve ter operações").toBeGreaterThan(100);

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
// `type` próprio caía em "string", e o body ia serializado — foi o que deixou
// `createThesis` inutilizável pela CLI. A segunda vez veio por `allOf: [{$ref}]`,
// que é como a OpenAPI 3.0 pendura description/deprecated numa referência.
test("param que referencia um schema é objeto, inclusive embrulhado em allOf", () => {
  const ops = extractOperations(specDoRepo());
  const create = ops.find((o) => o.operationId === "createThesis");
  expect(create, "createThesis deve existir no contrato").toBeDefined();

  const md = create!.params.find((p) => p.name === "md");
  expect(md?.type, "`md` é o caminho de autoria e é texto").toBe("string");
  expect(md?.required, "sem `md` obrigatório, uma chamada vazia parece válida").toBe(true);

  const doc = create!.params.find((p) => p.name === "doc");
  expect(doc?.type, "`doc` referencia ReportDocInput sob allOf — objeto, nunca string").toBe("object");
});

// BUG-0094: query enum por `$ref` (`entity_type` → DocumentEntityType) era confundida
// com objeto. A CLI exigia JSON (`--entity_type '{...}'`) e tornava impossível filtrar
// FIAGRO/FIDC, embora API e MCP aceitassem a string normalmente.
test("query enum referenciada permanece string e preserva os valores", () => {
  const search = extractOperations(specDoRepo()).find((o) => o.operationId === "searchDocuments");
  expect(search, "searchDocuments deve existir no contrato").toBeDefined();

  const entityType = search!.params.find((p) => p.name === "entity_type");
  expect(entityType?.type).toBe("string");
  expect(entityType?.enum).toContain("fiagro");
  expect(entityType?.enum).toContain("fidc");
});
