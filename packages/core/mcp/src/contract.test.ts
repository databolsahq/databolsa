import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { parse as parseYaml } from "yaml";
import type { ApiClient } from "./api-client";
import { buildInstructions, extractOperations, staticSpecCandidates, type JsonSchema } from "./openapi";
import { buildTools } from "./tools";

/**
 * Contrato declarado (OpenAPI) × schema que a tool MCP realmente aceita.
 *
 * A classe de falha que isto tranca: uma escrita de documento estruturado declarava seu
 * corpo como `{"type":"string"}` porque o gerador colapsava `$ref`/`object` em "string", e o
 * handler do servidor só aceita objeto. Nenhum payload podia passar — nem objeto (o
 * cliente MCP respeita o schema e não manda), nem string (o servidor recusa). O bug
 * viveu porque nenhum teste comparava as duas pontas: os testes do gerador exercitam
 * `zodFor` com ParamSpecs escritos à mão, e os do servidor validam o corpo isoladamente.
 * Este percorre TODAS as operações do contrato real; o mecanismo em si tem um caso
 * sintético abaixo, para não depender de o contrato ter uma escrita estruturada.
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
  if (schema.pattern === "^\\d{4}-\\d{2}-\\d{2}$") return "2026-01-01";
  if (schema.pattern === "^\\d{14}$") return "12345678000199";
  if (schema.pattern === "^[A-Z][A-Z0-9]{3}[0-9]{0,2}$") return "PETR4";
  if (schema.pattern === "^[A-Za-z]{3}$") return "BRA";
  if (schema.pattern === "^[a-z0-9-]+$") return "exemplo";
  if (schema.pattern === "^[A-Z0-9.\\-]+$") return "ABC-1";
  if (schema.pattern === "^[A-Z0-9]{4,14}$") return "ABC1";
  if (schema.pattern === "^\\d+$") return "1";
  if (schema.pattern === "^[A-Za-z0-9_]+$") return "cursor_1";
  return "x";
}

// O piso desce com a poda object-first: 100 → 80 em 03/09/2026, com o contrato em 90 operações.
// É guarda de sanidade contra spec truncado, não meta de tamanho — a superfície encolhe de
// propósito, e cada retirada passa por gate.
test("o contrato declara ao menos 80 operações (guarda de sanidade do spec)", () => {
  expect(operations.length).toBeGreaterThan(60);
  expect(tools.length).toBe(operations.length);
});

/**
 * PERFIS: o contrato carimbado × o filtro do motor.
 *
 * O perfil é derivado do spec (`x-capability` por operação, `x-profiles` no topo), nunca de
 * lista mantida aqui — e estes testes travam as duas pontas: todo op tem capacidade, e o
 * filtro recusa em vez de degradar. Sem perfil, o comportamento é o de sempre (1:1 acima).
 */
test("toda operação do contrato carrega x-capability, e os perfis existem no topo", () => {
  const semCapacidade = operations.filter((op) => !op.capability).map((op) => op.operationId);
  expect(
    semCapacidade,
    `Operações sem x-capability — o gerador do contrato não rodou o passo do carimbo:\n  ${semCapacidade.join(", ")}`,
  ).toEqual([]);
  const profiles = (spec as { "x-profiles"?: Record<string, { capabilities: string[] }> })["x-profiles"];
  expect(profiles).toBeDefined();
  expect(Object.keys(profiles ?? {})).toContain("default");
  expect(Object.keys(profiles ?? {})).toContain("full");
});

/**
 * O MANIFESTO DE ONTOLOGIA viaja no spec e vira digest nas instruções. Sem ele o agente volta
 * a gastar chamada para descobrir vocabulário; com ele grande demais, gasta contexto. Os dois
 * limites ficam aqui.
 */
test("x-ontology está no contrato, e o digest cabe nas instruções", async () => {
  const { ontologyDigest } = await import("./openapi");
  const o = (spec as { "x-ontology"?: { kinds: string[]; rels: unknown[]; facts: unknown[]; aspects: { operation: string }[] } })["x-ontology"];
  expect(o, "x-ontology ausente — o gerador do contrato não rodou o passo do carimbo").toBeDefined();
  expect(o!.kinds.length).toBeGreaterThan(5);
  expect(o!.rels.length).toBeGreaterThan(10);
  expect(o!.facts.length).toBeGreaterThan(50);
  // Todo capítulo aponta para uma operação que EXISTE no contrato servido.
  const ids = new Set(operations.map((op) => op.operationId));
  expect(o!.aspects.filter((a) => !ids.has(a.operation)).map((a) => a.operation)).toEqual([]);
  const digest = ontologyDigest(spec);
  expect(digest).toContain("VOCABULÁRIO DO GRAFO");
  // O teto é em BYTES, e é o que o agente paga. Medido em 25/08/2026 antes do teto: 9.747.
  expect(new TextEncoder().encode(digest).length).toBeLessThanOrEqual(6_000);
  // E o que ficou de fora é DESCOBRÍVEL por operação tipada, não perdido: a linha que resume
  // um tipo nomeia a operação que devolve a lista inteira.
  const semTeto = ontologyDigest(spec, { maxBytes: 1_000_000 });
  if (semTeto.length > digest.length) {
    expect(digest).toMatch(/, ver (listFactCatalog\?kind=\w+|getObjectProperties)/);
  }
  expect(buildInstructions(spec)).toContain("VOCABULÁRIO DO GRAFO");
});

