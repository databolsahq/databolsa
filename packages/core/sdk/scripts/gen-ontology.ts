/**
 * Gera `src/ontology.ts` a partir de `api/ontology.json` — o manifesto de ontologia publicado
 * junto do contrato. Roda como parte de `gen:api`, depois de `gen:schema`.
 *
 * O que sai é TIPO, não cliente: `ObjectKind`, `Rel`, `FactName<K>`, `PropertyName<K>` e a
 * constante `ONTOLOGY` para quem quiser percorrer o vocabulário em runtime. Nome que não
 * está no manifesto continua aceito como `string` nos métodos do cliente, de propósito: o
 * contrato cresce e um SDK antigo não pode recusar uma medida nova.
 */
const entrada = new URL("../../../../api/ontology.json", import.meta.url);
const saida = new URL("../src/ontology.ts", import.meta.url);

interface Manifesto {
  version: number;
  kinds: string[];
  rels: { rel: string; shape: string; domain_kinds: string[]; range_kinds: string[]; forward_name: string | null; inverse_name: string | null }[];
  facts: { name: string; kind: string; unit: string; period: string | null; cadence: string; grain: string; concept: string }[];
  properties: { name: string; kind: string; vocabulary: string[] | null }[];
  aspects: { kind: string; name: string; id: string; authority: string; stability: string; subject_key_type: string; operation: string; parameter: string; grain: string; shape: string }[];
  bindings: { operation: string; path_parameters: string[]; temporal_parameter: "at" | "date" | "to" | null }[];
}

const m = (await Bun.file(entrada).json()) as Manifesto;

const porKind = <T extends { kind: string; name: string }>(itens: T[]) => {
  const mapa = new Map<string, string[]>();
  for (const i of itens) {
    const lista = mapa.get(i.kind) ?? [];
    if (!lista.includes(i.name)) lista.push(i.name);
    mapa.set(i.kind, lista);
  }
  return mapa;
};

const literal = (v: string) => JSON.stringify(v);
const uniao = (vals: string[]) => (vals.length ? vals.map(literal).join(" | ") : "never");

const fatos = porKind(m.facts);
const props = porKind(m.properties);

/**
 * OS ACESSORES DE RELAÇÃO, por tipo: `forward_name` em quem pratica o verbo, `inverse_name`
 * em quem recebe. Nome ausente é erro de BUILD — o seed é obrigado a nomear as duas pontas —
 * porque um acessor sem nome viraria um método que o SDK não consegue oferecer.
 */
const relacoes = new Map<string, Map<string, string>>();
for (const r of m.rels) {
  if (!r.forward_name || !r.inverse_name) throw new Error(`[gen-ontology] verbo ${r.rel} sem forward_name/inverse_name no manifesto`);
  const registrar = (k: string, nome: string, alvo: string) => {
    const mapa = relacoes.get(k) ?? new Map<string, string>();
    const dono = mapa.get(nome);
    if (dono && dono !== alvo) throw new Error(`[gen-ontology] ${k}.${nome} aponta para ${dono} e ${alvo}`);
    mapa.set(nome, alvo);
    relacoes.set(k, mapa);
  };
  const simetrico = r.forward_name === r.inverse_name;
  for (const k of r.domain_kinds) registrar(k, r.forward_name, simetrico ? `${r.rel}:both` : `${r.rel}:out`);
  for (const k of r.range_kinds) registrar(k, r.inverse_name, simetrico ? `${r.rel}:both` : `${r.rel}:in`);
}

/** Função → operação do contrato que a serve hoje (binding transitório). Uma função, uma operação. */
const operacaoDaFuncao = new Map<string, string>();
for (const a of m.aspects) {
  const dono = operacaoDaFuncao.get(a.id);
  if (dono && dono !== a.operation) throw new Error(`[gen-ontology] função ${a.id} servida por ${dono} e ${a.operation}`);
  operacaoDaFuncao.set(a.id, a.operation);
}

/** Acessor → tipos do outro lado (range em quem pratica, domínio em quem recebe; os dois no simétrico). */
const alvos = new Map<string, Map<string, Set<string>>>();
for (const r of m.rels) {
  const registrar = (k: string, nome: string, tipos: string[]) => {
    const mapa = alvos.get(k) ?? new Map<string, Set<string>>();
    const s = mapa.get(nome) ?? new Set<string>();
    for (const t of tipos) s.add(t);
    mapa.set(nome, s);
    alvos.set(k, mapa);
  };
  const simetrico = r.forward_name === r.inverse_name;
  for (const k of r.domain_kinds) registrar(k, r.forward_name!, simetrico ? [...r.range_kinds, ...r.domain_kinds] : r.range_kinds);
  for (const k of r.range_kinds) registrar(k, r.inverse_name!, simetrico ? [...r.range_kinds, ...r.domain_kinds] : r.domain_kinds);
}

