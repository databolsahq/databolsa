import { Objects } from "./objects/facade";
import { Account } from "./objects/account";
import {
  type DataBolsaClient,
  type LiveQuotesParams,
  NotInPreviewError,
  type ScreenFiisParams,
  type ScreenFundsParams,
  type ScreenStocksParams,
} from "./client";
import type {
  ObjectIntersectResponse,
  ObjectPathResponse,
  ObjectPathsFoundResponse,
  ObjectFactsResponse,
  ObjectPropertiesResponse,
  ObjectHistoryResponse,
  FactCatalogResponse,
  ObjectAggregateResponse,
  ObjectRankResponse,
  ObjectListResponse,
  ObjectTableResult,
  ObjectEventsResponse,
  ObjectCensus,
  ObjectRelationsResponse,
  GlobalLinksResponse,
  ObjectLinkStats,
  CorporateSuccessionsResponse,
  ObjectEvidenceResponse,
  ObjectLinksResponse,
  ObjectLinkHistoryResponse,
  ObjectResolveResponse,
  ObjectResponse,
  TradingStatusResponse,
  CorporateEventsResponse,
  CryptoLiveResponse,
  DocumentReadResponse,
  DocumentSearchResponse,
  DocumentTaxonomy,
  DocumentsResponse,
  EventThread,
  FiiIndicatorsResponse,
  FiiScreenResponse,
  FundHoldingsResponse,
  FundInvestorsResponse,
  FundLookThroughResponse,
  FundProfile,
  FundScreenerResponse,
  HealthResponse,
  IndexCompositionResponse,
  IngestHealthResponse,
  InsiderResponse,
  IntradaySeriesResponse,
  InvestedFundsResponse,
  InvestorFlowMonthlyResponse,
  InvestorFlowResponse,
  LiveQuotesResponse,
  MacroGearsResponse,
  MarketAnomaliesResponse,
  MarketEvent,
  MarketEventSearchResponse,
  MarketEventsResponse,
  OfferingsResponse,
  OptionExpiriesResponse,
  OptionsChainResponse,
  OptionsQuotesResponse,
  OwnershipFlowResponse,
  OwnershipMoversResponse,
  RangeParams,
  ReadDocumentParams,
  RegimeSnapshot,
  ScreenStocksResponse,
  SearchDocumentsParams,
  SearchResponse,
  SimilarMarketEventsResponse,
  StockIndicatorsResponse,
  BondCurveResponse,
  TesouroAuctionsResponse,
  CommodityCurveResponse,
  CommoditySettlementsResponse,
  DebenturesResponse,
  CreditCurveResponse,
  CreditOtcQuotesResponse,
  MineralProducersResponse,
  MineralObservationsResponse,
  CreditRatingsResponse,
  CreditRatingScale,
  FidcListResponse,
  FidcRegulationTerms,
  FidcDelinquencyResponse,
  FidcScrResponse,
  FidcSecondaryResponse,
  FidcSectorResponse,
  FidcOriginatorExposureResponse,
  FidcInvestorResponse,
  FidcPricingResponse,
  DebentureScreenerResponse,
  UsAssetDetail,
  UsFilingsResponse,
} from "./types";

/**
 * Cliente HTTP da Serving API do DataBolsa. Os métodos públicos espelham os
 * operationIds do OpenAPI e retornam tipos gerados.
 *
 * Degradação graciosa: 501 (endpoint ainda não servido) e 404 (recurso não
 * encontrado) viram {@link NotInPreviewError}; outros status não-2xx lançam
 * Error.
 *
 * `baseUrl` pode ser uma origem absoluta para Node/servidor ou uma base
 * relativa de mesma origem em apps browser que fazem proxy de `/v1` para a API.
 */
export interface HttpClientOptions {
  /** Token bearer a anexar (opcional). Hoje a API de dev é aberta. */
  getToken?: () => string | null | undefined;
  /** Chave estática (atalho p/ Node/CLI). Ignorada se `getToken` for passada. */
  apiKey?: string | null;
}

type Query = Record<string, string | number | boolean | null | undefined>;

/**
 * O que um plugin de extensão recebe de `db.use(...)`: a origem e um `fetch` que já
 * carrega a credencial. O core não conhece a extensão; a extensão não conhece o core —
 * o contrato entre os dois é só isto.
 */
export type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;
export interface PluginContext {
  /** Origem da API, sem `/v1` (ex.: https://api.databolsa.com). */
  baseUrl: string;
  /** `fetch` com `Authorization: Bearer` da credencial deste cliente. */
  fetch: FetchLike;
}
export type ClientPlugin<T> = (ctx: PluginContext) => T;

export class HttpClient implements DataBolsaClient {
  private readonly base: string;
  private readonly getToken?: () => string | null | undefined;
  readonly objects: Objects = new Objects(this);
  readonly account: Account = new Account(this);

  constructor(baseUrl: string, opts: HttpClientOptions = {}) {
    // baseUrl absoluto (http(s)://…) → chamada direta, cross-origin: o servidor precisa
    // liberar CORS para a origem de quem chama.
    // baseUrl relativo (ex.: "/") → MESMA ORIGEM: as requisições saem para a origem que
    // serve a página, útil quando a aplicação que hospeda o SDK repassa /v1 adiante. Sem
    // cross-origin, sem CORS. As rotas vivem sob /v1 nos dois casos.
    const isAbsolute = /^https?:\/\//i.test(baseUrl);
    // `globalThis.location` em vez do `window` nu: o SDK é agnóstico (sem lib DOM),
    // resolve a origem no browser e cai em "" no Node (onde baseUrl deve ser absoluto).
    const loc = (globalThis as { location?: { origin?: string } }).location;
    const origin = isAbsolute ? baseUrl.replace(/\/+$/, "") : (loc?.origin ?? "");
    this.base = `${origin}/v1`;
    this.getToken = opts.getToken ?? (opts.apiKey ? () => opts.apiKey : undefined);
  }

