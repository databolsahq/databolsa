import type { DataBolsaClient } from "../client";
import type { ObjectLinksResponse, ObjectResolveResponse, ObjectResponse } from "../types";
import petr14 from "./__fixtures__/petr14.json";
import petr4 from "./__fixtures__/petr4.json";
import petrobras from "./__fixtures__/petrobras.json";

/**
 * Um `DataBolsaClient` de mentira para os testes da façade: responde com os mapas de produção
 * de 28/08/2026 e GRAVA cada chamada. O que se testa aqui é a TRADUÇÃO — que `petr4.market.quotes`
 * vira `listQuotes("PETR4", …)` — e não o transporte, que é do `HttpClient`.
 */
export const MAPAS: Record<string, ObjectResponse> = {
  [petrobras.id]: petrobras as unknown as ObjectResponse,
  [petr4.id]: petr4 as unknown as ObjectResponse,
  [petr14.id]: petr14 as unknown as ObjectResponse,
};

export interface Chamada {
  op: string;
  args: unknown[];
}

const aresta = (over: Partial<ObjectLinksResponse["data"][number]>): ObjectLinksResponse["data"][number] =>
  ({
    rel: "issued",
    shape: "event",
    direction: "out",
    other_id: "",
    other_kind: "instrument",
    other_subkind: null,
    other_name: null,
    other_code: null,
    other_key_type: null,
    other_key: null,
    source: "",
    valid_from: null,
    valid_to: null,
    observations: 1,
    magnitude: null,
    magnitude_unit: null,
    evidence: null,
    evidence_unit: null,
    confidence: "high",
    ...over,
  }) as ObjectLinksResponse["data"][number];

/** As arestas `issued` de produção, resumidas: Petrobras emitiu 2 papéis e 2 debêntures. */
const ARESTAS: Record<string, ObjectLinksResponse["data"]> = {
  "pub_b58cbecf6730bf83:issued:out": [
    aresta({ other_id: "pub_b17f596e654e28b0", other_kind: "instrument", other_subkind: "debenture", other_name: "PETR14", other_code: "PETR14", other_key_type: "isin", other_key: "BRPETRDBS043", magnitude: 40000000 }),
    aresta({ other_id: "pub_2ae0927c6c8595f5", other_kind: "instrument", other_subkind: "cri", other_name: "PETR12", other_key_type: "isin", other_key: "BRPETRDBS019", magnitude: 1000 }),
    aresta({ other_id: "pub_3e80862b6163669c", other_kind: "equity_security", other_name: "PETR4 (PN)", other_key_type: "ticker", other_key: "PETR4" }),
    aresta({ other_id: "pub_petr3", other_kind: "equity_security", other_name: "PETR3 (ON)", other_key_type: "ticker", other_key: "PETR3" }),
  ],
  "pub_3e80862b6163669c:issued:in": [aresta({ direction: "in", other_id: "pub_b58cbecf6730bf83", other_kind: "company", other_name: "PETROBRAS", other_key_type: "cnpj", other_key: "33000167000101" })],
  "pub_b17f596e654e28b0:issued:in": [aresta({ direction: "in", other_id: "pub_b58cbecf6730bf83", other_kind: "company", other_name: "PETROBRAS", other_key_type: "cnpj", other_key: "33000167000101" })],
};

