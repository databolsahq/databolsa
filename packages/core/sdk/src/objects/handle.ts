import type { DataBolsaClient } from "../client";
import { ONTOLOGY, type FactName, type FunctionOperations, type FunctionSubjectParams, type FunctionsByKind, type Loose, type ObjectKind, type PropertyName, type Rel, type RelationNamesByKind, type RelationTargetsByKind } from "../ontology";
import type { HandleOf } from "./kinds";
import type { ObjectLinksResponse, ObjectPropertiesResponse } from "../types";
import { executar, parametroTemporal } from "./bindings";
import { AmbiguousPaperError, AspectUnavailableError, TemporalConflictError, TemporalCutUnsupportedError, UnboundAspectError, UnknownFactError } from "./errors";
import type { ObjectAspect, ObjectEdge, ObjectFact, ObjectHistorySeries, ObjectMap, ObjectStub, RangeOpts } from "./types";

/** A medida tipada do tipo, quando o tipo é do manifesto; qualquer string quando não é. */
/** As medidas que o TIPO publica — ESTRITO, como `fn()`; medida nova entra por `facts.historyAny`. */
export type FactOf<K extends string> = K extends ObjectKind ? FactName<K> : string;
/** As propriedades (palavras de vocabulário fechado) que o TIPO publica. */
export type PropertyOf<K extends string> = K extends ObjectKind ? PropertyName<K> : string;
export type ObjectProperty = Omit<ObjectPropertiesResponse["data"][number], "name"> & { name: string };

export interface FactsApi<K extends string> {
  latest(opts?: { facts?: FactOf<K>[] }): Promise<ObjectFact[]>;
  history(fact: FactOf<K>, opts?: HistoryOpts): Promise<ObjectHistorySeries>;
  historyAny(fact: string, opts?: HistoryOpts): Promise<ObjectHistorySeries>;
}

/**
 * As funções que o TIPO publica (`market.quotes.history`) — ESTRITO: função que o manifesto não
 * dá ao tipo não compila. Para função publicada depois deste SDK ser gerado há `fnAny()`.
 * Tipo fora do manifesto aceita qualquer string, porque não há lista para restringir.
 */
export type FunctionOf<K extends string> = K extends keyof FunctionsByKind ? FunctionsByKind[K] : string;
/** O parâmetro de sujeito da função — vem de `defaults` e sai do tipo dos parâmetros. */
type SujeitoDe<F extends string> = F extends keyof FunctionSubjectParams ? FunctionSubjectParams[F] : never;
/** A operação que serve a função hoje; `never` para função fora do manifesto. */
type OperacaoDe<F extends string> = F extends keyof FunctionOperations ? FunctionOperations[F] : never;
/**
 * O ÚLTIMO argumento do método flat (as opções), por aridade: os métodos do contrato têm até
 * dois parâmetros de caminho antes das opções (`getSeries(source, series_id, opts?)`).
 * `[...infer _, infer L]` não casa tupla com elemento opcional no fim, por isso a escada.
 */
type Ultimo<A extends unknown[]> = A extends [unknown, unknown, unknown, (infer L)?]
  ? L
  : A extends [unknown, unknown, (infer L)?]
    ? L
    : A extends [unknown, (infer L)?]
      ? L
      : A extends [(infer L)?]
        ? L
        : never;
type OpcoesDoMetodo<Op> = Op extends keyof DataBolsaClient
  ? DataBolsaClient[Op] extends (...a: infer A) => unknown
    ? NonNullable<Ultimo<A>> extends infer L
      ? [L] extends [never]
        ? Record<string, never>
        : L extends object
          ? Partial<L>
          : Record<string, never>
      : never
    : never
  : never;
/**
 * Os parâmetros da função = as opções do método flat que a serve (o último argumento), todos
 * opcionais — o caminho vem de `defaults`. É o MESMO tipo que `db.listQuotes(ticker, opts)`
 * aceita, então `adjusted: boolean` e `perAgency: boolean` valem aqui como lá.
 */
export type FunctionParams<F extends string> = [OperacaoDe<F>] extends [never] ? Record<string, unknown> : Omit<OpcoesDoMetodo<OperacaoDe<F>>, SujeitoDe<F>>;
/** A resposta da função = a do método flat que a serve; `unknown` para função fora do manifesto. */
export type FunctionResult<F extends string> = [OperacaoDe<F>] extends [never]
  ? unknown
  : OperacaoDe<F> extends keyof DataBolsaClient
    ? DataBolsaClient[OperacaoDe<F>] extends (...a: never[]) => Promise<infer R>
      ? R
      : unknown
    : unknown;