  /**
   * COMPOSIÇÃO: monta o cliente de uma extensão sobre a mesma origem e credencial.
   *
   *   import { wallet } from "@databolsa/wallet-sdk";
   *   const carteira = db.use(wallet());
   *   await carteira.listPortfolios();
   */
  use<T>(plugin: ClientPlugin<T>): T {
    const getToken = this.getToken;
    const authFetch: FetchLike = (input, init) => {
      const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
      const token = getToken?.();
      if (token && !headers.has("authorization")) headers.set("authorization", `Bearer ${token}`);
      return fetch(input, { ...init, headers });
    };
    return plugin({ baseUrl: this.base.replace(/\/v1$/, ""), fetch: authFetch });
  }

  private async request<T>(
    path: string,
    query?: Query,
    opts?: { method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"; body?: unknown },
  ): Promise<T> {
    const url = new URL(this.base + path);
    if (query) {
      for (const [k, v] of Object.entries(query)) {
        if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
      }
    }

    const headers: Record<string, string> = { accept: "application/json" };
    const token = this.getToken?.();
    if (token) headers.authorization = `Bearer ${token}`;
    if (opts?.body !== undefined) headers["content-type"] = "application/json";

    let res: Response;
    try {
      res = await fetch(url, {
        method: opts?.method ?? "GET",
        headers,
        ...(opts?.body !== undefined ? { body: JSON.stringify(opts.body) } : {}),
      });
    } catch (cause) {
      // Rede indisponível (API fora do ar, CORS, DNS) — erro real, não "preview".
      throw new Error(`Falha de rede ao chamar ${path}`, { cause });
    }

    if (res.ok) return (await res.json()) as T;

    // 501 (rota não servida nesta versão) e 404 (recurso inexistente) → a UI
    // trata como "fora do preview"; demais status são erros de verdade.
    if (res.status === 501 || res.status === 404) {
      throw new NotInPreviewError(decodeURIComponent(path.replace(/^\//, "")));
    }
    const detail = await this.problemDetail(res);
    throw new Error(`API ${res.status} em ${path}${detail ? `: ${detail}` : ""}`);
  }

  /** Como `request`, mas p/ respostas de TEXTO (ex.: o template CSV de import). */
  private async requestText(path: string): Promise<string> {
    const url = new URL(this.base + path);
    const headers: Record<string, string> = { accept: "text/csv, text/plain" };
    const token = this.getToken?.();
    if (token) headers.authorization = `Bearer ${token}`;
    let res: Response;
    try {
      res = await fetch(url, { headers });
    } catch (cause) {
      throw new Error(`Falha de rede ao chamar ${path}`, { cause });
    }
    if (res.ok) return res.text();
    if (res.status === 501 || res.status === 404) {
      throw new NotInPreviewError(decodeURIComponent(path.replace(/^\//, "")));
    }
    const detail = await this.problemDetail(res);
    throw new Error(`API ${res.status} em ${path}${detail ? `: ${detail}` : ""}`);
  }

  /** Extrai `detail`/`title` de um application/problem+json, se houver. */
  private async problemDetail(res: Response): Promise<string | null> {
    try {
      const body = (await res.json()) as { detail?: string; title?: string };
      return body.detail ?? body.title ?? null;
    } catch {
      return null;
    }
  }

  // --- saúde ---------------------------------------------------------------
  getHealth(): Promise<HealthResponse> {
    return this.request<HealthResponse>("/health");
  }

  getIngestHealth(): Promise<IngestHealthResponse> {
    return this.request<IngestHealthResponse>("/ingest");
  }

  // --- screener (o universo real de ações) ---------------------------------
  screenStocks(params?: ScreenStocksParams): Promise<ScreenStocksResponse> {
    return this.request<ScreenStocksResponse>("/screener/stocks", {
      sector: params?.sector,
      segment: params?.segment,
      sort: params?.sort,
      limit: params?.limit,
      cursor: params?.cursor,
      pl_min: params?.pl_min,
      pl_max: params?.pl_max,
      pvp_min: params?.pvp_min,
      pvp_max: params?.pvp_max,
      dy_min: params?.dy_min,
      roe_min: params?.roe_min,
      ev_ebitda_max: params?.ev_ebitda_max,
      div_liq_ebitda_max: params?.div_liq_ebitda_max,
    });
  }

  getStockIndicators(ticker: string, params?: { at?: string }): Promise<StockIndicatorsResponse> {
    return this.request<StockIndicatorsResponse>(`/stocks/${enc(ticker)}/indicators`, {
      at: params?.at,
    });
  }

  // ── grafo de identidade ─────────────────────────────────────────────────────
  listObjects(params: {
    kind: string;
    subkind?: string;
    rel?: string;
    rel_to?: string;
    rel_direction?: "in" | "out";
    at?: string;
    where?: string;
    /** Busca por NOME dentro da coorte (palavras em qualquer ordem, sem acento); pagina com `cursor`. */
    q?: string;
    /** Propriedades do catálogo projetadas em cada linha (`properties`), até 8, separadas por vírgula. */
    props?: string;
    total?: boolean;
    limit?: number;
    cursor?: string;
  }) {
    return this.request<ObjectListResponse>("/objects", params);
  }

  resolveObject(params: { q: string | string[]; kind?: string; subkind?: string; limit?: number }) {
    return this.request<ObjectResolveResponse>("/objects/resolve", {
      q: Array.isArray(params.q) ? params.q.join("|") : params.q,
      kind: params.kind,
      subkind: params.subkind,
      limit: params.limit,
    });
  }

  getObject(id: string, params?: { resolve?: "auto" | "exact" }) {
    return this.request<ObjectResponse>(`/objects/${enc(id)}`, { resolve: params?.resolve });
  }

  listObjectLinks(
    id: string,
    params?: {
      rel?: string;
      direction?: "out" | "in";
      at?: string;
      total?: boolean;
      limit?: number;
      cursor?: string;
      resolve?: "auto" | "exact";
    },
  ) {
    return this.request<ObjectLinksResponse>(`/objects/${enc(id)}/links`, {
      rel: params?.rel,
      direction: params?.direction,
      at: params?.at,
      total: params?.total,
      limit: params?.limit,
      cursor: params?.cursor,
      resolve: params?.resolve,
    });
  }

  getObjectLinkHistory(
    id: string,
    params: {
      rel: string;
      direction?: "out" | "in";
      other_id?: string;
      source?: string;
      from?: string;
      to?: string;
      limit?: number;
      cursor?: string;
      resolve?: "auto" | "exact";
    },
  ) {
    return this.request<ObjectLinkHistoryResponse>(`/objects/${enc(id)}/links/history`, { ...params });
  }

  intersectObjects(params: {
    a: string;
    b: string;
    a_direction?: "out" | "in";
    b_direction?: "out" | "in";
    a_to_id?: string;
    b_to_id?: string;
    /** Recorta o TIPO da outra ponta. `issued` sai da companhia tanto para `instrument` quanto para `equity_security`: sem isto, "cede para FIDC e emite DÍVIDA" inclui quem só emitiu ação. */
    a_to_kind?: string;
    b_to_kind?: string;
    kind?: string;
    subkind?: string;
    at?: string;
    op?: "intersect" | "union" | "difference";
    /** `a_count`/`b_count`/`total` ordenam pelo GRAU — é assim que se pede "as três maiores da interseção" numa chamada só, em vez de paginar o universo e agregar no cliente. */
    order?: "name" | "a_count" | "b_count" | "total";
    total?: boolean;
    limit?: number;
    cursor?: string;
  }) {
    return this.request<ObjectIntersectResponse>("/objects/intersect", { ...params });
  }

  traverseObjectPath(params: {
    steps: string;
    start_id?: string;
    start_kind?: string;
    start_subkind?: string;
    end_id?: string;
    end_kind?: string;
    end_subkind?: string;
    count_at?: number;
    return_at?: number;
    at?: string;
    total?: boolean;
    limit?: number;
    cursor?: string;
  }) {
    return this.request<ObjectPathResponse>("/objects/path", { ...params });
  }

  findObjectPaths(params: {
    from_id: string;
    to_id: string;
    max_hops?: number;
    limit?: number;
    at?: string;
    resolve?: "auto" | "exact";
  }) {
    return this.request<ObjectPathsFoundResponse>("/objects/paths", { ...params });
  }

  /**
   * O TRECHO do documento que sustenta o objeto — protocolo, link, páginas e parágrafo. É a
   * prova documental; o tamanho da relação é `magnitude`, na aresta, e são coisas diferentes.
   */
  getObjectEvidence(
    id: string,
    params?: { from?: string; to?: string; limit?: number; cursor?: string; resolve?: "auto" | "exact" },
  ) {
    return this.request<ObjectEvidenceResponse>(`/objects/${enc(id)}/evidence`, {
      from: params?.from,
      to: params?.to,
      limit: params?.limit,
      cursor: params?.cursor,
      resolve: params?.resolve,
    });
  }

  getObjectCensus() {
    return this.request<ObjectCensus>("/objects/stats");
  }

  // Catálogo fechado de treze linhas: sem paginação e sem filtro, de propósito — paginar
  // treze linhas só criaria a chance de alguém ler metade do vocabulário.
  listObjectRelations() {
    return this.request<ObjectRelationsResponse>("/objects/relations");
  }

  getObjectFacts(id: string | string[], params?: { at?: string; facts?: string[]; resolve?: "auto" | "exact" }) {
    return this.request<ObjectFactsResponse>(`/objects/${ids(id)}/facts`, {
      at: params?.at,
      facts: params?.facts?.join(","),
      resolve: params?.resolve,
    });
  }

  getObjectProperties(id: string | string[], params?: { resolve?: "auto" | "exact" }) {
    return this.request<ObjectPropertiesResponse>(`/objects/${ids(id)}/properties`, {
      resolve: params?.resolve,
    });
  }

  getObjectHistory(
    id: string | string[],
    params: {
      facts: string | string[];
      series?: string;
      from?: string;
      to?: string;
      limit?: number;
      resolve?: "auto" | "exact";
      transform?: "sum_12m" | "ytd" | "compound_12m" | "compound_ytd" | "mean_3m" | "mean_12m" | "pct_change" | "diff";
    },
  ) {
    return this.request<ObjectHistoryResponse>(`/objects/${ids(id)}/history`, {
      ...params,
      facts: Array.isArray(params.facts) ? params.facts.join(",") : params.facts,
    });
  }

  getObjectTable(params: { operation: "getObjectHistory" | "rankObjects" | "getObjectFacts" | "aggregateObjects"; id?: string | string[]; input?: Record<string, unknown> }) {
    return this.request<ObjectTableResult>("/objects/table", {
      operation: params.operation,
      // Query param, não segmento de path: `searchParams` já codifica. Passar por `ids()` aqui
      // codificava a vírgula DUAS vezes e "pub_a,pub_b" chegava ao servidor como um id só.
      id: params.id === undefined ? undefined : (Array.isArray(params.id) ? params.id : [params.id]).join(","),
      input: JSON.stringify(params.input ?? {}),
    });
  }

  listFactCatalog() {
    return this.request<FactCatalogResponse>("/objects/facts/catalog");
  }

  // O quarto eixo: a coorte reduzida a uma ordem. `measure=delta` exige `from` — sem a ponta
  // inicial não há variação, e adivinhar a janela devolveria um número plausível e arbitrário.
  rankObjects(
    params: {
      kind: string;
      fact: string;
      subkind?: string;
      measure?: "value" | "delta" | "pct_change";
      at?: string;
      from?: string;
      order?: "asc" | "desc";
      limit?: number;
      rel?: string;
      rel_to?: string;
      rel_direction?: "out" | "in";
      since?: string;
      /** Piso da data-base da ponta INICIAL, o que `since` faz pela final. Sem ele a janela pedida não é a recebida. */
      since_from?: string;
      exclude_out_of_prior?: boolean;
      /**
       * Verbo a expandir: cada linha volta com até 3 objetos ligados por ele, já com nome e
       * chave. `kind=offering&expand=issued` traz o emissor sem uma chamada por oferta.
       */
      expand?: string;
      /** De que lado está o vizinho. `in` (default) é quem APONTA para a linha. */
      expand_direction?: "out" | "in";
      /**
       * Condições sobre OUTRAS medidas: `fidc_impaired_ratio<0.05,fidc_portfolio>1000000`.
       * Confira a ESCALA da medida antes de escrever o número — `meta.applied_where` devolve a
       * unidade contra a qual cada corte foi feito, e é onde isto erra.
       */
      where?: string;
    },
  ) {
    return this.request<ObjectRankResponse>("/objects/rank", { ...params });
  }

  /**
   * A outra metade do ranking: a coorte reduzida a um RESUMO por grupo. Mesma coorte, mesma
   * sintaxe de `where` — o que muda é que a linha deixa de ser objeto e passa a ser grupo, e
   * por isso é operação separada e não um parâmetro de `rankObjects`.
   */
  aggregateObjects(
    params: {
      kind: string;
      /** Omita com `agg: "count"` para o CENSO: contar objetos por grupo, sem medida. */
      fact?: string;
      /** Como resumir. `sum` é RECUSADO em `pct`, `ratio`, `x` e `points`. */
      agg: "sum" | "avg" | "median" | "min" | "max" | "count";
      /** Nome de PROPRIEDADE ou verbo de RELAÇÃO. `meta.groupable` lista os dois conjuntos. */
      group_by: string;
      /**
       * Onde a COORTE está na aresta. `manages` liga gestora a fundo: coorte de fundos é `in`.
       * Direção errada devolve lista vazia, e `meta.empty_reason` diz qual funcionaria.
       */
      group_by_direction?: "out" | "in";
      subkind?: string;
      at?: string;
      rel?: string;
      rel_to?: string;
      rel_direction?: "out" | "in";
      limit?: number;
      /** Cursor de `meta.next_cursor` da página anterior de GRUPOS; a ordem é estável. */
      cursor?: string;
      /** Busca no RÓTULO do grupo (gestora, setor…), antes de cortar a página. */
      q?: string;
      /** Os mesmos cortes de `rankObjects`, por número e por palavra. Recortam ANTES de agrupar. */
      where?: string;
      /**
       * Por qual coluna ordenar e CORTAR a página: `value` (default) usa a agregação;
       * `objects` usa o tamanho do grupo — "as gestoras com mais fundos" é essa pergunta.
       */
      order_by?: "value" | "objects";
      /** Piso da DATA-BASE do valor, a mesma régua de `rankObjects`: mais antigo alarga a coorte com valor, mais novo aperta. `meta.since`/`meta.since_policy` dizem o corte que valeu. */
      since?: string;
      /** Exclui valores fora da faixa plausível da medida e declara quantos saíram no meta. */
      exclude_out_of_prior?: boolean;
    },
  ) {
    return this.request<ObjectAggregateResponse>("/objects/aggregate", { ...params });
  }

  getObjectEvents(
    id: string,
    params?: {
      from?: string;
      to?: string;
      layer?: string;
      category?: string;
      total?: boolean;
      limit?: number;
      cursor?: string;
      resolve?: "auto" | "exact";
    },
  ) {
    return this.request<ObjectEventsResponse>(`/objects/${enc(id)}/events`, { ...params });
  }

  getObjectLinkStats(params?: {
    rel?: string;
    from_kind?: string;
    to_kind?: string;
    from_id?: string;
    to_id?: string;
    at?: string;
  }) {
    return this.request<ObjectLinkStats>("/objects/links/stats", { ...params });
  }

  listGlobalLinks(
    params?: {
    rel?: string;
    from_kind?: string;
    to_kind?: string;
    from_id?: string;
    to_id?: string;
    at?: string;
   total?: boolean; limit?: number; cursor?: string },
  ) {
    return this.request<GlobalLinksResponse>("/objects/links", { ...params });
  }

  listTradingStatus(params?: { status?: string; total?: boolean; limit?: number; cursor?: string }) {
    return this.request<TradingStatusResponse>("/corporate/trading-status", {
      status: params?.status,
      total: params?.total,
      limit: params?.limit,
      cursor: params?.cursor,
    });
  }

  listCorporateSuccessions(params?: {
    ticker?: string;
    event_type?: "rename" | "incorporation";
    total?: boolean;
    limit?: number;
    cursor?: string;
  }) {
    return this.request<CorporateSuccessionsResponse>("/corporate/successions", {
      ticker: params?.ticker,
      event_type: params?.event_type,
      total: params?.total,
      limit: params?.limit,
      cursor: params?.cursor,
    });
  }

  listCorporateEvents(ticker: string, params?: RangeParams): Promise<CorporateEventsResponse> {
    return this.request<CorporateEventsResponse>(`/stocks/${enc(ticker)}/events`, {
      from: params?.from,
      to: params?.to,
    });
  }

  listCompanyDocuments(
    company: string | number,
    params?: RangeParams & { category?: string },
  ): Promise<DocumentsResponse> {
    return this.request<DocumentsResponse>(`/companies/${enc(String(company))}/documents`, {
      from: params?.from,
      to: params?.to,
      category: params?.category,
    });
  }

  listInsiderMoves(ticker: string, params?: RangeParams): Promise<InsiderResponse> {
    // Pendência de contrato (sem operationId ainda) — 501 até a rota existir.
    return this.request<InsiderResponse>(`/stocks/${enc(ticker)}/insider`, {
      from: params?.from,
      to: params?.to,
    });
  }

  listOwnershipFlow(
    ticker: string,
    params?: RangeParams & { cursor?: string; limit?: number },
  ): Promise<OwnershipFlowResponse> {
    return this.request<OwnershipFlowResponse>(`/stocks/${enc(ticker)}/ownership-flow`, {
      cursor: params?.cursor,
      limit: params?.limit,
      from: params?.from,
      to: params?.to,
    });
  }

  listOwnershipMovers(
    ticker: string,
    params?: { cursor?: string; limit?: number; date?: string; direction?: "in" | "out" | "all" },
  ): Promise<OwnershipMoversResponse> {
    return this.request<OwnershipMoversResponse>(`/stocks/${enc(ticker)}/ownership-flow/movers`, {
      cursor: params?.cursor,
      limit: params?.limit,
      date: params?.date,
      direction: params?.direction,
    });
  }

  // --- FIIs ----------------------------------------------------------------
  screenFiis(params?: ScreenFiisParams): Promise<FiiScreenResponse> {
    return this.request<FiiScreenResponse>("/screener/fiis", {
      segment: params?.segment,
      paper: params?.paper === undefined ? undefined : String(params.paper),
      sort: params?.sort,
      limit: params?.limit,
      cursor: params?.cursor,
    });
  }

  getFiiIndicators(ticker: string, params?: { at?: string }): Promise<FiiIndicatorsResponse> {
    return this.request<FiiIndicatorsResponse>(`/fiis/${enc(ticker)}/indicators`, { at: params?.at });
  }

  // --- fundos de investimento (CVM 175) ---------------------------------------
  screenFunds(params?: ScreenFundsParams): Promise<FundScreenerResponse> {
    return this.request<FundScreenerResponse>("/screener/funds", {
      cursor: params?.cursor,
      limit: params?.limit,
      classificacao: params?.classificacao,
      manager: params?.manager,
      min_net_worth: params?.min_net_worth,
      sort: params?.sort,
      order: params?.order,
    });
  }

  getFund(cnpj: string): Promise<FundProfile> {
    return this.request<FundProfile>(`/funds/${enc(cnpj)}`);
  }

  listFundHoldings(
    cnpj: string,
    params?: { cursor?: string; limit?: number; date?: string },
  ): Promise<FundHoldingsResponse> {
    return this.request<FundHoldingsResponse>(`/funds/${enc(cnpj)}/holdings`, {
      cursor: params?.cursor,
      limit: params?.limit,
      date: params?.date,
    });
  }

  listInvestedFunds(
    cnpj: string,
    params?: { cursor?: string; limit?: number; date?: string },
  ): Promise<InvestedFundsResponse> {
    return this.request<InvestedFundsResponse>(`/funds/${enc(cnpj)}/invested-funds`, {
      cursor: params?.cursor,
      limit: params?.limit,
      date: params?.date,
    });
  }

  listFundInvestors(
    cnpj: string,
    params?: { cursor?: string; limit?: number; date?: string },
  ): Promise<FundInvestorsResponse> {
    return this.request<FundInvestorsResponse>(`/funds/${enc(cnpj)}/investors`, {
      cursor: params?.cursor,
      limit: params?.limit,
      date: params?.date,
    });
  }

  listFundLookThrough(
    cnpj: string,
    params?: { cursor?: string; limit?: number; date?: string; ticker?: string },
  ): Promise<FundLookThroughResponse> {
    return this.request<FundLookThroughResponse>(`/funds/${enc(cnpj)}/look-through`, {
      cursor: params?.cursor,
      limit: params?.limit,
      date: params?.date,
      ticker: params?.ticker,
    });
  }

  // --- fluxo de investidores (B3, BDM/BDI) ------------------------------------
  listInvestorFlow(
    params?: RangeParams & { limit?: number; cursor?: string; investor_type?: string },
  ): Promise<InvestorFlowResponse> {
    return this.request<InvestorFlowResponse>("/market/investor-flow", {
      cursor: params?.cursor,
      limit: params?.limit,
      from: params?.from,
      to: params?.to,
      investor_type: params?.investor_type,
    });
  }

  listInvestorFlowMonthly(params?: {
    cursor?: string;
    limit?: number;
    month?: string;
    investor_type?: string;
    segment?: string;
  }): Promise<InvestorFlowMonthlyResponse> {
    return this.request<InvestorFlowMonthlyResponse>("/market/investor-flow/monthly", {
      cursor: params?.cursor,
      limit: params?.limit,
      month: params?.month,
      investor_type: params?.investor_type,
      segment: params?.segment,
    });
  }

  // --- ofertas públicas (mercado primário, CVM) --------------------------------
  listOfferings(
    params?: RangeParams & {
      cursor?: string;
      limit?: number;
      search?: string;
      regime?: "ICVM_400_476" | "RCVM_160";
      tipo_ativo?: string;
    },
  ): Promise<OfferingsResponse> {
    return this.request<OfferingsResponse>("/offerings", {
      cursor: params?.cursor,
      limit: params?.limit,
      search: params?.search,
      regime: params?.regime,
      tipo_ativo: params?.tipo_ativo,
      from: params?.from,
      to: params?.to,
    });
  }

  // --- índices -------------------------------------------------------------
  listMarketEvents(params?: {
    date?: string; from?: string; to?: string;
    layer?: "estrutural" | "setorial" | "corporativa";
    category?: string; entity?: string; ticker?: string; thread?: string;
    cursor?: string; limit?: number;
  }): Promise<MarketEventsResponse> {
    return this.request<MarketEventsResponse>("/events", { ...params });
  }

  getMarketEvent(id: number): Promise<MarketEvent> {
    return this.request<MarketEvent>(`/events/${id}`);
  }

  getEventThread(slug: string): Promise<EventThread> {
    return this.request<EventThread>(`/events/threads/${encodeURIComponent(slug)}`);
  }

  listMarketAnomalies(params?: {
    series?: "IBOV" | "IFIX" | "USDBRL" | "BRENT" | "VIX" | "SP500" | "NASDAQ"; min_z?: number; from?: string; to?: string;
    cursor?: string; limit?: number;
  }): Promise<MarketAnomaliesResponse> {
    return this.request<MarketAnomaliesResponse>("/events/anomalies", { ...params });
  }

  findSimilarMarketEvents(id: number, params?: { limit?: number }): Promise<SimilarMarketEventsResponse> {
    return this.request<SimilarMarketEventsResponse>(`/events/${id}/similar`, { ...params });
  }

  searchMarketEvents(q: string, params?: { limit?: number }): Promise<MarketEventSearchResponse> {
    return this.request<MarketEventSearchResponse>("/events/search", { q, ...params });
  }

  getIndexComposition(code: string): Promise<IndexCompositionResponse> {
    return this.request<IndexCompositionResponse>(`/indices/${enc(code)}/composition`);
  }

  getIndexIntraday(code: string, params?: { session?: string }): Promise<IntradaySeriesResponse> {
    return this.request<IntradaySeriesResponse>(`/indices/${enc(code)}/intraday`, {
      session: params?.session,
    });
  }

  // --- cotações ao vivo (delay 15 min) ---------------------------------------
  getLiveQuotes(params: LiveQuotesParams): Promise<LiveQuotesResponse> {
    return this.request<LiveQuotesResponse>("/quotes/live", {
      tickers: Array.isArray(params.tickers) ? params.tickers.join(",") : params.tickers,
      index: params.index,
    });
  }

  getStockIntraday(ticker: string, params?: { session?: string }): Promise<IntradaySeriesResponse> {
    return this.request<IntradaySeriesResponse>(`/stocks/${enc(ticker)}/intraday`, {
      session: params?.session,
    });
  }

  // --- renda fixa ----------------------------------------------------------
  getBondCurves(params?: {
    kind?: "di" | "pre_ref" | "ipca_ref" | "implicita_ref";
    date?: string;
  }): Promise<BondCurveResponse> {
    return this.request<BondCurveResponse>("/bonds/curves", {
      kind: params?.kind,
      date: params?.date,
    });
  }

  listTesouroAuctions(
    params?: { type?: string; cursor?: string; limit?: number } & RangeParams,
  ): Promise<TesouroAuctionsResponse> {
    return this.request<TesouroAuctionsResponse>("/bonds/tesouro/auctions", {
      type: params?.type,
      from: params?.from,
      to: params?.to,
      cursor: params?.cursor,
      limit: params?.limit,
    });
  }

  listMineralProducers(
    mineral: string,
    params: { statistic?: "production" | "reserves"; year?: number; detail?: string } = {},
  ): Promise<MineralProducersResponse> {
    return this.request<MineralProducersResponse>(`/minerals/${enc(mineral)}/producers`, params);
  }

  listMineralObservations(params: {
    mineral?: string;
    country?: string;
    statistic?: "production" | "reserves";
    year?: number;
    from?: number;
    to?: number;
    include_world_total?: boolean;
    cursor?: string;
    limit?: number;
  } = {}): Promise<MineralObservationsResponse> {
    return this.request<MineralObservationsResponse>("/minerals/observations", params);
  }

  // --- commodities (futuros da B3) -----------------------------------------
  getCommodityCurve(
    commodity: string,
    params?: { date?: string },
  ): Promise<CommodityCurveResponse> {
    return this.request<CommodityCurveResponse>(`/commodities/${enc(commodity)}/curve`, {
      date: params?.date,
    });
  }

  listCommoditySettlements(
    commodity: string,
    params?: { contract?: string; cursor?: string; limit?: number } & RangeParams,
  ): Promise<CommoditySettlementsResponse> {
    return this.request<CommoditySettlementsResponse>(`/commodities/${enc(commodity)}/settlements`, {
      contract: params?.contract,
      from: params?.from,
      to: params?.to,
      cursor: params?.cursor,
      limit: params?.limit,
    });
  }

  // --- crédito privado -------------------------------------------------------
  listDebentures(params?: {
    q?: string;
    issuerCnpj?: string;
    indexer?: string;
    incentivada?: boolean;
    active?: boolean;
    maturityFrom?: string;
    maturityTo?: string;
    cursor?: string;
    limit?: number;
  }): Promise<DebenturesResponse> {
    return this.request<DebenturesResponse>("/credit/debentures", {
      q: params?.q,
      issuerCnpj: params?.issuerCnpj,
      indexer: params?.indexer,
      incentivada: params?.incentivada,
      active: params?.active,
      maturityFrom: params?.maturityFrom,
      maturityTo: params?.maturityTo,
      cursor: params?.cursor,
      limit: params?.limit,
    });
  }

  listOtcQuotes(
    params: { family: string; date?: string; cursor?: string; limit?: number } & RangeParams,
  ): Promise<CreditOtcQuotesResponse> {
    return this.request<CreditOtcQuotesResponse>("/credit/otc", {
      family: params.family,
      date: params.date,
      from: params.from,
      to: params.to,
      cursor: params.cursor,
      limit: params.limit,
    });
  }

  listFidcs(params?: {
    q?: string;
    cnpj?: string;
    date?: string;
    minNetWorth?: number;
    cursor?: string;
    limit?: number;
  }): Promise<FidcListResponse> {
    return this.request<FidcListResponse>("/credit/fidc", {
      q: params?.q,
      cnpj: params?.cnpj,
      date: params?.date,
      minNetWorth: params?.minNetWorth,
      cursor: params?.cursor,
      limit: params?.limit,
    });
  }

  /**
   * Termos do regulamento da classe, com o custo anual já somado.
   *
   * `custo.total_pct_aa` soma SÓ o que incide sobre o patrimônio ao ano; taxa sobre
   * valor cedido fica fora e `parcial` vira true. `null` significa nada comparável
   * declarado — nunca zero.
   */
  getFidcRegulationTerms(cnpj: string): Promise<FidcRegulationTerms> {
    return this.request<FidcRegulationTerms>(`/credit/fidc/${encodeURIComponent(cnpj)}/terms`);
  }

  listFidcDelinquency(
    cnpj: string,
    params?: { date?: string },
  ): Promise<FidcDelinquencyResponse> {
    return this.request<FidcDelinquencyResponse>(
      `/credit/fidc/${encodeURIComponent(cnpj)}/delinquency`,
      { date: params?.date },
    );
  }

  listFidcScr(cnpj: string, params?: { date?: string }): Promise<FidcScrResponse> {
    return this.request<FidcScrResponse>(`/credit/fidc/${encodeURIComponent(cnpj)}/scr`, {
      date: params?.date,
    });
  }

  listFidcQuotes(
    cnpj: string,
    params?: { from?: string; to?: string; cursor?: string; limit?: number },
  ): Promise<FidcSecondaryResponse> {
    return this.request<FidcSecondaryResponse>(
      `/credit/fidc/${encodeURIComponent(cnpj)}/quotes`,
      { from: params?.from, to: params?.to, cursor: params?.cursor, limit: params?.limit },
    );
  }

  listFidcSectors(cnpj: string, params?: { date?: string }): Promise<FidcSectorResponse> {
    return this.request<FidcSectorResponse>(`/credit/fidc/${encodeURIComponent(cnpj)}/sectors`, {
      date: params?.date,
    });
  }

  // O CNPJ aqui é o do CEDENTE, não o da classe — a rota vive fora de /fidc de propósito.
  listFidcOriginatorExposure(
    cnpj: string,
    params?: { date?: string },
  ): Promise<FidcOriginatorExposureResponse> {
    return this.request<FidcOriginatorExposureResponse>(
      `/credit/originators/${encodeURIComponent(cnpj)}`,
      { date: params?.date },
    );
  }

  listFidcInvestors(cnpj: string, params?: { date?: string }): Promise<FidcInvestorResponse> {
    return this.request<FidcInvestorResponse>(
      `/credit/fidc/${encodeURIComponent(cnpj)}/investors`,
      { date: params?.date },
    );
  }

  listFidcPricing(cnpj: string, params?: { date?: string }): Promise<FidcPricingResponse> {
    return this.request<FidcPricingResponse>(`/credit/fidc/${encodeURIComponent(cnpj)}/pricing`, {
      date: params?.date,
    });
  }

  listCreditRatings(params?: {
    assetCode?: string;
    issuerCnpj?: string;
    agency?: string;
    entityType?: string;
    scale?: CreditRatingScale;
    confidence?: "high" | "medium" | "low";
    /** Uma linha por (agência, escala), a mais recente — "a nota do emissor pela Moody's". */
    perAgency?: boolean;
    cursor?: string;
    limit?: number;
  }): Promise<CreditRatingsResponse> {
    return this.request<CreditRatingsResponse>("/credit/ratings", {
      // Só viaja quando pedido: o servidor lê "true"/"false" e o default é a lista por série.
      perAgency: params?.perAgency ? "true" : undefined,
      assetCode: params?.assetCode,
      issuerCnpj: params?.issuerCnpj,
      agency: params?.agency,
      entityType: params?.entityType,
      scale: params?.scale,
      confidence: params?.confidence,
      cursor: params?.cursor,
      limit: params?.limit,
    });
  }

  // Perfil do emissor (CNPJ completo, 14 dígitos). `kind` diz se o emissor é banco ou
  // corporativo, e `has_bank_risk` se há série prudencial do BCB — a ausência dela num
  // corporativo é definição, não falta de dado.
  getCreditCurve(params?: {
    indexer?: "DI" | "IPCA";
    date?: string;
  }): Promise<CreditCurveResponse> {
    return this.request<CreditCurveResponse>("/credit/curve", {
      indexer: params?.indexer,
      date: params?.date,
    });
  }

  screenDebentures(params?: {
    q?: string;
    indexer?: string;
    incentivada?: boolean;
    active?: boolean;
    maturityFrom?: string;
    maturityTo?: string;
    minSpread?: number;
    maxSpread?: number;
    minTrades30d?: number;
    minFundHolders?: number;
    orderBy?: "spread" | "maturity" | "volume_30d" | "trades_30d" | "fund_holders" | "pct_of_curve";
    order?: "asc" | "desc";
    cursor?: string;
    limit?: number;
  }): Promise<DebentureScreenerResponse> {
    return this.request<DebentureScreenerResponse>("/screener/debentures", {
      q: params?.q,
      indexer: params?.indexer,
      incentivada: params?.incentivada,
      active: params?.active,
      maturityFrom: params?.maturityFrom,
      maturityTo: params?.maturityTo,
      minSpread: params?.minSpread,
      maxSpread: params?.maxSpread,
      minTrades30d: params?.minTrades30d,
      minFundHolders: params?.minFundHolders,
      orderBy: params?.orderBy,
      order: params?.order,
      cursor: params?.cursor,
      limit: params?.limit,
    });
  }

  // --- macro ---------------------------------------------------------------
  getMacroRegime(params?: { at?: string }): Promise<RegimeSnapshot> {
    return this.request<RegimeSnapshot>("/macro/regime", { at: params?.at });
  }

  getMacroGears(params?: { gear?: string }): Promise<MacroGearsResponse> {
    return this.request<MacroGearsResponse>("/macro/gears", { gear: params?.gear });
  }

  listCryptoLive(): Promise<CryptoLiveResponse> {
    return this.request<CryptoLiveResponse>("/crypto/live");
  }

  getUsAsset(ticker: string): Promise<UsAssetDetail> {
    return this.request<UsAssetDetail>(`/us/assets/${enc(ticker)}`);
  }

  listUsFilings(
    ticker: string,
    params?: { form?: string; limit?: number; cursor?: string },
  ): Promise<UsFilingsResponse> {
    return this.request<UsFilingsResponse>(`/us/assets/${enc(ticker)}/filings`, {
      form: params?.form,
      limit: params?.limit,
      cursor: params?.cursor,
    });
  }

  // --- opções --------------------------------------------------------------
  getOptionsChain(
    underlying: string,
    params?: { expiry?: string; type?: "call" | "put" },
  ): Promise<OptionsChainResponse> {
    return this.request<OptionsChainResponse>(`/options/${enc(underlying)}/chain`, {
      expiry: params?.expiry,
      type: params?.type,
    });
  }

  /** @deprecated use `getOptionsChain`. Mantido para não quebrar quem já chamava. */
  listOptionsChain(
    underlying: string,
    params?: { expiry?: string; type?: "call" | "put" },
  ): Promise<OptionsChainResponse> {
    return this.getOptionsChain(underlying, params);
  }

  listOptionExpiries(underlying: string): Promise<OptionExpiriesResponse> {
    return this.request<OptionExpiriesResponse>(`/options/${enc(underlying)}/expiries`);
  }

  listOptionQuotes(
    optionTicker: string,
    params?: RangeParams & { limit?: number; cursor?: string },
  ): Promise<OptionsQuotesResponse> {
    return this.request<OptionsQuotesResponse>(`/options/${enc(optionTicker)}/quotes`, {
      from: params?.from,
      to: params?.to,
      limit: params?.limit,
      cursor: params?.cursor,
    });
  }

  // --- busca ---------------------------------------------------------------
  search(q: string, params?: { limit?: number }): Promise<SearchResponse> {
    return this.request<SearchResponse>("/search", { q, limit: params?.limit });
  }

  // --- documentos (exigem chave por usuário) -------------------------------
  searchDocuments(q: string, params?: SearchDocumentsParams): Promise<DocumentSearchResponse> {
    return this.request<DocumentSearchResponse>("/documents/search", {
      q,
      tickers: Array.isArray(params?.tickers) ? params?.tickers.join(",") : params?.tickers,
      category: params?.category,
      document_kind: params?.documentKind,
      entity_type: params?.entityType,
      issuer_cnpj: params?.issuerCnpj,
      asset_code: params?.assetCode,
      asset_family: params?.assetFamily,
      year: params?.year,
      filed_before: params?.filedBefore,
      filed_after: params?.filedAfter,
      protocol: params?.protocol,
      reference_date: params?.referenceDate,
      reference_from: params?.referenceFrom,
      reference_to: params?.referenceTo,
      doc_type: params?.docType,
      tables_only: params?.tablesOnly,
      financial_only: params?.financialOnly,
      include_context: params?.includeContext,
      limit: params?.limit,
    });
  }

  readDocument(protocol: string, params?: ReadDocumentParams): Promise<DocumentReadResponse> {
    return this.request<DocumentReadResponse>(`/documents/${enc(protocol)}/chunks`, {
      source: params?.source,
      cursor: params?.cursor,
      limit: params?.limit,
    });
  }

  getDocumentTaxonomy(): Promise<DocumentTaxonomy> {
    return this.request<DocumentTaxonomy>("/documents/taxonomy");
  }

  // --- gestão de carteira (escrevem na carteira REAL do dono da chave) ------
}

/** Segmento de path seguro (tickers/códigos vêm da UI/URL). */
// Vários ids no MESMO segmento de caminho, separados por vírgula — o contrato lê a lista de lá.
// Cada id codificado por si; a vírgula fica crua porque é o separador que a rota espera.
function ids(id: string | string[]): string {
  return (Array.isArray(id) ? id : [id]).map(enc).join(",");
}

function enc(segment: string): string {
  return encodeURIComponent(segment);
}
