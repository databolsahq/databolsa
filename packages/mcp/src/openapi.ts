/**
 * Carrega o contrato OpenAPI e extrai a lista de operações que viram tools MCP.
 *
 * Fonte primária: `/openapi.json` vivo da API, então as tools acompanham a API
 * sozinhas.
 * Fallback: o `api/openapi.yaml` versionado no repo, para o `tools/list`
 * funcionar mesmo se a API estiver momentaneamente fora (as chamadas, claro,
 * ainda exigem a API no ar).
 */
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";
import type { ApiClient } from "./api-client";

export interface ParamSpec {
  name: string;
  in: "path" | "query" | "body";
  required: boolean;
  /**
   * `object` e `array` existem aqui porque o contrato os usa em requestBody. Sem
   * eles, `normalizeType` colapsava tudo que não fosse escalar em "string" e o
   * schema MCP declarava `doc: string` para um parâmetro que o servidor só aceita
   * como objeto — nenhuma chamada de `createThesis` podia passar, por MCP ou CLI.
   */
  type: "string" | "number" | "integer" | "boolean" | "object" | "array";
  description?: string;
  enum?: string[];
  default?: unknown;
  /** Tipo dos itens, quando `type === "array"`. */
  items?: ParamSpec["type"];
  /**
   * Resumo compacto dos campos do objeto (ou do item do array), com `*` no obrigatório
   * e os valores aceitos quando são enum.
   *
   * Existe porque o schema MCP declara objeto como `record(unknown)` de propósito — a
   * árvore inteira infla o `tools/list` de todo cliente sem ganhar validação, já que o
   * servidor valida e devolve o caminho do campo. A decisão previa que "a forma
   * esperada vai na description", e essa metade nunca foi escrita: o modelo via
   * `objectives: array de objeto` sem saber que `kind` é obrigatório, mandava `[{}]`,
   * levava 400 e concluía que o endpoint estava quebrado.
   */
  shape?: string;
  /** Faixa declarada no contrato. Antes era descartada, então o schema que o cliente
   *  MCP vê não expressava o `maximum` real de `limit` (1.000 na maioria das
   *  operações, 20.000 em cinco séries) e o LLM não tinha como respeitá-lo. */
  minimum?: number;
  maximum?: number;
}

export interface JsonSchema {
  $ref?: string;
  type?: string | string[];
  description?: string;
  enum?: unknown[];
  const?: unknown;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  additionalProperties?: boolean | JsonSchema;
  anyOf?: JsonSchema[];
  oneOf?: JsonSchema[];
  allOf?: JsonSchema[];
  nullable?: boolean;
  minimum?: number;
  maximum?: number;
  default?: unknown;
}

export interface Operation {
  operationId: string;
  /** chave do spec, ex.: `/v1/stocks/{ticker}` */
  path: string;
  /** Verbo HTTP — operações de escrita (post/put/patch/delete) também viram tools. */
  method: "get" | "post" | "put" | "patch" | "delete";
  summary?: string;
  description?: string;
  tags: string[];
  /** `x-capability` carimbado no contrato pelo gerador. É o que os perfis filtram. */
  capability?: string;
  params: ParamSpec[];
  /** Corpo JSON da primeira resposta 2xx documentada. Alimenta outputSchema MCP. */
  responseSchema?: JsonSchema;
  /** Registry compartilhado para resolver `$ref: #/components/schemas/*`. */
  schemas?: Record<string, JsonSchema>;
}

interface RawParam {
  name: string;
  in: string;
  required?: boolean;
  description?: string;
  schema?: JsonSchema;
}

/**
 * Caminhos candidatos do `openapi.yaml` estático, em ordem de tentativa. O layout
 * difere entre o pacote PUBLICADO e a árvore de FONTE:
 *   1) `./openapi.yaml` — ao lado do bundle no pacote publicado (`dist/openapi.yaml`,
 *      copiado pelo build; incluído via `files: ["dist"]`).
 *   2) `../../../api/openapi.yaml` — layout de fonte no repo (`packages/mcp/src/` → raiz).
 * O publicado acha (1); rodando do fonte em dev acha (2). Antes esta era a única
 * tentativa e, no publicado, `import.meta.url`=`…/dist/index.js` resolvia p/
 * `…/node_modules/api/openapi.yaml` (inexistente) → o MCP nem bootava offline.
 */
