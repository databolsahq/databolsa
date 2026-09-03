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
import { extractOperations } from "@databolsa/sdk/openapi";
import type { Operation } from "@databolsa/sdk/openapi";
import { parse as parseYaml } from "yaml";
import type { ApiClient } from "./api-client";

export { extractOperations };
export type { JsonSchema, Operation, ParamSpec } from "@databolsa/sdk/openapi";

/**
 * Caminhos candidatos do `openapi.yaml` estático, em ordem de tentativa. O layout
 * difere entre o pacote PUBLICADO e a árvore de FONTE:
 *   1) `./openapi.yaml` — ao lado do bundle no pacote publicado (`dist/openapi.yaml`,
 *      copiado pelo build; incluído via `files: ["dist"]`).
 *   2) `../../../../api/openapi.yaml` — layout de fonte no repo (`packages/core/mcp/src/` → raiz).
 * O publicado acha (1); rodando do fonte em dev acha (2). Antes esta era a única
 * tentativa e, no publicado, `import.meta.url`=`…/dist/index.js` resolvia p/
 * `…/node_modules/api/openapi.yaml` (inexistente) → o MCP nem bootava offline.
 */
export function staticSpecCandidates(moduleUrl: string = import.meta.url): string[] {
  return [
    fileURLToPath(new URL("./openapi.yaml", moduleUrl)),
    fileURLToPath(new URL("../../../../api/openapi.yaml", moduleUrl)),
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
  /**
   * O segundo eixo do recorte: os `x-lifecycle` que a operação precisa carregar para entrar.
   * Ausente = todo lifecycle passa. Operação sem carimbo (conta, sistema) nunca é barrada por
   * este eixo — é a capacidade quem decide sobre ela.
   */
  lifecycles?: string[];
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
 * Monta as `instructions` do server MCP a partir do próprio contrato: `info.description` (as
 * convenções globais), a descrição de cada tag (a desambiguação entre domínios) e um índice por
 * domínio com contagem. Derivar do spec evita que a orientação divirja do contrato.
 */
export function buildInstructions(spec: unknown, opts: { operations?: Iterable<string> } = {}): string {
  const doc = spec as {
    info?: { title?: string; description?: string; version?: string };
    tags?: Array<{ name?: string; description?: string }>;
  };
  const selected = opts.operations ? new Set(opts.operations) : null;
  const operations = extractOperations(spec).filter(
    (operation) => !selected || selected.has(operation.operationId),
  );

  const porTag = new Map<string, number>();
  for (const op of operations) {
    for (const tag of op.tags.length > 0 ? op.tags : ["(sem categoria)"]) {
      porTag.set(tag, (porTag.get(tag) ?? 0) + 1);
    }
  }

  const descricaoDaTag = new Map(
    (doc.tags ?? []).filter((t) => t.name).map((t) => [t.name!, t.description?.trim()]),
  );

  // Domínios maiores primeiro; empate por nome para saída estável.
  const linhas = [...porTag.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([tag, n]) => {
      const desc = descricaoDaTag.get(tag);
      return `- ${tag} (${n} ${n === 1 ? "operação" : "operações"})${desc ? `: ${desc}` : ""}`;
    });

  const partes = [
    `${doc.info?.title ?? "DataBolsa"}${doc.info?.version ? ` v${doc.info.version}` : ""} — ${operations.length} ${operations.length === 1 ? "operação" : "operações"}, uma tool por operação.`,
  ];
  if (doc.info?.description?.trim()) partes.push(doc.info.description.trim());
  if (linhas.length > 0) partes.push(`Domínios disponíveis:\n${linhas.join("\n")}`);
  const digest = ontologyDigest(spec, { operations: operations.map((operation) => operation.operationId) });
  if (digest) partes.push(digest);
  const available = new Set(operations.map((operation) => operation.operationId));
  const discovery = [
    ["search", "resolve nome ou ticker para a entidade certa"],
    ["listObjects", "enumera os objetos de um tipo (ex.: `kind=data_series` para as séries macro)"],
    ["getDocumentTaxonomy", "lista as categorias de documento"],
    ["getHealth", "informa o frescor de cada fonte"],
  ]
    .filter(([operationId]) => available.has(operationId!))
    .map(([operationId, purpose]) => `\`${operationId}\` ${purpose}`);
  if (discovery.length > 0) {
    partes.push(`Para descobrir o que existe antes de consultar: ${discovery.join("; ")}.`);
  }
  partes.push(
    "Nomes de operação são estáveis. A cobertura inclui mercados locais e globais, com maior profundidade no Brasil.",
  );
  return partes.join("\n\n");
}


/**
 * O digest da ontologia: o vocabulário do grafo em texto curto para as instruções do MCP e o
 * prompt do agente, lido de `x-ontology`. Entra o que decide a próxima chamada: verbos com forma
 * e pontas, medidas por tipo com unidade. O teto é em bytes (`maxBytes`, default 6 KB), com dois
 * cortes: só o que o perfil alcança, e depois resumo por tipo apontando a operação de catálogo.
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
  if (ops && !Object.values(ALCANCE).some((operations) => alcanca(operations))) return "";

  const porKind = (itens: { kind: string; texto: string }[]) => {
    const m = new Map<string, string[]>();
    for (const i of itens) m.set(i.kind, [...(m.get(i.kind) ?? []), i.texto]);
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  };

  const cabecalho = [
    "VOCABULÁRIO DO GRAFO (não gaste chamada em listObjectRelations ou listFactCatalog para descobri-lo):",
    `Tipos de objeto: ${o.kinds.join(", ")}.`,
  ];
  const rodape = alcanca(ALCANCE.facts)
    ? "Leitura em lote: getObjectFacts e getObjectHistory aceitam vários ids separados por vírgula (até 50) e várias medidas em facts= (até 10); resolveObject aceita q=a|b. Compare N objetos numa chamada."
    : "";

  const rels = alcanca(ALCANCE.rels)
    ? `Verbos (forma; de → para). event: total de todos os tempos; snapshot: último retrato (use at); static: vigente, recusa data passada:\n${o.rels
        .map((r) => `- ${r.rel} (${r.shape}; ${r.domain_kinds.join("|") || "?"} → ${r.range_kinds.join("|") || "?"})`)
        .join("\n")}`
    : "";

  // Fatos e propriedades em duas resoluções (lista ou resumo por tipo), escolhidas até caber no teto.
  const fatos = alcanca(ALCANCE.facts) ? porKind(o.facts.map((f) => ({ kind: f.kind, texto: `${f.name}:${f.unit}` }))) : [];
  const props = alcanca(ALCANCE.properties) ? porKind(o.properties.map((p) => ({ kind: p.kind, texto: p.name }))) : [];

  const montar = (fatosCheios: Set<string>, propsCheias: Set<string>) => {
    const blocoFatos = fatos.length
      ? `Medidas por tipo, como nome:unidade (ratio é fração, pct é percentual; use o nome em facts= de getObjectFacts ou getObjectHistory):\n${fatos
          .map(([kind, l]) => (fatosCheios.has(kind) ? `- ${kind}: ${l.join(", ")}` : `- ${kind}: ${l.length} medidas, ver listFactCatalog?kind=${kind}`))
          .join("\n")}`
      : "";
    const blocoProps = props.length
      ? `Propriedades por tipo (getObjectProperties e where=):\n${props
          .map(([kind, l]) => (propsCheias.has(kind) ? `- ${kind}: ${l.join(", ")}` : `- ${kind}: ${l.length} propriedades, ver getObjectProperties`))
          .join("\n")}`
      : "";
    return [...cabecalho, rels, blocoFatos, blocoProps, rodape].filter(Boolean).join("\n\n");
  };

  // Resume primeiro o tipo que mais pesa; propriedades cedem antes das medidas.
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