const linhas: string[] = [
  "// Gerado por scripts/gen-ontology.ts a partir de api/ontology.json. Não edite à mão.",
  "// Regenere com `bun run gen:ontology` (ou `bun run gen:api` na raiz).",
  "",
  `export const ONTOLOGY_VERSION = ${m.version} as const;`,
  "",
  `export type ObjectKind = ${uniao(m.kinds)};`,
  "",
  `export type Rel = ${uniao(m.rels.map((r) => r.rel))};`,
  "",
  "/** As medidas que cada tipo publica em `getObjectFacts`/`getObjectHistory`. */",
  "export interface FactsByKind {",
  ...m.kinds.map((k) => `  ${literal(k)}: ${uniao(fatos.get(k) ?? [])};`),
  "}",
  "export type FactName<K extends ObjectKind = ObjectKind> = FactsByKind[K];",
  "",
  "/** As propriedades que cada tipo publica em `getObjectProperties` e aceita em `where`. */",
  "export interface PropertiesByKind {",
  ...m.kinds.map((k) => `  ${literal(k)}: ${uniao(props.get(k) ?? [])};`),
  "}",
  "export type PropertyName<K extends ObjectKind = ObjectKind> = PropertiesByKind[K];",
  "",
  "/**",
  " * Os acessores de relação de cada tipo — nome → `verbo:direção`. `company.issued()` atravessa",
  " * `issued` para fora; `paper.issuer()` atravessa para dentro; `both` é verbo simétrico. É deste",
  " * mapa que `ObjectHandle` ganha um método por relação, sem código escrito à mão.",
  " */",
  "export interface RelationNamesByKind {",
  ...m.kinds.map((k) => `  ${literal(k)}: { ${[...(relacoes.get(k) ?? new Map())].map(([n, a]) => `${n}: ${literal(a)}`).join("; ")} };`),
  "}",
  "",
  "/** As FUNÇÕES do registry que cada tipo publica em `aspects` (`market.quotes.history`, `credit.ratings.list`…). */",
  "export interface FunctionsByKind {",
  ...m.kinds.map((k) => `  ${literal(k)}: ${uniao([...new Set(m.aspects.filter((a) => a.kind === k).map((a) => a.id))].sort())};`),
  "}",
  "export type FunctionId<K extends ObjectKind = ObjectKind> = FunctionsByKind[K];",
  "",
  "/** O parâmetro de SUJEITO de cada função (`ticker`, `issuerCnpj`…): vem de `defaults`, e o chamador não o troca. */",
  "export interface FunctionSubjectParams {",
  ...[...operacaoDaFuncao.keys()].sort().map((f) => `  ${literal(f)}: ${uniao([...new Set(m.aspects.filter((a) => a.id === f).map((a) => a.parameter))].sort())};`),
  "}",
  "",
  "/** A operação do contrato que serve cada função HOJE — é dela que o SDK deriva parâmetros e resposta. */",
  "export interface FunctionOperations {",
  ...[...operacaoDaFuncao].sort(([a], [b]) => a.localeCompare(b)).map(([f, op]) => `  ${literal(f)}: ${literal(op)};`),
  "}",
  "",
  "/** Os TIPOS do outro lado de cada acessor de relação — `petr4.holders()` devolve fundos, `petr4.issuer()` companhia/fundo. */",
  "export interface RelationTargetsByKind {",
  ...m.kinds.map((k) => `  ${literal(k)}: { ${[...(alvos.get(k) ?? new Map())].sort(([a], [b]) => a.localeCompare(b)).map(([n, ts]) => `${n}: ${uniao([...ts].sort())}`).join("; ")} };`),
  "}",
  "",
  "/** Nome do manifesto OU qualquer string: o contrato cresce e um SDK antigo não pode recusar o novo. */",
  "export type Loose<T extends string> = T | (string & {});",
  "",
  "export const ONTOLOGY = {",
  `  version: ${m.version},`,
  `  kinds: ${JSON.stringify(m.kinds)},`,
  `  rels: ${JSON.stringify(m.rels.map((r) => ({ rel: r.rel, shape: r.shape, domain_kinds: r.domain_kinds, range_kinds: r.range_kinds, forward_name: r.forward_name, inverse_name: r.inverse_name })))},`,
  `  facts: ${JSON.stringify(m.facts.map((f) => ({ name: f.name, kind: f.kind, unit: f.unit, period: f.period, cadence: f.cadence, grain: f.grain, concept: f.concept })))},`,
  `  properties: ${JSON.stringify(m.properties.map((p) => ({ name: p.name, kind: p.kind, vocabulary: p.vocabulary })))},`,
  `  aspects: ${JSON.stringify(m.aspects.map((a) => ({ kind: a.kind, name: a.name, id: a.id, authority: a.authority, stability: a.stability, subject_key_type: a.subject_key_type, operation: a.operation, parameter: a.parameter, grain: a.grain, shape: a.shape })))},`,
  "  /** Por operação: chaves de `defaults` que viajam no caminho (na ordem do path) e qual parâmetro recebe um corte temporal. */",
  `  bindings: ${JSON.stringify(m.bindings)},`,
  "} as const;",
  "",
];

await Bun.write(saida, `${linhas.join("\n")}`);
console.log(`[gen-ontology] ${m.kinds.length} tipos, ${m.rels.length} verbos, ${m.facts.length} medidas → src/ontology.ts`);