export function staticSpecCandidates(moduleUrl: string = import.meta.url): string[] {
  return [
    fileURLToPath(new URL("./openapi.yaml", moduleUrl)),
    fileURLToPath(new URL("../../../api/openapi.yaml", moduleUrl)),
  ];
}

export interface LoadOperationsOptions {
  /** Fallback estático próprio (ex.: advisor-mcp aponta o openapi-advisor.yaml bundlado). */
  staticCandidates?: string[];
}

export async function loadOperations(api: ApiClient, opts?: LoadOperationsOptions): Promise<Operation[]> {
  return extractOperations(await loadSpec(api, opts));
}

/** Um perfil declarado no topo do spec (`x-profiles`), pelo gerador do contrato. */
export interface SpecProfile {
  description?: string;
  capabilities: string[];
}

/** Operações + o texto de orientação do server, extraídos da MESMA leitura do spec. */
export interface SpecContext {
  operations: Operation[];
  instructions: string;
  /** Perfis nomeados do contrato. Ausente em spec sem `x-profiles` (ex.: Advisor, por ora). */
  profiles?: Record<string, SpecProfile>;
  /** O digest de `x-ontology` INTEIRO, já em texto. Vazio em spec sem manifesto. */
  ontology: string;
  /**
   * O digest recortado pelo perfil: só o vocabulário que estas operações alcançam, sob o teto
   * de bytes. É o que vai para o prompt de um agente com tools filtradas — sem
   * `getObjectProperties`, listar 102 propriedades é ruído pago em contexto.
   */
  ontologyFor: (operations: Iterable<string>) => string;
  /** As `instructions` recortadas pelo mesmo perfil (o digest dentro delas muda junto). */
  instructionsFor: (operations: Iterable<string>) => string;
}

export async function loadSpecContext(
  api: ApiClient,
  opts?: LoadOperationsOptions,
): Promise<SpecContext> {
  const spec = await loadSpec(api, opts);
  const profiles = (spec as { "x-profiles"?: Record<string, SpecProfile> })["x-profiles"];
  return {
    operations: extractOperations(spec),
    instructions: buildInstructions(spec),
    profiles,
    ontology: ontologyDigest(spec),
    ontologyFor: (operations) => ontologyDigest(spec, { operations }),
    instructionsFor: (operations) => buildInstructions(spec, { operations }),
  };
}

/**
 * Monta as `instructions` do server MCP a partir do próprio contrato.
 *
 * Dois textos autorais do OpenAPI nunca chegavam ao cliente MCP, e são justamente os que
 * orientam um agente:
 *
 * - `info.description` — as convenções globais (envelope `{data, meta}`, paginação por
 *   cursor, preços ajustados por default, indicadores TTM, campo `lineage`). Sem isso o
 *   modelo tem de inferir paginação e semântica tool a tool, 131 vezes.
 * - a descrição de cada TAG — que é onde vive a desambiguação escrita entre domínios
 *   parecidos ("Events não é evento societário", "Estruturados é payoff de derivativo, não
 *   renda fixa", "Commodities é ajuste de futuro, não preço à vista"). A tool só recebia o
 *   NOME da tag, num sufixo `Categoria: Credit.` que não diz o que Credit cobre.
 *
 * O resultado é um índice por domínio com contagem, que é o que a CLI já dava ao humano
 * (`databolsa --list`) e o MCP não dava à IA. Derivar do spec em vez de escrever um segundo
 * texto é deliberado: a orientação não pode divergir do contrato que ela descreve.
 */
