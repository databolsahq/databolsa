import type { DataBolsaClient } from "../client";
import type { FactName, Loose, ObjectKind } from "../ontology";
import type { ObjectAggregateResponse, ObjectListResponse, ObjectQuery, ObjectRankResponse, ObjectResolveResponse, ObjectResponse, ObjectTableResult } from "../types";
import { AmbiguousObjectError, ObjectNotFoundError, type ObjectCandidateRef } from "./errors";
import type { Fabrica } from "./handle";
import { fabricaDeHandles, type AnyObjectHandle, type HandleOf } from "./kinds";

export interface ResolveOpts {
  /** Recorta DENTRO do tipo: `fii`, `fidc`, `debenture`, `bdr`… */
  subkind?: string;
  limit?: number;
}

/**
 * O veredito de UMA consulta de `resolveMany`. Nem sucesso nem exceção: um lote de 30 tickers
 * em que dois não existem tem de devolver 28 objetos e dois motivos, e não perder os 28 no
 * primeiro que faltou.
 */
export type ResolveOutcome<H = AnyObjectHandle> =
  | { q: string; status: "resolved"; handle: H }
  | { q: string; status: "ambiguous"; candidates: ObjectCandidateRef[] }
  | { q: string; status: "not_found" };

/** Quantas consultas cabem numa chamada de `resolveObject` — o teto é do contrato. */
const LOTE_DE_RESOLUCAO = 20;

/**
 * Os nomes que mudam de grafia entre a façade (camelCase, como o resto do SDK) e o contrato
 * (snake_case). É um mapa EXPLÍCITO e não uma conversão de caixa: `relTo` vira `rel_to` porque
 * está escrito aqui, então nome novo no contrato não é adivinhado — é acrescentado.
 */
const NOMES_NO_FIO = {
  relTo: "rel_to",
  relDirection: "rel_direction",
  groupBy: "group_by",
  groupByDirection: "group_by_direction",
  sinceFrom: "since_from",
  expandDirection: "expand_direction",
  orderBy: "order_by",
  excludeOutOfPrior: "exclude_out_of_prior",
} as const;

type NomeNoFio<K> = K extends keyof typeof NOMES_NO_FIO ? (typeof NOMES_NO_FIO)[K] : K;
type Traduzido<T> = { [K in keyof T as NomeNoFio<K>]: T[K] };

function noFio<T extends object>(params: T): Traduzido<T> {
  const saida: Record<string, unknown> = {};
  for (const [chave, valor] of Object.entries(params)) {
    if (valor === undefined) continue;
    saida[(NOMES_NO_FIO as Record<string, string>)[chave] ?? chave] = valor;
  }
  return saida as Traduzido<T>;
}

/** Enumerar o universo de um tipo, sem medida. Corte numérico é de `rank`. */
export interface ListParams {
  kind: Loose<ObjectKind>;
  /** Recorta DENTRO do tipo: `fii`, `fidc`, `debenture`, `bdr`… */
  subkind?: string;
  rel?: string;
  relTo?: string;
  relDirection?: "in" | "out";
  at?: string;
  where?: string;
  /** Busca por nome DENTRO da coorte (palavras em qualquer ordem, sem acento); pagina com `cursor`. */
  q?: string;
  total?: boolean;
  limit?: number;
  cursor?: string;
}

/** A coorte ordenada por uma medida. */
export interface RankParams {
  kind: Loose<ObjectKind>;
  fact: Loose<FactName>;
  subkind?: string;
  measure?: "value" | "delta" | "pct_change";
  at?: string;
  from?: string;
  order?: "asc" | "desc";
  limit?: number;
  rel?: string;
  relTo?: string;
  relDirection?: "in" | "out";
  since?: string;
  sinceFrom?: string;
  excludeOutOfPrior?: boolean;
  expand?: string;
  expandDirection?: "out" | "in";
  where?: string;
}

/** A mesma coorte reduzida a um resumo por grupo. Sem `fact`, `agg: "count"` é o censo. */
export interface AggregateParams {
  kind: Loose<ObjectKind>;
  fact?: Loose<FactName>;
  agg: "sum" | "avg" | "median" | "min" | "max" | "count";
  groupBy: string;
  groupByDirection?: "out" | "in";
  subkind?: string;
  at?: string;
  rel?: string;
  relTo?: string;
  relDirection?: "in" | "out";
  limit?: number;
  /** Cursor de `meta.next_cursor` da página anterior de GRUPOS. */
  cursor?: string;
  /** Busca no rótulo do grupo (gestora, setor…). */
  q?: string;
  where?: string;
  orderBy?: "value" | "objects";
  excludeOutOfPrior?: boolean;
}