/** Quem sabe construir o handle certo para cada tipo — injetado para o handle não importar os tipos derivados. */
export type Fabrica = (stub: ObjectStub, opts?: { at?: string; mapa?: ObjectMap }) => ObjectHandle<string>;

export interface Contexto {
  db: DataBolsaClient;
  fabrica: Fabrica;
}

export interface HistoryOpts extends RangeOpts {
  /** Classe do papel quando a medida é por papel numa companhia (`PN`, `ON`) ou o ticker. */
  series?: string;
}

export interface LinksOpts {
  direction?: "out" | "in";
  limit?: number;
  total?: boolean;
  cursor?: string;
}

export interface AspectOpts {
  /** Para capítulo DE PAPEL numa companhia: o ticker ou a classe (`PN`) que escolhe a instância. */
  series?: string;
}

/**
 * Um objeto do grafo na mão de quem consome: identidade + o que dá para perguntar em seguida.
 *
 * O handle nasce BARATO — de um candidato de `resolveObject` ou de uma aresta de
 * `listObjectLinks` — e só chama `getObject` quando precisa do mapa (`describe()`, ou o
 * primeiro `aspect()`). Trinta e sete debêntures emitidas viram trinta e sete handles e zero
 * chamadas até alguém pedir o rating de uma.
 *
 * O TEMPO MORA AQUI, não em cada chamada: `at(data)` devolve um handle cujo `facts.latest`,
 * `links` e capítulos de retrato recebem o corte, sem que cada operação lembre de honrá-lo.
 */
export class ObjectHandle<K extends string = string> {
  readonly id: string;
  readonly kind: K;
  readonly subkind: string | null;
  readonly name: string | null;
  /** O código pelo qual o mercado chama o objeto (ticker, código ANBIMA), quando conhecido sem `getObject`. */
  readonly code: string | null;
  /** O corte temporal deste handle, quando `at()` foi chamado. */
  readonly asOf: string | undefined;

  protected readonly ctx: Contexto;
  private mapa: Promise<ObjectMap> | undefined;
  /** Arestas já lidas por (verbo, direção, limite): `securities()` + `instruments()` = UMA chamada. */
  private arestas = new Map<string, Promise<ObjectLinksResponse>>();

  constructor(ctx: Contexto, stub: ObjectStub<K>, opts: { at?: string; mapa?: ObjectMap } = {}) {
    this.ctx = ctx;
    this.id = stub.id;
    this.kind = stub.kind;
    this.subkind = stub.subkind;
    this.name = stub.name;
    this.code = stub.code ?? null;
    this.asOf = opts.at;
    if (opts.mapa) this.mapa = Promise.resolve(opts.mapa);
    instalarRelacoes(this);
  }

  /** O mesmo objeto visto numa data: fatos, relações e retratos passam a receber `at`. */
  at(date: string): this {
    const Classe = this.constructor as new (ctx: Contexto, stub: ObjectStub<K>, opts?: { at?: string; mapa?: ObjectMap }) => this;
    const clone = new Classe(this.ctx, { id: this.id, kind: this.kind, subkind: this.subkind, name: this.name, code: this.code }, { at: date });
    if (this.mapa) clone.mapa = this.mapa;
    return clone;
  }

  /** O mapa completo (`getObject`), buscado uma vez e guardado. */
  describe(): Promise<ObjectMap> {
    this.mapa ??= this.ctx.db.getObject(this.id);
    return this.mapa;
  }