export function buildInstructions(spec: unknown, opts: { operations?: Iterable<string> } = {}): string {
  const doc = spec as {
    info?: { title?: string; description?: string; version?: string };
    tags?: Array<{ name?: string; description?: string }>;
  };
  const operations = extractOperations(spec);

  const porTag = new Map<string, number>();
  for (const op of operations) {
    for (const tag of op.tags.length > 0 ? op.tags : ["(sem categoria)"]) {
      porTag.set(tag, (porTag.get(tag) ?? 0) + 1);
    }
  }

  const descricaoDaTag = new Map(
    (doc.tags ?? []).filter((t) => t.name).map((t) => [t.name!, t.description?.trim()]),
  );

  // Ordena por tamanho: o agente lê os domínios grandes primeiro, que é onde está o volume
  // de dado. Empate por nome só para a saída ser estável entre execuções.
  const linhas = [...porTag.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([tag, n]) => {
      const desc = descricaoDaTag.get(tag);
      return `- ${tag} (${n} ${n === 1 ? "operação" : "operações"})${desc ? `: ${desc}` : ""}`;
    });

  const partes = [
    `${doc.info?.title ?? "DataBolsa"}${doc.info?.version ? ` v${doc.info.version}` : ""} — ${operations.length} operações, uma tool por operação.`,
  ];
  if (doc.info?.description?.trim()) partes.push(doc.info.description.trim());
  if (linhas.length > 0) partes.push(`Domínios disponíveis:\n${linhas.join("\n")}`);
  const digest = ontologyDigest(spec, { operations: opts.operations });
  if (digest) partes.push(digest);
  partes.push(
    "Para descobrir o que existe antes de consultar: `search` resolve nome ou ticker para " +
      "a entidade certa em todas as classes de ativo; `listSeries` lista as séries macro; " +
      "`getDocumentTaxonomy` lista as categorias de documento; `getHealth` diz o frescor de " +
      "cada fonte. Nomes de operação são estáveis e a cobertura é Brasil-first, com " +
      "extensões para EUA, macro global, commodities e criptoativos.",
  );
  return partes.join("\n\n");
}


/**
 * O DIGEST DA ONTOLOGIA — o vocabulário do grafo em texto curto, para as instruções do MCP e
 * o prompt do agente. Lê `x-ontology` do spec; spec sem ele devolve vazio.
 *
 * Existe porque a sondagem de 25/08/2026 mediu o agente gastando uma ou duas chamadas por
 * execução só para descobrir vocabulário (`listObjectRelations`, `listFactCatalog`) antes de
 * ler qualquer coisa. O que cabe aqui é o que decide a PRÓXIMA chamada: os verbos com forma e
 * pontas, e os nomes de medida por tipo com a unidade. Descrição longa continua nas rotas.
 *
 * O TETO É REAL E EM BYTES (`maxBytes`, default 6 KB): a primeira versão dizia "~6 KB" num
 * comentário e media 9,7 KB. Instrução que cresce compete com o contexto que ela economiza.
 * Dois cortes, nesta ordem: (1) só entra o que o PERFIL de tools alcança — sem
 * `getObjectProperties` no perfil, listar 102 propriedades é ruído; (2) o que ainda passar do
 * teto é resumido por tipo, com a operação de catálogo que devolve o resto. O corte é por
 * LINHA inteira, nunca no meio de uma, e a linha que substitui diz o que foi omitido.
 */
export interface OntologyDigestOptions {
  /** As operações do perfil ativo. Sem ela, tudo é considerado alcançável. */
  operations?: Iterable<string>;
  /** Teto em bytes UTF-8 do texto final. */
  maxBytes?: number;
}

export const ONTOLOGY_DIGEST_MAX_BYTES = 6_000;

/** Que operação torna cada bloco do digest útil. Bloco sem operação alcançável não entra. */
const ALCANCE = {
  rels: ["listObjectLinks", "traverseObjectPath", "findObjectPaths", "getObjectLinkStats", "listGlobalLinks", "rankObjects", "aggregateObjects", "getObjectLinkHistory"],
  facts: ["getObjectFacts", "getObjectHistory", "rankObjects", "aggregateObjects", "listFactCatalog"],
  properties: ["getObjectProperties", "rankObjects", "aggregateObjects"],
} as const;

const bytes = (t: string) => new TextEncoder().encode(t).length;