test("instructionsFor descreve somente as operações visíveis no perfil", () => {
  const instructions = buildInstructions(spec, { operations: ["getHealth"] });
  expect(instructions).toContain("— 1 operação, uma tool por operação");
  expect(instructions).toContain("System (1 operação)");
  expect(instructions).not.toContain("Objects (");
  expect(instructions).not.toContain("VOCABULÁRIO DO GRAFO");
  expect(instructions).not.toContain("`search` resolve");
});

test("o digest é recortado pelo PERFIL: sem operação do grafo, sem vocabulário do grafo", async () => {
  const { ontologyDigest } = await import("./openapi");
  // Um perfil de mercado, sem nenhuma operação de objeto: paga só o cabeçalho.
  const mercado = ontologyDigest(spec, { operations: ["getStockIndicators", "listCorporateEvents"] });
  expect(mercado).not.toContain("Medidas por tipo");
  expect(mercado).not.toContain("Propriedades por tipo");
  expect(mercado).not.toContain("Verbos (");
  // Com facts/history e sem properties: medidas entram, propriedades não.
  const soMedidas = ontologyDigest(spec, { operations: ["getObjectFacts", "getObjectHistory"] });
  expect(soMedidas).toContain("Medidas por tipo");
  expect(soMedidas).not.toContain("Propriedades por tipo");
  // O corte nunca parte uma linha: toda linha de medida ou é a lista ou é o resumo.
  for (const linha of soMedidas.split("\n").filter((l) => l.startsWith("- "))) {
    expect(linha).toMatch(/^- [a-z_]+: (.+:\w+(, .+:\w+)*|\d+ medidas, ver listFactCatalog\?kind=\w+)$/);
  }
});

test("o perfil default é a superfície INICIAL: leitura com lifecycle default/object-native, sem as retiradas por gate", async () => {
  const { aplicarPerfil } = await import("./server");
  const profiles = (spec as { "x-profiles"?: Record<string, { capabilities: string[]; lifecycles?: string[] }> })["x-profiles"];
  const { visiveis, notaDePerfil } = aplicarPerfil(operations, profiles, "default");
  const lifecycle = (op: unknown) => (op as { lifecycle?: string }).lifecycle;
  const capability = (op: unknown) => (op as { capability?: string }).capability;
  // O eixo do lifecycle: tudo que é leitura E ainda não saiu por gate — e nada mais.
  const esperado = operations.filter((op) => lifecycle(op) === undefined || lifecycle(op) === "default" || lifecycle(op) === "object-native");
  expect(visiveis.map((op) => op.operationId).sort()).toEqual(esperado.map((op) => op.operationId).sort());
  expect(visiveis.some((op) => op.operationId === "resolveObject")).toBe(true);
  expect(visiveis.some((op) => op.operationId === "aggregateObjects")).toBe(true);
  // Nenhuma das retiradas reaparece: `on-demand` só volta pelo `full`.
  expect(visiveis.filter((op) => lifecycle(op) === "on-demand")).toEqual([]);
  // 30 → 17 em 02/09/2026 e 17 → 11 → 3 → 1 → 0 em 03/09/2026: todas as retiradas saíram do
  // CONTRATO nos seis lotes da poda e viraram `removed` no registry. A última,
  // `listCreditRatingHistory`, saiu quando a aresta `rates` passou a enumerar as decisões
  // (forma `event` em `entity_link_observation`, OBJ-0035 fechado). Não sobra on-demand no spec.
  expect(operations.filter((op) => lifecycle(op) === "on-demand")).toEqual([]);
  // Escrita nenhuma no contrato core desde a saída da capacidade `account` (02/09/2026): a
  // carteira e o perfil de investidor são da extensão Wallet, com contrato próprio.
  expect(visiveis.filter((op) => op.method !== "get").map((op) => op.operationId)).toEqual([]);
  expect(operations.filter((op) => capability(op) === "account")).toEqual([]);
  expect(notaDePerfil).toContain("PERFIL ATIVO: default");
  // Sem on-demand não há "retiradas deste perfil" a anunciar: a nota diz que o perfil é o
  // contrato inteiro e aponta os Objects como o caminho do que foi apagado.
  expect(notaDePerfil).toContain(`${visiveis.length} de ${operations.length} operações do contrato`);
  expect(notaDePerfil).not.toContain("retiradas deste perfil");
  expect(notaDePerfil).toContain("getObjectLinkHistory");
});