export function clienteFalso(over: Partial<DataBolsaClient> = {}): { db: DataBolsaClient; chamadas: Chamada[] } {
  const chamadas: Chamada[] = [];
  const grava = (op: string, args: unknown[]) => chamadas.push({ op, args });
  const vazio = { data: [], meta: { next_cursor: null, count: 0 } };
  const alvo: Record<string, unknown> = {
    getObject: async (id: string, p?: unknown) => {
      grava("getObject", [id, p]);
      const m = MAPAS[id];
      if (!m) throw new Error(`fixture sem ${id}`);
      return m;
    },
    resolveObject: async (p: { q: string | string[]; kind?: string }) => {
      grava("resolveObject", [p]);
      // Uma consulta ou várias: o lote é a mesma busca repetida, com um veredito por consulta
      // em `meta.queries` NA ORDEM de `q` — é essa ordem que a façade usa para casar.
      const consultas = Array.isArray(p.q) ? p.q : [p.q];
      const porConsulta = consultas.map((q) => {
        const todos = Object.values(MAPAS).filter((m) => m.tickers?.includes(q) || m.isin === q || m.cnpj === q || m.id === q);
        return { q, data: todos.filter((m) => !p.kind || m.kind === p.kind).map((m) => ({ query: q, id: m.id, kind: m.kind, subkind: m.subkind, name: m.name, anchor_type: m.anchor_type, anchor_value: m.anchor_value, match_kind: "exact_key", matched_key_type: m.anchor_type, matched_key_value: m.anchor_value, confidence: "high" })) };
      });
      const data = porConsulta.flatMap((c) => c.data);
      const r: ObjectResolveResponse = {
        data: data as ObjectResolveResponse["data"],
        meta: {
          next_cursor: null,
          count: data.length,
          queries: porConsulta.map((c) => ({ q: c.q, best_id: c.data.length === 1 ? (c.data[0]?.id ?? null) : null, candidates: c.data.length, reason: c.data.length === 0 ? "no_match" : c.data.length > 1 ? "ambiguous" : null })),
        },
      };
      return r;
    },
    listObjects: async (p?: unknown) => (grava("listObjects", [p]), { data: [{ id: petr4.id, kind: "equity_security", subkind: "pn", name: "PETR4 (PN)", anchor_type: "ticker", anchor_value: "PETR4" }], meta: { next_cursor: null, count: 1, filterable_properties: [] } }),
    rankObjects: async (p?: unknown) => (grava("rankObjects", [p]), { data: [{ id: petr4.id, name: "PETR4 (PN)", kind: "equity_security", subkind: "pn", value: 36.1, value_from: null, value_to: null, as_of: "2025-01-02", statement_date: null }], meta: { next_cursor: null, count: 1, warnings: [] } }),
    aggregateObjects: async (p?: unknown) => (grava("aggregateObjects", [p]), { data: [{ key: "Petróleo e Gás", label: "Petróleo e Gás", entity_id: null, value: 36.1, objects: 3, with_value: 1 }], meta: { next_cursor: null, count: 1 } }),
    listObjectLinks: async (id: string, p: { rel?: string; direction?: string }) => {
      grava("listObjectLinks", [id, p]);
      const data = ARESTAS[`${id}:${p.rel}:${p.direction}`] ?? [];
      return { data, meta: { next_cursor: null, count: data.length } };
    },
    getObjectFacts: async (id: string, p?: unknown) => (grava("getObjectFacts", [id, p]), { ...vazio, meta: { ...vazio.meta, subjects: [] } }),
    getObjectHistory: async (id: string, p: { facts: string }) => {
      grava("getObjectHistory", [id, p]);
      const conhecida = p.facts === "close";
      return {
        data: conhecida ? [{ entity_id: id, fact: "close", label: "Fechamento ajustado", points: [{ date: "2025-01-02", value: 36.1 }], count: 1, truncated: false, error: null }] : [],
        meta: { next_cursor: null, count: 1, truncated: false, warnings: [], subjects: [{ id, resolved_id: id, redirected_from: null, status: conhecida ? "ok" : "unknown_fact", reason: conhecida ? null : `medida "${p.facts}" não existe para ${id}` }] },
      };
    },
    listQuotes: async (t: string, p?: unknown) => (grava("listQuotes", [t, p]), vazio),
    getStockIndicators: async (t: string, p?: unknown) => (grava("getStockIndicators", [t, p]), {}),
    listCreditRatings: async (p?: unknown) => (grava("listCreditRatings", [p]), vazio),
    listCorporateEvents: async (t: string, p?: unknown) => (grava("listCorporateEvents", [t, p]), vazio),
    listCompanyDocuments: async (c: string, p?: unknown) => (grava("listCompanyDocuments", [c, p]), vazio),
    ...over,
  };
  return { db: alvo as unknown as DataBolsaClient, chamadas };
}