export function ontologyDigest(spec: unknown, opts: OntologyDigestOptions = {}): string {
  const o = (spec as { "x-ontology"?: OntologyLike })["x-ontology"];
  if (!o) return "";
  const maxBytes = opts.maxBytes ?? ONTOLOGY_DIGEST_MAX_BYTES;
  const ops = opts.operations ? new Set(opts.operations) : null;
  const alcanca = (lista: readonly string[]) => !ops || lista.some((op) => ops.has(op));

  const porKind = (itens: { kind: string; texto: string }[]) => {
    const m = new Map<string, string[]>();
    for (const i of itens) m.set(i.kind, [...(m.get(i.kind) ?? []), i.texto]);
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  };

  const cabecalho = [
    "VOCABULÁRIO DO GRAFO (já está aqui — não gaste chamada em listObjectRelations/listFactCatalog para descobri-lo):",
    `Tipos de objeto: ${o.kinds.join(", ")}.`,
  ];
  const rodape = alcanca(ALCANCE.facts)
    ? "Leitura em lote: getObjectFacts e getObjectHistory aceitam vários ids no caminho separados por vírgula (até 50) e várias medidas em facts= (até 10); resolveObject aceita q=a|b. Compare N objetos numa chamada, nunca uma por objeto."
    : "";

  const rels = alcanca(ALCANCE.rels)
    ? `Verbos (forma; de → para) — event = total de todos os tempos, snapshot = último retrato (use at), static = vigente, recusa data passada:\n${o.rels
        .map((r) => `- ${r.rel} (${r.shape}; ${r.domain_kinds.join("|") || "?"} → ${r.range_kinds.join("|") || "?"})`)
        .join("\n")}`
    : "";

  // Fatos e propriedades em DUAS resoluções: a lista, e o resumo por tipo com a operação que
  // devolve a lista. A montagem escolhe a resolução por tipo até caber no teto.
  const fatos = alcanca(ALCANCE.facts) ? porKind(o.facts.map((f) => ({ kind: f.kind, texto: `${f.name}:${f.unit}` }))) : [];
  const props = alcanca(ALCANCE.properties) ? porKind(o.properties.map((p) => ({ kind: p.kind, texto: p.name }))) : [];

  const montar = (fatosCheios: Set<string>, propsCheias: Set<string>) => {
    const blocoFatos = fatos.length
      ? `Medidas por tipo, como nome:unidade (ratio é fração, pct é percentual; passe o nome em getObjectFacts?facts= ou getObjectHistory?facts=):\n${fatos
          .map(([kind, l]) => (fatosCheios.has(kind) ? `- ${kind}: ${l.join(", ")}` : `- ${kind}: ${l.length} medidas — listFactCatalog?kind=${kind}`))
          .join("\n")}`
      : "";
    const blocoProps = props.length
      ? `Propriedades por tipo (getObjectProperties e where=):\n${props
          .map(([kind, l]) => (propsCheias.has(kind) ? `- ${kind}: ${l.join(", ")}` : `- ${kind}: ${l.length} propriedades — getObjectProperties`))
          .join("\n")}`
      : "";
    return [...cabecalho, rels, blocoFatos, blocoProps, rodape].filter(Boolean).join("\n\n");
  };

  // Do maior para o menor: resumir primeiro o tipo que mais pesa devolve o máximo de texto
  // pelo mínimo de omissão. Propriedades cedem antes das medidas — a medida decide a próxima
  // chamada; a propriedade, um recorte.
  const fatosCheios = new Set(fatos.map(([k]) => k));
  const propsCheias = new Set(props.map(([k]) => k));
  const porPeso = (xs: [string, string[]][]) => [...xs].sort((a, b) => b[1].join(", ").length - a[1].join(", ").length).map(([k]) => k);
  const filaProps = porPeso(props);
  const filaFatos = porPeso(fatos);
  let texto = montar(fatosCheios, propsCheias);
  while (bytes(texto) > maxBytes) {
    const p = filaProps.shift();
    if (p) propsCheias.delete(p);
    else {
      const f = filaFatos.shift();
      if (!f) break;
      fatosCheios.delete(f);
    }
    texto = montar(fatosCheios, propsCheias);
  }
  return texto;
}