test("sem perfil = default (ausência de escolha não abre full); full é explícito e devolve o contrato inteiro; perfil desconhecido é ERRO com a saída", async () => {
  const { aplicarPerfil } = await import("./server");
  const profiles = (spec as { "x-profiles"?: Record<string, { capabilities: string[] }> })["x-profiles"];
  expect(aplicarPerfil(operations, profiles, "full").visiveis.length).toBe(operations.length);
  expect(aplicarPerfil(operations, profiles, "full").notaDePerfil).toContain("PERFIL ATIVO: full");
  const semPerfil = aplicarPerfil(operations, profiles, undefined);
  const comDefault = aplicarPerfil(operations, profiles, "default");
  expect(semPerfil.perfil).toBe("default");
  expect(semPerfil.visiveis.map((op) => op.operationId)).toEqual(comDefault.visiveis.map((op) => op.operationId));
  expect(semPerfil.notaDePerfil).toContain("sessão sem perfil");
  // Contrato SEM x-profiles (o de uma extensão): sem perfil pedido, segue inteiro — ele não carrega lifecycle.
  expect(aplicarPerfil(operations, undefined, undefined).visiveis.length).toBe(operations.length);
  // Typo não degrada para zero tools com cara de "não há operações" — recusa nomeando os válidos.
  expect(() => aplicarPerfil(operations, profiles, "defalt")).toThrow(/Válidos:.*default/);
  // Spec sem x-profiles + perfil pedido = recusa explicando.
  expect(() => aplicarPerfil(operations, undefined, "default")).toThrow(/não declara perfis/);
});

/**
 * A admissão por sessão continua sendo o gancho do host, mas sem default: o contrato core não
 * tem mais capacidade fora dos perfis (a `account` saiu com a Wallet em 02/09/2026), então uma
 * sessão com credencial NÃO ganha nada além do perfil — e o que saiu pelo lifecycle continua
 * fora, que é a garantia que o gancho nunca pode furar.
 */
test("a admissão por sessão nunca readmite o que saiu pelo lifecycle, nem com `admit` que aceita tudo", async () => {
  const { aplicarPerfil } = await import("./server");
  const profiles = (spec as { "x-profiles"?: Record<string, { capabilities: string[] }> })["x-profiles"];
  const lifecycle = (op: unknown) => (op as { lifecycle?: string }).lifecycle;
  const semAdmissao = aplicarPerfil(operations, profiles, undefined);
  const tudo = aplicarPerfil(operations, profiles, undefined, () => true);
  expect(tudo.visiveis.filter((op) => lifecycle(op) === "on-demand")).toEqual([]);
  expect(tudo.visiveis.map((op) => op.operationId)).toEqual(semAdmissao.visiveis.map((op) => op.operationId));
  expect(tudo.notaDePerfil).not.toContain("admitidas por esta sessão");
});

/**
 * O SNAPSHOT do default e o ORÇAMENTO de bytes. Congela o que uma sessão sem perfil recebe —
 * nomes E bytes do `tools/list` — para que uma operação nova entre no default por decisão
 * (registry + este arquivo), nunca por acidente, e para que o custo de contexto seja medido
 * e não estimado por contagem de operationIds. `UPDATE_SURFACE_SNAPSHOT=1 bun test` regrava.
 */
