import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { parse as parseYaml } from "yaml";
import type { ApiClient } from "./api-client";
import { buildInstructions, extractOperations, staticSpecCandidates, type JsonSchema } from "./openapi";
import { buildTools } from "./tools";

/**
 * Contrato declarado (OpenAPI) × schema que a tool MCP realmente aceita.
 *
 * A classe de falha que isto tranca: `createThesis` declarava `doc` como
 * `{"type":"string"}` porque o gerador colapsava `$ref`/`object` em "string", e o
 * handler do servidor só aceita objeto. Nenhum payload podia passar — nem objeto (o
 * cliente MCP respeita o schema e não manda), nem string (o servidor recusa). O bug
 * viveu porque nenhum teste comparava as duas pontas: os testes do gerador exercitam
 * `zodFor` com ParamSpecs escritos à mão, e os do servidor validam `parseDoc`
 * isoladamente. Este percorre TODAS as operações do contrato real.
 */
function loadSpec(): unknown {
  for (const path of staticSpecCandidates(import.meta.url)) {
    try {
      return parseYaml(readFileSync(path, "utf8"));
    } catch {
      // tenta o próximo candidato
    }
  }
  throw new Error("api/openapi.yaml não encontrado — rode `bun run gen:openapi`");
}

const spec = loadSpec();
const operations = extractOperations(spec);
const tools = buildTools(operations, {} as ApiClient);
const byName = new Map(tools.map((t) => [t.name, t]));

function resolve(schema: JsonSchema | undefined, schemas: Record<string, JsonSchema>, depth = 0): JsonSchema {
  if (!schema?.$ref || depth > 8) return schema ?? {};
  const prefix = "#/components/schemas/";
  if (!schema.$ref.startsWith(prefix)) return schema;
  const target = schemas[decodeURIComponent(schema.$ref.slice(prefix.length))];
  return target ? resolve(target, schemas, depth + 1) : schema;
}

/** Um valor de exemplo válido para o tipo declarado no contrato. */
function sampleFor(schema: JsonSchema): unknown {
  const t = Array.isArray(schema.type) ? schema.type.find((x) => x !== "null") : schema.type;
  if (Array.isArray(schema.enum) && schema.enum.length) return schema.enum[0];
  if (t === "integer" || t === "number") return schema.minimum ?? 1;
  if (t === "boolean") return true;
  if (t === "array") return [];
  if (t === "object" || schema.properties) return { exemplo: 1 };
  return "x";
}

test("o contrato declara ao menos 100 operações (guarda de sanidade do spec)", () => {
  expect(operations.length).toBeGreaterThan(100);
  expect(tools.length).toBe(operations.length);
});

test("todo parâmetro do contrato é ACEITO pelo inputSchema da tool", () => {
  const schemas = ((spec as { components?: { schemas?: Record<string, JsonSchema> } }).components?.schemas ?? {});
  const failures: string[] = [];

  for (const op of operations) {
    const tool = byName.get(op.operationId);
    if (!tool) {
      failures.push(`${op.operationId}: sem tool correspondente`);
      continue;
    }
    for (const p of op.params) {
      const validator = tool.config.inputSchema[p.name];
      if (!validator) {
        failures.push(`${op.operationId}.${p.name}: ausente no inputSchema`);
        continue;
      }
      // O ParamSpec já vem do mesmo extrator, então reconstruímos o schema BRUTO do
      // spec para comparar com a origem e não com a nossa própria interpretação.
      const rawOp = (spec as { paths: Record<string, Record<string, { requestBody?: unknown; parameters?: unknown[] }>> })
        .paths[op.path]?.[op.method];
      const rawBody = (rawOp?.requestBody as { content?: Record<string, { schema?: JsonSchema }> } | undefined)
        ?.content?.["application/json"]?.schema;
      const declared =
        p.in === "body"
          ? resolve(resolve(rawBody, schemas).properties?.[p.name], schemas)
          : resolve(
              (rawOp?.parameters as { name: string; schema?: JsonSchema }[] | undefined)?.find((x) => x.name === p.name)
                ?.schema,
              schemas,
            );

      const sample = sampleFor(declared);
      const res = validator.safeParse(sample);
      if (!res.success) {
        failures.push(
          `${op.operationId}.${p.name}: contrato declara ${JSON.stringify(declared.type ?? "$ref")} ` +
            `e o schema da tool rejeita ${JSON.stringify(sample)}`,
        );
      }
    }
  }

  expect(failures, `divergências schema-MCP × contrato:\n${failures.join("\n")}`).toEqual([]);
});