interface OntologyLike {
  kinds: string[];
  rels: { rel: string; shape: string; domain_kinds: string[]; range_kinds: string[] }[];
  facts: { name: string; kind: string; unit: string; period: string | null }[];
  properties: { name: string; kind: string }[];
}

async function loadSpec(api: ApiClient, opts?: LoadOperationsOptions): Promise<unknown> {
  try {
    return await api.fetchOpenApi();
  } catch (liveErr) {
    let staticErr: unknown;
    for (const path of opts?.staticCandidates ?? staticSpecCandidates()) {
      try {
        return parseYaml(await readFile(path, "utf8"));
      } catch (err) {
        staticErr = err;
      }
    }
    throw new Error(
      `Não foi possível carregar o OpenAPI. A API em ${api.origin} está no ar? ` +
        `(live: ${(liveErr as Error).message}; estático: ${(staticErr as Error).message})`,
    );
  }
}

interface RawOperation {
  operationId?: string;
  summary?: string;
  description?: string;
  tags?: string[];
  "x-capability"?: string;
  parameters?: RawParam[];
  requestBody?: {
    content?: Record<string, { schema?: JsonSchema }>;
  };
  responses?: Record<string, { content?: Record<string, { schema?: JsonSchema }> }>;
}

/**
 * Resolve `$ref` local até o schema concreto. Body params do contrato apontam para
 * `#/components/schemas/*` (ex.: `doc` → ReportDocInput) e, sem resolver, `schema.type`
 * vem `undefined` — que `normalizeType` tratava como "string". Era o mecanismo exato
 * do createThesis quebrado. O limite de profundidade evita ciclo de $ref.
 */
function resolveRef(
  schema: JsonSchema | undefined,
  schemas: Record<string, JsonSchema>,
  depth = 0,
): JsonSchema | undefined {
  if (depth > 8) return schema;
  // `allOf: [{$ref}]` com description/deprecated ao lado é COMO a OpenAPI 3.0 anota
  // uma referência (irmãos de `$ref` são ignorados na 3.0). Sem desembrulhar, o
  // schema chega sem `type` e cai no mesmo "string" que tornou createThesis.doc
  // inutilizável — a anotação sozinha reintroduzia o bug.
  if (schema?.allOf?.length === 1 && !schema.type && !schema.properties) {
    const inner = resolveRef(schema.allOf[0], schemas, depth + 1);
    return inner ? { ...inner, description: schema.description ?? inner.description } : schema;
  }
  if (!schema?.$ref) return schema;
  const prefix = "#/components/schemas/";
  if (!schema.$ref.startsWith(prefix)) return schema;
  const key = decodeURIComponent(schema.$ref.slice(prefix.length).replace(/~1/g, "/").replace(/~0/g, "~"));
  const target = schemas[key];
  return target ? resolveRef(target, schemas, depth + 1) : schema;
}

/** ParamSpec a partir de um JsonSchema já resolvido, comum a query e body. */
function specFrom(
  name: string,
  where: ParamSpec["in"],
  required: boolean,
  raw: JsonSchema | undefined,
  schemas: Record<string, JsonSchema>,
  description?: string,
): ParamSpec {
  const schema = resolveRef(raw, schemas) ?? {};
  const type = normalizeType(schema);
  const items =
    type === "array" ? normalizeType(resolveRef(schema.items, schemas) ?? {}) : undefined;
  const alvo =
    type === "array" ? resolveRef(schema.items, schemas) : type === "object" ? schema : undefined;
  return {
    name,
    in: where,
    required,
    type,
    description: description ?? schema.description,
    enum: Array.isArray(schema.enum) ? schema.enum.map(String) : undefined,
    default: schema.default,
    items,
    shape: resumirForma(alvo, schemas),
    minimum: typeof schema.minimum === "number" ? schema.minimum : undefined,
    maximum: typeof schema.maximum === "number" ? schema.maximum : undefined,
  };
}