/**
 * `db.objects` — a entrada object-first do SDK.
 *
 * Começa por algo que o consumidor conhece (ticker, CNPJ, ISIN, nome) e devolve um handle
 * tipado pelo `kind`, de onde saem fatos, relações e capítulos sem que ninguém precise saber
 * qual endpoint responde por baixo. É uma façade sobre o mapa que `getObject` já publica; os
 * métodos flat continuam ao lado, inalterados, como escape hatch tipado.
 */
export class Objects {
  private readonly fabrica: Fabrica;

  constructor(private readonly db: DataBolsaClient) {
    this.fabrica = fabricaDeHandles(db);
  }

  /** Os candidatos crus de `resolveObject`, para quem quer decidir por conta própria. */
  resolve(q: string, opts: ResolveOpts & { kind?: string } = {}): Promise<ObjectResolveResponse> {
    return this.db.resolveObject({ q, kind: opts.kind, subkind: opts.subkind, limit: opts.limit });
  }

  /**
   * UM objeto para o texto, ou erro. Com `kind`, o handle já vem estreitado; sem ele, é a união
   * discriminada por `kind`. Ambiguidade é erro com os candidatos, nunca o primeiro da lista.
   */
  resolveOne<K extends ObjectKind>(q: string, opts: ResolveOpts & { kind: K }): Promise<HandleOf<K>>;
  resolveOne(q: string, opts?: ResolveOpts): Promise<AnyObjectHandle>;
  async resolveOne(q: string, opts: ResolveOpts & { kind?: string } = {}): Promise<AnyObjectHandle | HandleOf<ObjectKind>> {
    const r = await this.resolve(q, { ...opts, limit: opts.limit ?? 5 });
    const veredito = r.meta.queries[0];
    // Ambiguidade ANTES de "não achou": as duas chegam com `best_id: null`, e testar o id
    // primeiro transformaria dois candidatos em nenhum — o erro que esconde os candidatos.
    if (veredito?.reason === "ambiguous") throw new AmbiguousObjectError(q, r.data.map((c) => ({ id: c.id, kind: c.kind, subkind: c.subkind, name: c.name })));
    if (!veredito || veredito.best_id === null) throw new ObjectNotFoundError(q);
    const melhor = r.data.find((c) => c.id === veredito.best_id) ?? r.data[0];
    if (!melhor) throw new ObjectNotFoundError(q);
    return this.fabrica({ id: melhor.id, kind: melhor.kind, subkind: melhor.subkind, name: melhor.name, code: codigoDoCandidato(melhor) }) as AnyObjectHandle;
  }

  /**
   * MUITOS textos numa ida só. Devolve um veredito por consulta, NA ORDEM em que vieram, e
   * nunca lança por ambiguidade ou ausência: quem pede 30 tickers de uma carteira precisa dos
   * que resolveram e do motivo dos que não, não de uma exceção no primeiro furo.
   */
  resolveMany<K extends ObjectKind>(qs: readonly string[], opts: ResolveOpts & { kind: K }): Promise<ResolveOutcome<HandleOf<K>>[]>;
  resolveMany(qs: readonly string[], opts?: ResolveOpts & { kind?: string }): Promise<ResolveOutcome[]>;
  async resolveMany(qs: readonly string[], opts: ResolveOpts & { kind?: string } = {}): Promise<ResolveOutcome[] | ResolveOutcome<HandleOf<ObjectKind>>[]> {
    const saida: ResolveOutcome[] = [];
    for (let i = 0; i < qs.length; i += LOTE_DE_RESOLUCAO) {
      const lote = qs.slice(i, i + LOTE_DE_RESOLUCAO);
      const r = await this.db.resolveObject({ q: lote, kind: opts.kind, subkind: opts.subkind, limit: opts.limit });
      for (const [j, q] of lote.entries()) {
        // O veredito casa por POSIÇÃO dentro do lote, mas confere `q` antes de acreditar: um
        // deslocamento silencioso daria a resposta do vizinho ao objeto errado.
        const posicional = r.meta.queries[j];
        const veredito = posicional && posicional.q === q ? posicional : r.meta.queries.find((v) => v.q === q);
        if (!veredito) {
          saida.push({ q, status: "not_found" });
          continue;
        }
        const candidatos = r.data.filter((c) => c.query === veredito.q);
        // A mesma ordem de `resolveOne`: ambiguidade ANTES de "não achou", porque as duas
        // chegam com `best_id: null` e testar o id primeiro esconderia os candidatos.
        if (veredito.reason === "ambiguous") {
          saida.push({ q, status: "ambiguous", candidates: candidatos.map((c) => ({ id: c.id, kind: c.kind, subkind: c.subkind, name: c.name })) });
          continue;
        }
        const melhor = veredito.best_id === null ? undefined : (candidatos.find((c) => c.id === veredito.best_id) ?? candidatos[0]);
        if (!melhor) {
          saida.push({ q, status: "not_found" });
          continue;
        }
        saida.push({ q, status: "resolved", handle: this.fabrica({ id: melhor.id, kind: melhor.kind, subkind: melhor.subkind, name: melhor.name, code: codigoDoCandidato(melhor) }) as AnyObjectHandle });
      }
    }
    return saida;
  }