  // Assinaturas de MÉTODO (não propriedades-seta) de propósito: com `FactOf<K>` estrito, uma
  // seta faria `ObjectHandle<"fund">` deixar de ser um `ObjectHandle<string>` (parâmetro
  // contravariante) e a fábrica genérica não compilaria. Método é bivariante no parâmetro.
  readonly facts: FactsApi<K> = {
    /** Todas as medidas vigentes (ou as pedidas), na data do handle quando houver. */
    latest: async (opts: { facts?: FactOf<K>[] } = {}): Promise<ObjectFact[]> => {
      const r = await this.ctx.db.getObjectFacts(this.id, { at: this.asOf, facts: opts.facts as string[] | undefined });
      return r.data;
    },
    /** UMA medida no tempo, com a própria régua (`axes`, `unit`, `label`). Medida fora do tipo não compila. */
    history: (fact: FactOf<K>, opts: HistoryOpts = {}): Promise<ObjectHistorySeries> => this.facts.historyAny(fact, opts),
    /** `history()` sem o tipo: para medida publicada depois deste SDK ser gerado. */
    historyAny: async (fact: string, opts: HistoryOpts = {}): Promise<ObjectHistorySeries> => {
      const r = await this.ctx.db.getObjectHistory(this.id, {
        facts: fact,
        series: opts.series,
        from: opts.from,
        to: corteDaSerie(this.asOf, opts.to),
        limit: opts.limit,
      });
      const sujeito = r.meta.subjects[0];
      const serie = r.data[0];
      if (!serie || sujeito?.status === "unknown_fact") throw new UnknownFactError(this.id, fact, sujeito?.reason ?? null);
      // Medida de papel numa companhia com vários papéis: o servidor devolve uma série por papel,
      // e "a primeira" seria a escolha em silêncio que este handle existe para não fazer.
      if (r.data.length > 1) throw new AmbiguousPaperError(fact, r.data.map((s) => s.series ?? "?"));
      return serie;
    },
  };

  /** As propriedades do objeto (palavras de vocabulário fechado), com competência e fonte; `name` é do tipo. */
  async properties(): Promise<(ObjectProperty & { name: PropertyOf<K> })[]> {
    const r = await this.ctx.db.getObjectProperties(this.id);
    return r.data as (ObjectProperty & { name: PropertyOf<K> })[];
  }

  /** UMA propriedade pelo nome — que o tipo governa: `company.property("listing_segment")` compila, `"fii_segment"` não. */
  async property(name: PropertyOf<K>): Promise<ObjectProperty | null> {
    const todas = await this.properties();
    return todas.find((p) => p.name === name) ?? null;
  }

  /** Atravessa uma relação; sem `at` no handle a resposta é "quem JÁ se relacionou". */
  links(rel: Loose<Rel>, opts: LinksOpts = {}): Promise<ObjectLinksResponse> {
    return this.ctx.db.listObjectLinks(this.id, {
      rel,
      direction: opts.direction ?? "out",
      at: this.asOf,
      limit: opts.limit,
      total: opts.total,
      cursor: opts.cursor,
    });
  }

  /**
   * Os objetos do outro lado da relação, como handles baratos (sem `getObject`). `kind` e
   * `subkind` filtram pelo que a aresta publica — a identidade aqui é (tipo, subtipo).
   */
  async related(rel: Loose<Rel>, direction: "out" | "in", opts: RelatedOpts = {}): Promise<ObjectHandle<string>[]> {
    const paginas: ObjectEdge[] = [];
    let cursor = opts.cursor;
    do {
      const r = await this.pagina(rel, direction, opts.limit, cursor);
      paginas.push(...r.data);
      cursor = r.meta.next_cursor ?? undefined;
      // Sem `all`, UMA página: o chamador vê `next_cursor` em `links()` se quiser seguir.
    } while (opts.all && cursor);
    const vistos = new Set<string>();
    const handles: ObjectHandle<string>[] = [];
    for (const e of paginas) {
      if (opts.kind && e.other_kind !== opts.kind) continue;
      if (opts.subkind && e.other_subkind !== opts.subkind) continue;
      if (vistos.has(e.other_id)) continue;
      vistos.add(e.other_id);
      handles.push(this.ctx.fabrica({ id: e.other_id, kind: e.other_kind, subkind: e.other_subkind ?? null, name: e.other_name, code: e.other_code ?? null }, { at: this.asOf }));
    }
    return handles;
  }

  /** Uma página de arestas, lida uma vez por (verbo, direção, limite, cursor). */
  private pagina(rel: string, direction: "out" | "in", limit: number | undefined, cursor: string | undefined): Promise<ObjectLinksResponse> {
    const chave = `${rel}:${direction}:${limit ?? ""}:${cursor ?? ""}`;
    let lido = this.arestas.get(chave);
    if (!lido) {
      lido = this.links(rel, { direction, limit, cursor });
      this.arestas.set(chave, lido);
      // Falha não fica memorizada: a próxima chamada tenta de novo em vez de repetir o erro.
      lido.catch(() => this.arestas.delete(chave));
    }
    return lido;
  }

  /** Os capítulos do tipo, cada um dizendo se ESTE objeto tem dado (`available`). */
  async aspects(): Promise<ObjectAspect[]> {
    return (await this.describe()).aspects;
  }