/**
 * "kind* (aposentadoria|reserva), description, max_pct (number)" — uma linha, não a
 * árvore. O objetivo é o modelo saber o que é obrigatório e o que é enum; validar
 * continua sendo trabalho do servidor, que já responde com o caminho do campo.
 *
 * Silencioso quando não há propriedades declaradas (objeto livre de verdade): inventar
 * um resumo vazio só ocuparia contexto.
 */
function resumirForma(
  schema: JsonSchema | undefined,
  schemas: Record<string, JsonSchema>,
): string | undefined {
  const alvo = resolveRef(schema, schemas);
  const props = alvo?.properties;
  if (!props || typeof props !== "object") return undefined;
  const obrigatorios = new Set(Array.isArray(alvo?.required) ? alvo.required.map(String) : []);
  const campos = Object.entries(props as Record<string, JsonSchema>).map(([nome, def]) => {
    const d = resolveRef(def, schemas) ?? {};
    const marca = obrigatorios.has(nome) ? "*" : "";
    const enums = Array.isArray(d.enum) ? d.enum.map(String) : null;
    const detalhe = enums ? enums.join("|") : normalizeType(d);
    return `${nome}${marca} (${detalhe})`;
  });
  return campos.length ? `campos: ${campos.join(", ")} — * é obrigatório` : undefined;
}

const METHODS = ["get", "post", "put", "patch", "delete"] as const;

export function extractOperations(spec: unknown): Operation[] {
  const document = spec as {
    paths?: Record<string, Record<string, unknown>>;
    components?: { schemas?: Record<string, JsonSchema> };
  };
  const paths = document.paths ?? {};
  const schemas = document.components?.schemas ?? {};
  const ops: Operation[] = [];
  for (const [path, item] of Object.entries(paths)) {
    for (const method of METHODS) {
      const raw = (item as Record<string, unknown>)[method] as RawOperation | undefined;
      if (!raw?.operationId) continue;
      const params = (raw.parameters ?? [])
        .map((p) => toParamSpec(p, schemas))
        .filter((p): p is ParamSpec => p !== null);
      // requestBody (JSON) vira parâmetros `in:"body"` — achatado no input da tool.
      const bodySchema = resolveRef(raw.requestBody?.content?.["application/json"]?.schema, schemas);
      const requiredBody = new Set(bodySchema?.required ?? []);
      for (const [name, schema] of Object.entries(bodySchema?.properties ?? {})) {
        params.push(specFrom(name, "body", requiredBody.has(name), schema, schemas));
      }
      ops.push({
        operationId: raw.operationId,
        path,
        method,
        summary: raw.summary,
        description: raw.description,
        tags: raw.tags ?? [],
        capability: raw["x-capability"],
        params,
        responseSchema: successResponseSchema(raw),
        schemas,
      });
    }
  }
  return ops.sort((a, b) => a.operationId.localeCompare(b.operationId));
}

function successResponseSchema(op: RawOperation): JsonSchema | undefined {
  const successes = Object.entries(op.responses ?? {})
    .filter(([status]) => /^2\d\d$/.test(status))
    .sort(([a], [b]) => Number(a) - Number(b));
  for (const [, response] of successes) {
    const schema = response.content?.["application/json"]?.schema;
    if (schema) return schema;
  }
  return undefined;
}

function toParamSpec(p: RawParam, schemas: Record<string, JsonSchema>): ParamSpec | null {
  if (p.in !== "path" && p.in !== "query") return null;
  return specFrom(p.name, p.in, p.required ?? p.in === "path", p.schema, schemas, p.description);
}

/**
 * Tipo do parâmetro a partir do schema RESOLVIDO. O fallback para "string" só vale
 * para schema sem tipo declarado e sem forma de objeto/array — antes ele engolia
 * também `$ref` e `type: object`, e era assim que um ReportDoc virava string.
 */
function normalizeType(schema: JsonSchema): ParamSpec["type"] {
  const t = schema.type;
  const v = Array.isArray(t) ? t.find((x) => x !== "null") : t;
  if (v === "integer") return "integer";
  if (v === "number") return "number";
  if (v === "boolean") return "boolean";
  if (v === "array" || (!v && schema.items)) return "array";
  if (v === "object" || (!v && schema.properties)) return "object";
  return "string";
}