  /** A coorte por identidade: todo objeto de um tipo, sem exigir medida. Envelope cru, com cursor. */
  list(params: ListParams): Promise<ObjectListResponse> {
    return this.db.listObjects(noFio(params));
  }

  /** A coorte ordenada por uma medida — `measure: "delta"` exige `from`, que é a outra ponta da janela. */
  rank(params: RankParams): Promise<ObjectRankResponse> {
    return this.db.rankObjects(noFio(params));
  }

  /** A coorte resumida por grupo. `agg: "count"` sem `fact` é o censo: quantos objetos por grupo. */
  aggregate(params: AggregateParams): Promise<ObjectAggregateResponse> {
    return this.db.aggregateObjects(noFio(params));
  }

  /**
   * Executa uma `ObjectQuery` e devolve a TABELA canônica — a forma que um notebook consome sem
   * conhecer a operação. Aceita a própria `meta.query` de uma resposta anterior, então a consulta
   * é reexecutável como veio.
   */
  table(query: ObjectQuery): Promise<ObjectTableResult> {
    if (query.operation !== "getObjectHistory" && query.operation !== "rankObjects" && query.operation !== "getObjectFacts" && query.operation !== "aggregateObjects") {
      return Promise.reject(new Error(`\`${query.operation}\` ainda não tem projeção tabular (só getObjectHistory, getObjectFacts, rankObjects e aggregateObjects).`));
    }
    return this.db.getObjectTable({ operation: query.operation, id: query.subject?.entity_id, input: query.input });
  }

  /** O objeto por id publicado, já com o mapa carregado. Id fundido redireciona; cindido responde erro (409). */
  async get(id: string, opts: { resolve?: "auto" | "exact" } = {}): Promise<AnyObjectHandle> {
    const mapa = await this.db.getObject(id, opts);
    return this.fabrica({ id: mapa.id, kind: mapa.kind, subkind: mapa.subkind, name: mapa.name, code: codigoDoMapa(mapa) }, { mapa }) as AnyObjectHandle;
  }
}

/** Tipos de chave que SÃO o código negociado — a mesma lista que a aresta usa para `other_code`. */
export const TIPOS_DE_CODIGO: readonly string[] = ["ticker", "anbima_code", "cetip_code", "series_code", "index_code", "symbol", "us_ticker"];

function codigoDoCandidato(c: { anchor_type: string; anchor_value: string; matched_key_type?: string | null; matched_key_value?: string | null }): string | null {
  if (TIPOS_DE_CODIGO.includes(c.anchor_type)) return c.anchor_value;
  if (c.matched_key_type && c.matched_key_value && TIPOS_DE_CODIGO.includes(c.matched_key_type)) return c.matched_key_value;
  return null;
}

function codigoDoMapa(m: ObjectResponse): string | null {
  if (TIPOS_DE_CODIGO.includes(m.anchor_type)) return m.anchor_value;
  const chave = (m.keys ?? []).find((k) => TIPOS_DE_CODIGO.includes(k.key_type));
  return chave?.key_value ?? null;
}