  /**
   * Executa uma FUNÇÃO do registry pelo id, tipada pelo manifesto: `petr4.fn("market.quotes.history",
   * { from })` sabe que os parâmetros são os de `listQuotes` e devolve `QuotesResponse`. É a porta
   * que os handles por tipo usam por baixo; função que o tipo não publica é erro de tipo E, em
   * runtime, `AspectUnavailableError`. Capítulo de papel numa companhia exige `series`.
   */
  async fn<F extends FunctionOf<K>>(id: F, params: FunctionParams<F> = {} as FunctionParams<F>, opts: AspectOpts = {}): Promise<FunctionResult<F>> {
    return this.fnAny(id, params as Record<string, unknown>, opts) as Promise<FunctionResult<F>>;
  }

  /**
   * `fn()` sem o tipo: para função que o contrato publicou DEPOIS deste SDK ser gerado. O que
   * se perde é só a tipagem — sujeito, corte temporal e recusas valem igual.
   */
  async fnAny(id: string, params: Record<string, unknown> = {}, opts: AspectOpts = {}): Promise<unknown> {
    const mapa = await this.describe();
    // Servidor anterior a 29/08/2026 não publica `function`: cai para o NOME do capítulo que o
    // manifesto associa à função, para o SDK novo não recusar um mapa antigo.
    const nome = NOME_DA_FUNCAO.get(id);
    const instancias = mapa.aspects.filter((a) => (a.function ?? null) === id || (a.function == null && nome !== undefined && a.name === nome));
    if (instancias.length === 0) {
      throw new AspectUnavailableError(this.id, this.kind, id, [...new Set(mapa.aspects.map((a) => a.function ?? a.name))]);
    }
    return this.executarInstancia(id, instancias, params, opts, mapa);
  }

  /**
   * Executa um capítulo do mapa pelo nome, com a chamada que o próprio mapa resolveu.
   * Capítulo que o TIPO não tem é erro (`AspectUnavailableError`); capítulo sem dado para este
   * objeto (`available: false`) é chamado mesmo assim e responde vazio — "sem nota observada" e
   * "não tem capítulo" são coisas diferentes e o chamador precisa ver a diferença.
   * Capítulo de papel numa companhia com vários papéis exige `series`; o corte do handle vira
   * `at` em retrato e `to` em série.
   */
  async aspect(name: string, params: object = {}, opts: AspectOpts = {}): Promise<unknown> {
    const mapa = await this.describe();
    const instancias = mapa.aspects.filter((a) => a.name === name);
    if (instancias.length === 0) {
      throw new AspectUnavailableError(this.id, this.kind, name, [...new Set(mapa.aspects.map((a) => a.name))]);
    }
    return this.executarInstancia(name, instancias, params, opts, mapa);
  }

  private executarInstancia(rotulo: string, instancias: ObjectAspect[], params: object, opts: AspectOpts, mapa: ObjectMap): Promise<unknown> {
    const escolhida = escolherInstancia(instancias, opts.series, mapa);
    if (!escolhida) throw new AmbiguousPaperError(rotulo, instancias.map((a) => a.value));
    const chamada = executar(this.ctx.db, escolhida.operation, escolhida.defaults, { ...params, ...comCorte(rotulo, escolhida, this.asOf, params) });
    if (!chamada) throw new UnboundAspectError(rotulo, escolhida.operation);
    return chamada;
  }
}

/** O que um acessor de relação gerado aceita: o mesmo recorte de `related()`. */
export interface RelatedOpts {
  kind?: Loose<ObjectKind>;
  subkind?: string;
  /** Tamanho da página (o servidor limita a 100 por chamada). */
  limit?: number;
  /** Continua de uma página anterior (`links()` publica `next_cursor`). */
  cursor?: string;
  /** Segue `next_cursor` até o fim: TODOS os objetos da relação, em N chamadas. */
  all?: boolean;
}
export type RelationAccessor<T extends string = string> = (opts?: RelatedOpts) => Promise<HandleOf<T>[]>;

/**
 * Os acessores de relação do TIPO, tipados pelo manifesto nas DUAS pontas: o nome vem de
 * `RelationNamesByKind` e o tipo do outro lado de `RelationTargetsByKind` — `petr4.holders()`
 * devolve `FundHandle[]`, `petrobras.issued()` devolve a união de papel, instrumento e oferta.
 * Tipo fora do manifesto (`Loose`) ganha o mapa aberto.
 */