test("param de objeto/array não é declarado como string na tool", () => {
  const structured = operations.flatMap((op) =>
    op.params.filter((p) => p.type === "object" || p.type === "array").map((p) => ({ op: op.operationId, p })),
  );
  // Se o contrato deixar de ter param estruturado, o teste perde o alvo — falhar aqui
  // é o sinal de que o alvo mudou, não de que está tudo bem.
  expect(structured.length, "o contrato deveria ter params de objeto/array (doc, tags, ids)").toBeGreaterThan(0);

  for (const { op, p } of structured) {
    const validator = byName.get(op)!.config.inputSchema[p.name]!;
    const sample = p.type === "array" ? [] : { kind: "report", title: "x" };
    expect(validator.safeParse(sample).success, `${op}.${p.name} deve aceitar ${p.type}`).toBe(true);
  }
});

test("createThesis.doc aceita o objeto ReportDoc (o bug bloqueante da auditoria)", () => {
  const doc = byName.get("createThesis")?.config.inputSchema.doc;
  expect(doc, "createThesis.doc deve existir no inputSchema").toBeDefined();
  expect(doc!.safeParse({ kind: "report", title: "Teste", sections: [] }).success).toBe(true);
  // A string JSON segue aceita: cliente que conhecia o schema antigo não quebra.
  expect(doc!.safeParse('{"kind":"report","title":"Teste","sections":[]}').success).toBe(true);
});

test("faixa declarada de `limit` chega ao schema da tool", () => {
  const withLimit = operations.filter((op) => op.params.some((p) => p.name === "limit" && p.maximum !== undefined));
  expect(withLimit.length, "o contrato deveria declarar maximum em limit").toBeGreaterThan(10);

  for (const op of withLimit) {
    const p = op.params.find((x) => x.name === "limit")!;
    const validator = byName.get(op.operationId)!.config.inputSchema.limit!;
    expect(validator.safeParse(p.maximum).success, `${op.operationId}: limit=${p.maximum} deve passar`).toBe(true);
    expect(
      validator.safeParse(p.maximum! + 1).success,
      `${op.operationId}: limit=${p.maximum! + 1} deve ser rejeitado (maximum ${p.maximum})`,
    ).toBe(false);
  }
});

/**
 * As `instructions` do server são o único texto que o cliente MCP lê ANTES de escolher uma
 * tool, e são derivadas do contrato — se a derivação quebrar, o agente volta a ver 131 nomes
 * planos sem nada explicando o que o servidor cobre, e nenhum outro teste percebe.
 *
 * Guarda o que precisa sobreviver: as convenções globais (`info.description`), o índice por
 * domínio com as descrições de tag (que é onde vive a desambiguação escrita entre domínios
 * parecidos) e os ponteiros de descoberta.
 */
test("as instructions carregam convenções, índice de domínios e descrições de tag", () => {
  const spec = loadSpec() as { tags?: Array<{ name?: string; description?: string }> };
  const instructions = buildInstructions(spec);
  const operations = extractOperations(spec);

  // Convenções globais do info.description — o que ensina paginação e envelope de uma vez.
  expect(instructions).toContain("next_cursor");
  expect(instructions).toContain("lineage");

  // Toda tag declarada COM descrição tem de aparecer com ela: é o texto que separa
  // Bonds de Credit de Estruturados para um agente.
  for (const tag of spec.tags ?? []) {
    if (!tag.name || !tag.description) continue;
    expect(instructions, `a tag ${tag.name} deve aparecer no índice`).toContain(tag.name);
    expect(instructions, `a descrição da tag ${tag.name} deve ser propagada`).toContain(
      tag.description.slice(0, 40),
    );
  }

  // Contagem por domínio: sem isso o índice não diz onde está o volume de dado.
  expect(instructions).toMatch(/\(\d+ operações\)/);
  expect(instructions).toContain(String(operations.length));

  // Ponteiros de descoberta — o "por onde começo" que não existe em nenhuma tool isolada.
  for (const entrada of ["search", "listSeries", "getHealth"]) {
    expect(instructions, `deve apontar ${entrada} como porta de descoberta`).toContain(entrada);
  }
});

// As anotações de escrita saem de uma LISTA por operationId, então um POST que
// muta e não foi lembrado na lista entra como leitura — e some do aviso que o
// cliente MCP mostra antes de executar. Foi o que aconteceu com editThesis.
test("nenhuma operação que muta estado se anuncia como somente leitura", () => {
  const enganosas = extractOperations(spec)
    .filter((op) => op.method.toUpperCase() !== "GET")
    .filter((op) => byName.get(op.operationId)?.config.annotations.readOnlyHint !== false)
    .map((op) => `${op.operationId} (${op.method.toUpperCase()})`);
  expect(enganosas, `mutações sem anotação de escrita: ${enganosas.join(", ")}`).toEqual([]);
});