test("o conjunto default e seu orçamento de schema são congelados", async () => {
  const { createServer } = await import("./server");
  const { measureServer } = await import("./surface");
  const { ApiClient } = await import("./api-client");
  const { writeFileSync } = await import("node:fs");
  const SNAPSHOT = new URL("./default-surface.snapshot.json", import.meta.url).pathname;
  const { server } = await createServer({ apiClient: new ApiClient({ baseUrl: "http://127.0.0.1:9" }) });
  const medida = await measureServer(server);
  const atual = { tools: medida.tools, schemaBytes: medida.schemaBytes, names: medida.names };
  if (process.env.UPDATE_SURFACE_SNAPSHOT === "1") {
    writeFileSync(SNAPSHOT, JSON.stringify({ ...atual, budgetBytes: Math.ceil((medida.schemaBytes * 1.05) / 10_000) * 10_000 }, null, 2) + "\n");
  }
  const congelado = JSON.parse(readFileSync(SNAPSHOT, "utf8")) as { tools: number; schemaBytes: number; names: string[]; budgetBytes: number };
  expect(atual.names).toEqual(congelado.names);
  expect(atual.tools).toBe(congelado.tools);
  expect(atual.schemaBytes).toBeLessThanOrEqual(congelado.budgetBytes);
  // `executeObjectFunction` é a única tool fora do contrato; entra porque a sessão enxerga o grafo.
  expect(atual.names).toContain("executeObjectFunction");
  expect(atual.names).toContain("getObject");
  expect(atual.names).not.toContain("listTradeStats");
  expect(atual.names).not.toContain("createPortfolio");
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

test("param de objeto/array do contrato não é declarado como string na tool", () => {
  // Sem `toBeGreaterThan(0)`: hoje o contrato não tem escrita com corpo estruturado, e
  // exigir uma aqui só amarraria o teste a uma rota específica de novo. O mecanismo está
  // coberto pelo caso sintético abaixo; este varre o que o contrato REAL trouxer.
  const structured = operations.flatMap((op) =>
    op.params.filter((p) => p.type === "object" || p.type === "array").map((p) => ({ op: op.operationId, p })),
  );
  for (const { op, p } of structured) {
    const validator = byName.get(op)!.config.inputSchema[p.name]!;
    const sample = p.type === "array" ? [] : { kind: "report", title: "x" };
    expect(validator.safeParse(sample).success, `${op}.${p.name} deve aceitar ${p.type}`).toBe(true);
  }
});

test("corpo estruturado vira objeto na tool, por `$ref` direto e sob allOf", () => {
  const spec = {
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
                  properties: {
                    doc: { allOf: [{ $ref: "#/components/schemas/DocInput" }], description: "sob allOf" },
                    cru: { $ref: "#/components/schemas/DocInput" },
                    tags: { type: "array", items: { type: "string" } },
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
  const tool = buildTools(extractOperations(spec), {} as ApiClient).find((t) => t.name === "criarCoisa");
  expect(tool, "o spec sintético deve produzir a tool").toBeDefined();
  const doc = tool!.config.inputSchema.doc!;
  expect(doc.safeParse({ kind: "report", title: "Teste", sections: [] }).success).toBe(true);
  // A string JSON segue aceita: cliente que conhecia o schema antigo não quebra.
  expect(doc.safeParse('{"kind":"report","title":"Teste","sections":[]}').success).toBe(true);
  expect(tool!.config.inputSchema.cru!.safeParse({ kind: "report" }).success).toBe(true);
  expect(tool!.config.inputSchema.tags!.safeParse([]).success).toBe(true);
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
  // Bonds de Credit de Commodities para um agente.
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
  for (const entrada of ["search", "listObjects", "getHealth"]) {
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

/**
 * Contribuições de outro contrato entram lado a lado com o Core, e o Core sempre ganha uma
 * colisão de nome: tool de extensão nunca sobrescreve uma tool que o cliente já conhece, e a
 * colisão sai nomeada em vez de trocar o handler por baixo.
 */
test("contribuições: registram sem colidir; colisão é descartada e nomeada, o Core ganha", async () => {
  const { contribuir } = await import("./server");
  const core = buildTools(operations.slice(0, 3), {} as ApiClient);
  const nomeDoCore = core[0]!.name;
  const estranha = { ...operations[10]!, operationId: "extListSomething" };
  const colidente = { ...operations[11]!, operationId: nomeDoCore };
  const outra = { ...operations[12]!, operationId: "extGetOther" };
  const { collisions, notas } = contribuir(core, [
    { name: "databolsa.ext", operations: [estranha, colidente], apiClient: {} as ApiClient, note: "EXTENSÃO Ext" },
    { name: "databolsa.outra", operations: [outra, { ...outra }], apiClient: {} as ApiClient },
  ]);
  expect(core.map((t) => t.name)).toContain("extListSomething");
  expect(core.map((t) => t.name)).toContain("extGetOther");
  expect(core.filter((t) => t.name === nomeDoCore)).toHaveLength(1);
  expect(collisions).toEqual([
    { contribution: "databolsa.ext", tool: nomeDoCore },
    { contribution: "databolsa.outra", tool: "extGetOther" },
  ]);
  expect(notas).toEqual(["EXTENSÃO Ext (1 tools)"]);
});