export type RelationAccessors<K extends string> = K extends keyof RelationNamesByKind
  ? K extends keyof RelationTargetsByKind
    ? { readonly [N in keyof RelationNamesByKind[K]]: RelationAccessor<N extends keyof RelationTargetsByKind[K] ? Extract<RelationTargetsByKind[K][N], string> : string> }
    : { readonly [N in keyof RelationNamesByKind[K]]: RelationAccessor }
  : { readonly [name: string]: RelationAccessor };

/**
 * Instala em CADA handle um método por relação do seu tipo, a partir de `ONTOLOGY.rels`
 * (`forward_name` em quem pratica, `inverse_name` em quem recebe, os dois lados em verbo
 * simétrico). Método que a classe já define à mão (`issuer()` tipado em `EquitySecurityHandle`)
 * tem precedência — o gerado só preenche o que falta, nunca sobrescreve.
 */
function instalarRelacoes(h: ObjectHandle<string>): void {
  const alvo = h as unknown as Record<string, unknown>;
  const definir = (nome: string, rel: string, dir: "out" | "in" | "both") => {
    if (nome in alvo) return;
    const fn = (async (opts: RelatedOpts = {}) => {
      if (dir !== "both") return h.related(rel, dir, opts);
      const [saida, entrada] = await Promise.all([h.related(rel, "out", opts), h.related(rel, "in", opts)]);
      const vistos = new Set(saida.map((x) => x.id));
      return [...saida, ...entrada.filter((x) => !vistos.has(x.id))];
    }) as RelationAccessor;
    Object.defineProperty(alvo, nome, { value: fn, enumerable: false, writable: false });
  };
  for (const r of ONTOLOGY.rels) {
    if (!r.forward_name || !r.inverse_name) continue;
    const simetrico = r.forward_name === r.inverse_name;
    if ((r.domain_kinds as readonly string[]).includes(h.kind)) definir(r.forward_name, r.rel, simetrico ? "both" : "out");
    if ((r.range_kinds as readonly string[]).includes(h.kind)) definir(r.inverse_name, r.rel, simetrico ? "both" : "in");
  }
}

/** id da função → nome do capítulo, pelo manifesto (`market.quotes.history` → `quotes`). */
const NOME_DA_FUNCAO: ReadonlyMap<string, string> = new Map([
  ...ONTOLOGY.aspects.map((a) => [a.id, a.name] as const),
  ["objects.facts.latest", "facts"],
  ["objects.properties.get", "properties"],
]);

/** Uma instância só, ou a que casa com `series` (ticker ou classe), ou nada quando é ambíguo. */
function escolherInstancia(instancias: ObjectAspect[], series: string | undefined, mapa: ObjectMap): ObjectAspect | undefined {
  if (instancias.length === 1) return instancias[0];
  if (!series) return undefined;
  const alvo = series.toUpperCase();
  const porTicker = instancias.find((a) => a.value.toUpperCase() === alvo);
  if (porTicker) return porTicker;
  const classe = mapa.share_classes?.find((s) => s.share_class === alvo);
  return classe ? instancias.find((a) => a.value === classe.ticker) : undefined;
}

/**
 * O corte do handle vai no parâmetro que o CONTRATO declara para a operação (`at` ou `to`).
 * Operação que só responde o vigente recusa o corte — era regra por `shape` aqui dentro, e
 * `event` virava `to` num `listCreditRatings` que não tem `to`: a nota de hoje passava por
 * nota daquela data.
 */
/**
 * O corte do handle vira o parâmetro temporal da operação, e VENCE: parâmetro igual é
 * redundância, parâmetro diferente é conflito (erro) — `at("2024-12-31")` seguido de
 * `{ to: "2026-01-01" }` mandava 2026 em silêncio.
 */
function comCorte(name: string, a: ObjectAspect, at: string | undefined, params: object): Record<string, unknown> {
  if (!at) return {};
  const parametro = parametroTemporal(a.operation);
  if (!parametro) throw new TemporalCutUnsupportedError(name, a.operation, at);
  const pedido = (params as Record<string, unknown>)[parametro];
  if (pedido !== undefined && pedido !== at) throw new TemporalConflictError(parametro, at, String(pedido));
  return { [parametro]: at };
}

/** O mesmo para a série de medida: `to` do chamador não passa por cima do `at()` do handle. */
function corteDaSerie(at: string | undefined, to: string | undefined): string | undefined {
  if (at !== undefined && to !== undefined && to !== at) throw new TemporalConflictError("to", at, to);
  return at ?? to;
}
