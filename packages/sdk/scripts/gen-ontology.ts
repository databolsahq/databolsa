/**
 * Gera `src/ontology.ts` a partir de `api/ontology.json` — o manifesto de ontologia publicado
 * junto do contrato. Roda como parte de `gen:api`, depois de `gen:schema`.
 *
 * O que sai é TIPO, não cliente: `ObjectKind`, `Rel`, `FactName<K>`, `PropertyName<K>` e a
 * constante `ONTOLOGY` para quem quiser percorrer o vocabulário em runtime. Nome que não
 * está no manifesto continua aceito como `string` nos métodos do cliente, de propósito: o
 * contrato cresce e um SDK antigo não pode recusar uma medida nova.
 */
const entrada = new URL("../../../api/ontology.json", import.meta.url);
const saida = new URL("../src/ontology.ts", import.meta.url);

interface Manifesto {
  version: number;
  kinds: string[];
  rels: { rel: string; shape: string; domain_kinds: string[]; range_kinds: string[] }[];
  facts: { name: string; kind: string; unit: string; period: string | null; cadence: string; grain: string; concept: string | null }[];
  properties: { name: string; kind: string; vocabulary: string[] | null }[];
  aspects: { kind: string; name: string; operation: string; parameter: string }[];
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
  "/** Nome do manifesto OU qualquer string: o contrato cresce e um SDK antigo não pode recusar o novo. */",
  "export type Loose<T extends string> = T | (string & {});",
  "",
  "export const ONTOLOGY = {",
  `  version: ${m.version},`,
  `  kinds: ${JSON.stringify(m.kinds)},`,
  `  rels: ${JSON.stringify(m.rels.map((r) => ({ rel: r.rel, shape: r.shape, domain_kinds: r.domain_kinds, range_kinds: r.range_kinds })))},`,
  `  facts: ${JSON.stringify(m.facts.map((f) => ({ name: f.name, kind: f.kind, unit: f.unit, period: f.period, cadence: f.cadence, grain: f.grain, concept: f.concept })))},`,
  `  properties: ${JSON.stringify(m.properties.map((p) => ({ name: p.name, kind: p.kind, vocabulary: p.vocabulary })))},`,
  `  aspects: ${JSON.stringify(m.aspects.map((a) => ({ kind: a.kind, name: a.name, operation: a.operation, parameter: a.parameter })))},`,
  "} as const;",
  "",
];

await Bun.write(saida, `${linhas.join("\n")}`);
console.log(`[gen-ontology] ${m.kinds.length} tipos, ${m.rels.length} verbos, ${m.facts.length} medidas → src/ontology.ts`);
