import {
  type DataBolsaClient,
  type LiveQuotesParams,
  NotInPreviewError,
  type ScreenFiisParams,
  type ScreenFundsParams,
  type ScreenStocksParams,
} from "./client";
import type {
  AddPortfolioTransactionResponse,
  BdrListResponse,
  BdrProfile,
  BdrQuotesResponse,
  CompanyListResponse,
  CompanyResponse,
  CorporateEventsResponse,
  CreatePortfolioResponse,
  CreateThesisResponse,
  CryptoAsset,
  CryptoListResponse,
  CryptoLiveResponse,
  CryptoQuotesResponse,
  DividendsResponse,
  DocumentSearchResponse,
  DocumentTaxonomy,
  DocumentsResponse,
  EtfListResponse,
  EtfProfile,
  EventThread,
  ExpectationsResponse,
  Fii,
  FiiDistributionsResponse,
  FiiIndicatorsResponse,
  FiiReportsResponse,
  FiiScreenResponse,
  FundHoldersResponse,
  FundHoldingsResponse,
  FundInvestorsResponse,
  FundListResponse,
  FundLookThroughResponse,
  FundProfile,
  FundQuotesResponse,
  FundScreenerResponse,
  HealthResponse,
  IndexCompositionResponse,
  IndexListResponse,
  IndexQuotesResponse,
  IndicatorHistoryResponse,
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
  PortfolioAssetRef,
  PortfolioDetail,
  PortfolioHistoryResponse,
  PortfolioLookThroughResponse,
  PortfolioXrayResponse,
  PortfolioImportInput,
  PortfolioImportRowsResponse,
  PortfolioImportSummary,
  PortfolioImportsResponse,
  PortfolioPatch,
  PortfolioResponse,
  PortfolioRfContract,
  PortfolioTransaction,
  PortfolioTransactionInput,
  PortfolioTransactionPatch,
  PortfolioTransactionsResponse,
  PortfoliosResponse,
  QuotesResponse,
  RangeParams,
  RegimeSnapshot,
  ScreenStocksResponse,
  SearchDocumentsParams,
  SearchResponse,
  SeriesCatalogResponse,
  SeriesResponse,
  SimilarMarketEventsResponse,
  StatementsResponse,
  Stock,
  StockIndicatorsResponse,
  SuitabilityResponse,
  TesouroBondsResponse,
  BondCurveResponse,
  TesouroAuctionsResponse,
  CommoditiesResponse,
  CommodityCurveResponse,
  CommoditySettlementsResponse,
  DebenturesResponse,
  DebentureResponse,
  DebentureQuotesResponse,
  CreditCurveResponse,
  CreditOtcQuotesResponse,
  IssuerProfileResponse,
  IssuerRiskResponse,
  MineralsResponse,
  MineralResponse,
  MineralProducersResponse,
  MineralObservationsResponse,
  CreditRatingsResponse,
  CreditRatingHistoryResponse,
  CreditRatingScale,
  CoeListResponse,
  CoeResponse,
  FidcListResponse,
  FidcHistoryResponse,
  FidcSeriesResponse,
  FidcDelinquencyResponse,
  FidcScrResponse,
  PortfolioCostsResponse,
  DebentureScreenerResponse,
  DebentureHoldersResponse,
  DebentureDemandResponse,
  BenchmarkIndicesResponse,
  ThesesResponse,
  ThesisExportStatus,
  ThesisResponse,
  ThesisWriteInput,
  TradeStatsResponse,
  UsAssetDetail,
  UsAssetsResponse,
  UsFilingsResponse,
  UsQuotesResponse,
  YieldCurveResponse,
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

export class HttpClient implements DataBolsaClient {
  private readonly base: string;
  private readonly getToken?: () => string | null | undefined;

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

  // --- ações ---------------------------------------------------------------
  getStock(ticker: string): Promise<Stock> {
    return this.request<Stock>(`/stocks/${enc(ticker)}`);
  }

  listQuotes(
    ticker: string,
    params?: RangeParams & { adjusted?: boolean; limit?: number },
  ): Promise<QuotesResponse> {
    return this.request<QuotesResponse>(`/stocks/${enc(ticker)}/quotes`, {
      from: params?.from,
      to: params?.to,
      limit: params?.limit,
      // só envia quando explicitamente não-ajustado (servidor: adjusted = v !== "false")
      adjusted: params?.adjusted === false ? "false" : undefined,
    });
  }

  getStockIndicators(ticker: string, params?: { at?: string }): Promise<StockIndicatorsResponse> {
    return this.request<StockIndicatorsResponse>(`/stocks/${enc(ticker)}/indicators`, {
      at: params?.at,
    });
  }

  getStockIndicatorHistory(
    ticker: string,
    name: string,
    params?: RangeParams,
  ): Promise<IndicatorHistoryResponse> {
    // Contrato: /stocks/{ticker}/indicators/history?name=… (não /{name}/history).
    return this.request<IndicatorHistoryResponse>(`/stocks/${enc(ticker)}/indicators/history`, {
      name,
      from: params?.from,
      to: params?.to,
    });
  }

  listDividends(ticker: string, params?: RangeParams): Promise<DividendsResponse> {
    return this.request<DividendsResponse>(`/stocks/${enc(ticker)}/dividends`, {
      from: params?.from,
      to: params?.to,
    });
  }

  listCorporateEvents(ticker: string, params?: RangeParams): Promise<CorporateEventsResponse> {
    return this.request<CorporateEventsResponse>(`/stocks/${enc(ticker)}/events`, {
      from: params?.from,
      to: params?.to,
    });
  }

  listCompanies(
    params?: { cursor?: string; limit?: number; sector?: string; segment?: string; search?: string },
  ): Promise<CompanyListResponse> {
    return this.request<CompanyListResponse>("/companies", {
      cursor: params?.cursor,
      limit: params?.limit,
      sector: params?.sector,
      segment: params?.segment,
      search: params?.search,
    });
  }

  getCompany(company: string | number): Promise<CompanyResponse> {
    return this.request<CompanyResponse>(`/companies/${enc(String(company))}`);
  }

  listCompanyStatements(
    company: string | number,
    params?: RangeParams & { cursor?: string; limit?: number; scope?: string },
  ): Promise<StatementsResponse> {
    return this.request<StatementsResponse>(`/companies/${enc(String(company))}/statements`, {
      cursor: params?.cursor,
      limit: params?.limit,
      scope: params?.scope,
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

  listFundHolders(
    ticker: string,
    params?: { cursor?: string; limit?: number; date?: string },
  ): Promise<FundHoldersResponse> {
    return this.request<FundHoldersResponse>(`/stocks/${enc(ticker)}/fund-holders`, {
      cursor: params?.cursor,
      limit: params?.limit,
      date: params?.date,
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

  listTradeStats(
    ticker: string,
    params?: RangeParams & { limit?: number; cursor?: string },
  ): Promise<TradeStatsResponse> {
    return this.request<TradeStatsResponse>(`/stocks/${enc(ticker)}/trade-stats`, {
      cursor: params?.cursor,
      limit: params?.limit,
      from: params?.from,
      to: params?.to,
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

  getFii(ticker: string): Promise<Fii> {
    return this.request<Fii>(`/fiis/${enc(ticker)}`);
  }

  getFiiIndicators(ticker: string, params?: { at?: string }): Promise<FiiIndicatorsResponse> {
    return this.request<FiiIndicatorsResponse>(`/fiis/${enc(ticker)}/indicators`, { at: params?.at });
  }

  getFiiIndicatorHistory(
    ticker: string,
    name: string,
    params?: RangeParams,
  ): Promise<IndicatorHistoryResponse> {
    return this.request<IndicatorHistoryResponse>(`/fiis/${enc(ticker)}/indicators/history`, {
      name,
      from: params?.from,
      to: params?.to,
    });
  }

  listFiiDistributions(ticker: string, params?: RangeParams): Promise<FiiDistributionsResponse> {
    return this.request<FiiDistributionsResponse>(`/fiis/${enc(ticker)}/distributions`, {
      from: params?.from,
      to: params?.to,
    });
  }

  listFiiReports(ticker: string, params?: RangeParams): Promise<FiiReportsResponse> {
    return this.request<FiiReportsResponse>(`/fiis/${enc(ticker)}/reports`, {
      from: params?.from,
      to: params?.to,
    });
  }

  // --- ETFs ------------------------------------------------------------------
  listEtfs(params?: {
    cursor?: string;
    limit?: number;
    search?: string;
    segment?: string;
  }): Promise<EtfListResponse> {
    return this.request<EtfListResponse>("/etfs", {
      cursor: params?.cursor,
      limit: params?.limit,
      search: params?.search,
      segment: params?.segment,
    });
  }

  getEtf(ticker: string): Promise<EtfProfile> {
    return this.request<EtfProfile>(`/etfs/${enc(ticker)}`);
  }

  // --- fundos de investimento (CVM 175) ---------------------------------------
  screenFunds(params?: ScreenFundsParams): Promise<FundScreenerResponse> {
    return this.request<FundScreenerResponse>("/screener/funds", {
      cursor: params?.cursor,
      limit: params?.limit,
      classificacao: params?.classificacao,
      min_net_worth: params?.min_net_worth,
      sort: params?.sort,
      order: params?.order,
    });
  }

  listFunds(params?: {
    cursor?: string;
    limit?: number;
    search?: string;
    classificacao?: string;
  }): Promise<FundListResponse> {
    return this.request<FundListResponse>("/funds", {
      cursor: params?.cursor,
      limit: params?.limit,
      search: params?.search,
      classificacao: params?.classificacao,
    });
  }

  getFund(cnpj: string): Promise<FundProfile> {
    return this.request<FundProfile>(`/funds/${enc(cnpj)}`);
  }

  listFundQuotes(
    cnpj: string,
    params?: RangeParams & { limit?: number; cursor?: string },
  ): Promise<FundQuotesResponse> {
    return this.request<FundQuotesResponse>(`/funds/${enc(cnpj)}/quotes`, {
      cursor: params?.cursor,
      limit: params?.limit,
      from: params?.from,
      to: params?.to,
    });
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

  listIndices(): Promise<IndexListResponse> {
    return this.request<IndexListResponse>("/indices");
  }

  listIndexQuotes(code: string, params?: RangeParams & { limit?: number }): Promise<IndexQuotesResponse> {
    return this.request<IndexQuotesResponse>(`/indices/${enc(code)}/quotes`, {
      from: params?.from,
      to: params?.to,
      limit: params?.limit,
    });
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

  // --- séries / renda fixa -------------------------------------------------
  listSeries(
    params?: { cursor?: string; limit?: number; source?: string; search?: string },
  ): Promise<SeriesCatalogResponse> {
    return this.request<SeriesCatalogResponse>("/series", {
      cursor: params?.cursor,
      limit: params?.limit,
      source: params?.source,
      search: params?.search,
    });
  }

  getSeries(
    source: string,
    seriesId: string,
    params?: RangeParams & { accumulated?: "none" | "12m" | "ytd" },
  ): Promise<SeriesResponse> {
    return this.request<SeriesResponse>(`/series/${enc(source)}/${enc(seriesId)}`, {
      from: params?.from,
      to: params?.to,
      accumulated: params?.accumulated,
    });
  }

  getYieldCurve(params?: { kind?: "nominal" | "real" }): Promise<YieldCurveResponse> {
    return this.request<YieldCurveResponse>("/bonds/tesouro/yield-curve", { kind: params?.kind });
  }

  listTesouroBonds(params?: {
    type?: string;
    maturity?: string;
    date?: string;
    limit?: number;
  }): Promise<TesouroBondsResponse> {
    return this.request<TesouroBondsResponse>("/bonds/tesouro", {
      type: params?.type,
      maturity: params?.maturity,
      date: params?.date,
      limit: params?.limit,
    });
  }

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

  // --- commodities (futuros da B3) -----------------------------------------

  listMinerals(params: {
    search?: string;
    critical?: boolean;
    group?: string;
    cursor?: string;
    limit?: number;
  } = {}): Promise<MineralsResponse> {
    return this.request<MineralsResponse>("/minerals", params);
  }

  getMineral(mineral: string): Promise<MineralResponse> {
    return this.request<MineralResponse>(`/minerals/${enc(mineral)}`);
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

  listCommodities(): Promise<CommoditiesResponse> {
    return this.request<CommoditiesResponse>("/commodities");
  }

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

  getDebenture(code: string): Promise<DebentureResponse> {
    return this.request<DebentureResponse>(`/credit/debentures/${encodeURIComponent(code)}`);
  }

  listDebentureQuotes(
    code: string,
    params?: { cursor?: string; limit?: number } & RangeParams,
  ): Promise<DebentureQuotesResponse> {
    return this.request<DebentureQuotesResponse>(
      `/credit/debentures/${encodeURIComponent(code)}/quotes`,
      { from: params?.from, to: params?.to, cursor: params?.cursor, limit: params?.limit },
    );
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

  listCoes(params?: {
    issuer?: string;
    maturityFrom?: string;
    maturityTo?: string;
    minIssueSize?: number;
    tradedOnly?: boolean;
    cursor?: string;
    limit?: number;
  }): Promise<CoeListResponse> {
    return this.request<CoeListResponse>("/structured/coe", {
      issuer: params?.issuer,
      maturityFrom: params?.maturityFrom,
      maturityTo: params?.maturityTo,
      minIssueSize: params?.minIssueSize,
      tradedOnly: params?.tradedOnly,
      cursor: params?.cursor,
      limit: params?.limit,
    });
  }

  getCoe(code: string): Promise<CoeResponse> {
    return this.request<CoeResponse>(`/structured/coe/${encodeURIComponent(code)}`);
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

  listFidcHistory(
    cnpj: string,
    params?: { from?: string; to?: string; cursor?: string; limit?: number },
  ): Promise<FidcHistoryResponse> {
    return this.request<FidcHistoryResponse>(
      `/credit/fidc/${encodeURIComponent(cnpj)}/history`,
      { from: params?.from, to: params?.to, cursor: params?.cursor, limit: params?.limit },
    );
  }

  listFidcSeries(cnpj: string, params?: { date?: string }): Promise<FidcSeriesResponse> {
    return this.request<FidcSeriesResponse>(`/credit/fidc/${encodeURIComponent(cnpj)}/series`, {
      date: params?.date,
    });
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

  getPortfolioCosts(id: string): Promise<PortfolioCostsResponse> {
    return this.request<PortfolioCostsResponse>(
      `/portfolios/${encodeURIComponent(id)}/costs`,
    );
  }

  getIssuerRisk(cnpj: string): Promise<IssuerRiskResponse> {
    return this.request<IssuerRiskResponse>(`/credit/issuers/${encodeURIComponent(cnpj)}/risk`);
  }

  listCreditRatings(params?: {
    assetCode?: string;
    issuerCnpj?: string;
    agency?: string;
    entityType?: string;
    scale?: CreditRatingScale;
    confidence?: "high" | "medium" | "low";
    cursor?: string;
    limit?: number;
  }): Promise<CreditRatingsResponse> {
    return this.request<CreditRatingsResponse>("/credit/ratings", {
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

  // assetCode OU issuerCnpj é obrigatório: sem chave a consulta varreria a tabela
  // inteira e devolveria o histórico de ninguém. A API responde 422 nesse caso.
  listCreditRatingHistory(params: {
    assetCode?: string;
    issuerCnpj?: string;
    agency?: string;
  }): Promise<CreditRatingHistoryResponse> {
    return this.request<CreditRatingHistoryResponse>("/credit/ratings/history", {
      assetCode: params.assetCode,
      issuerCnpj: params.issuerCnpj,
      agency: params.agency,
    });
  }

  // Perfil do emissor (CNPJ completo, 14 dígitos). Use quando getIssuerRisk
  // devolver 404: `kind` diz se o emissor é corporativo — caso em que a solidez
  // prudencial do BCB não existe por definição, e não por falta de dado.
  getIssuerProfile(cnpj: string): Promise<IssuerProfileResponse> {
    return this.request<IssuerProfileResponse>(`/credit/issuers/${encodeURIComponent(cnpj)}`);
  }

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

  listDebentureHolders(
    code: string,
    params?: { date?: string; cursor?: string; limit?: number },
  ): Promise<DebentureHoldersResponse> {
    return this.request<DebentureHoldersResponse>(
      `/credit/debentures/${encodeURIComponent(code)}/holders`,
      { date: params?.date, cursor: params?.cursor, limit: params?.limit },
    );
  }

  listDebentureDemand(
    code: string,
    params?: { cursor?: string; limit?: number },
  ): Promise<DebentureDemandResponse> {
    return this.request<DebentureDemandResponse>(
      `/credit/debentures/${encodeURIComponent(code)}/demand`,
      { cursor: params?.cursor, limit: params?.limit },
    );
  }

  listBenchmarkIndices(
    params?: { code?: string; cursor?: string; limit?: number } & RangeParams,
  ): Promise<BenchmarkIndicesResponse> {
    return this.request<BenchmarkIndicesResponse>("/indices/benchmarks", {
      code: params?.code,
      from: params?.from,
      to: params?.to,
      cursor: params?.cursor,
      limit: params?.limit,
    });
  }

  // --- macro ---------------------------------------------------------------
  getMarketExpectations(
    indicator: "ipca" | "selic" | "pib" | "cambio",
    params?: { reference?: string } & RangeParams,
  ): Promise<ExpectationsResponse> {
    return this.request<ExpectationsResponse>("/macro/expectations", {
      indicator,
      reference: params?.reference,
      from: params?.from,
      to: params?.to,
    });
  }

  getMacroRegime(params?: { at?: string }): Promise<RegimeSnapshot> {
    return this.request<RegimeSnapshot>("/macro/regime", { at: params?.at });
  }

  getMacroGears(params?: { gear?: string }): Promise<MacroGearsResponse> {
    return this.request<MacroGearsResponse>("/macro/gears", { gear: params?.gear });
  }

  listCrypto(params?: { search?: string; limit?: number; cursor?: string }): Promise<CryptoListResponse> {
    return this.request<CryptoListResponse>("/crypto", {
      search: params?.search,
      limit: params?.limit,
      cursor: params?.cursor,
    });
  }

  getCrypto(symbol: string): Promise<CryptoAsset> {
    return this.request<CryptoAsset>(`/crypto/${enc(symbol)}`);
  }

  listCryptoLive(): Promise<CryptoLiveResponse> {
    return this.request<CryptoLiveResponse>("/crypto/live");
  }

  listCryptoQuotes(
    symbol: string,
    params?: RangeParams & { interval?: "1d" | "1h"; limit?: number },
  ): Promise<CryptoQuotesResponse> {
    return this.request<CryptoQuotesResponse>(`/crypto/${enc(symbol)}/quotes`, {
      interval: params?.interval,
      from: params?.from,
      to: params?.to,
      limit: params?.limit,
    });
  }

  // --- ativos dos EUA --------------------------------------------------------
  listUsAssets(params?: {
    search?: string;
    type?: "stock" | "etf";
    bdr?: string;
    limit?: number;
    cursor?: string;
  }): Promise<UsAssetsResponse> {
    return this.request<UsAssetsResponse>("/us/assets", {
      search: params?.search,
      type: params?.type,
      bdr: params?.bdr,
      limit: params?.limit,
      cursor: params?.cursor,
    });
  }

  getUsAsset(ticker: string): Promise<UsAssetDetail> {
    return this.request<UsAssetDetail>(`/us/assets/${enc(ticker)}`);
  }

  listUsAssetQuotes(
    ticker: string,
    params?: RangeParams & { limit?: number; cursor?: string },
  ): Promise<UsQuotesResponse> {
    return this.request<UsQuotesResponse>(`/us/assets/${enc(ticker)}/quotes`, {
      from: params?.from,
      to: params?.to,
      limit: params?.limit,
      cursor: params?.cursor,
    });
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

  // --- BDRs ----------------------------------------------------------------
  listBdrs(params?: { search?: string; limit?: number; cursor?: string }): Promise<BdrListResponse> {
    return this.request<BdrListResponse>("/bdr", {
      search: params?.search,
      limit: params?.limit,
      cursor: params?.cursor,
    });
  }

  getBdr(ticker: string): Promise<BdrProfile> {
    return this.request<BdrProfile>(`/bdr/${enc(ticker)}`);
  }

  listBdrQuotes(
    ticker: string,
    params?: RangeParams & { limit?: number; cursor?: string },
  ): Promise<BdrQuotesResponse> {
    return this.request<BdrQuotesResponse>(`/bdr/${enc(ticker)}/quotes`, {
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

  // --- carteira / perfil / documentos (exigem chave por usuário) -----------
  getPortfolio(): Promise<PortfolioResponse> {
    return this.request<PortfolioResponse>("/portfolio");
  }

  getSuitability(): Promise<SuitabilityResponse> {
    return this.request<SuitabilityResponse>("/suitability");
  }

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
      tables_only: params?.tablesOnly,
      financial_only: params?.financialOnly,
      include_context: params?.includeContext,
      limit: params?.limit,
    });
  }

  getDocumentTaxonomy(): Promise<DocumentTaxonomy> {
    return this.request<DocumentTaxonomy>("/documents/taxonomy");
  }

  // --- gestão de carteira (escrevem na carteira REAL do dono da chave) ------
  getPortfolioHistory(): Promise<PortfolioHistoryResponse> {
    return this.request<PortfolioHistoryResponse>("/portfolio/history");
  }

  listPortfolios(): Promise<PortfoliosResponse> {
    return this.request<PortfoliosResponse>("/portfolios");
  }

  createPortfolio(name: string, visibility?: "private" | "unlisted" | "public"): Promise<CreatePortfolioResponse> {
    return this.request<CreatePortfolioResponse>("/portfolios", undefined, { method: "POST", body: { name, visibility } });
  }

  getPortfolioDetail(id: string): Promise<PortfolioDetail> {
    return this.request<PortfolioDetail>(`/portfolios/${enc(id)}`);
  }

  updatePortfolio(id: string, patch: PortfolioPatch): Promise<unknown> {
    return this.request<unknown>(`/portfolios/${enc(id)}`, undefined, {
      method: "PATCH",
      body: { name: patch.name, visibility: patch.visibility, exclude_from_consolidated: patch.excludeFromConsolidated },
    });
  }

  deletePortfolio(id: string): Promise<{ deleted?: boolean }> {
    return this.request<{ deleted?: boolean }>(`/portfolios/${enc(id)}`, undefined, { method: "DELETE" });
  }

  // --- teses de investimento (documentos de research do dono da chave) ------
  listMyTheses(): Promise<ThesesResponse> {
    return this.request<ThesesResponse>("/theses");
  }

  createThesis(input: ThesisWriteInput): Promise<CreateThesisResponse> {
    return this.request<CreateThesisResponse>("/theses", undefined, {
      method: "POST",
      body: { md: input.md, doc: input.doc, visibility: input.visibility },
    });
  }

  importThesisFile(input: { filename?: string; contentBase64: string; visibility?: "private" | "unlisted" | "public" }): Promise<CreateThesisResponse> {
    return this.request<CreateThesisResponse>("/theses/import", undefined, {
      method: "POST",
      body: { filename: input.filename, content_base64: input.contentBase64, visibility: input.visibility },
    });
  }

  getThesis(id: string, opts?: { include?: "doc" }): Promise<ThesisResponse> {
    return this.request<ThesisResponse>(`/theses/${enc(id)}`, opts?.include ? { include: opts.include } : undefined);
  }

  editThesis(id: string, edit: { oldText: string; newText: string }): Promise<ThesisResponse> {
    return this.request<ThesisResponse>(`/theses/${enc(id)}/edit`, undefined, {
      method: "POST",
      body: { old_text: edit.oldText, new_text: edit.newText },
    });
  }

  updateThesis(id: string, patch: Partial<ThesisWriteInput>): Promise<ThesisResponse> {
    return this.request<ThesisResponse>(`/theses/${enc(id)}`, undefined, {
      method: "PUT",
      body: { md: patch.md, doc: patch.doc, visibility: patch.visibility, archived: patch.archived, tags: patch.tags },
    });
  }

  reorderTheses(ids: string[]): Promise<{ ok?: boolean }> {
    return this.request<{ ok?: boolean }>("/theses/reorder", undefined, { method: "POST", body: { ids } });
  }

  deleteThesis(id: string): Promise<{ deleted?: boolean }> {
    return this.request<{ deleted?: boolean }>(`/theses/${enc(id)}`, undefined, { method: "DELETE" });
  }

  publishThesis(id: string, visibility: "private" | "unlisted" | "public"): Promise<ThesisResponse> {
    return this.request<ThesisResponse>(`/theses/${enc(id)}/publish`, undefined, {
      method: "POST",
      body: { visibility },
    });
  }

  exportThesis(id: string): Promise<ThesisExportStatus> {
    return this.request<ThesisExportStatus>(`/theses/${enc(id)}/export`, undefined, { method: "POST", body: {} });
  }

  getPortfolioHistoryById(id: string): Promise<PortfolioHistoryResponse> {
    return this.request<PortfolioHistoryResponse>(`/portfolios/${enc(id)}/history`);
  }

  getPortfolioXray(id: string): Promise<PortfolioXrayResponse> {
    return this.request<PortfolioXrayResponse>(`/portfolios/${enc(id)}/xray`);
  }

  getPortfolioLookThrough(id: string): Promise<PortfolioLookThroughResponse> {
    return this.request<PortfolioLookThroughResponse>(`/portfolios/${enc(id)}/look-through`);
  }

  addPortfolioAsset(id: string, asset: PortfolioAssetRef): Promise<unknown> {
    return this.request<unknown>(`/portfolios/${enc(id)}/assets`, undefined, {
      method: "POST",
      body: { asset_type: asset.assetType, symbol: asset.symbol },
    });
  }

  removePortfolioAsset(id: string, asset: PortfolioAssetRef): Promise<unknown> {
    return this.request<unknown>(
      `/portfolios/${enc(id)}/assets`,
      { asset_type: asset.assetType, symbol: asset.symbol },
      { method: "DELETE" },
    );
  }

  updatePortfolioAsset(id: string, asset: PortfolioAssetRef, rf: PortfolioRfContract): Promise<unknown> {
    return this.request<unknown>(
      `/portfolios/${enc(id)}/assets`,
      { asset_type: asset.assetType, symbol: asset.symbol },
      { method: "PATCH", body: { rf_indexer: rf.indexer, rf_rate: rf.rate } },
    );
  }

  listPortfolioTransactions(id: string, asset: PortfolioAssetRef): Promise<PortfolioTransactionsResponse> {
    return this.request<PortfolioTransactionsResponse>(`/portfolios/${enc(id)}/transactions`, {
      asset_type: asset.assetType,
      symbol: asset.symbol,
    });
  }

  addPortfolioTransaction(
    id: string,
    asset: PortfolioAssetRef,
    tx: PortfolioTransactionInput,
  ): Promise<AddPortfolioTransactionResponse> {
    return this.request<AddPortfolioTransactionResponse>(`/portfolios/${enc(id)}/transactions`, undefined, {
      method: "POST",
      body: {
        asset_type: asset.assetType,
        symbol: asset.symbol,
        kind: tx.kind,
        trade_date: tx.tradeDate,
        quantity: tx.quantity,
        price: tx.price,
        fees: tx.fees,
        ratio: tx.ratio,
        note: tx.note,
      },
    });
  }

  updatePortfolioTransaction(id: string, txId: string, patch: PortfolioTransactionPatch): Promise<PortfolioTransaction> {
    return this.request<PortfolioTransaction>(`/portfolios/${enc(id)}/transactions/${enc(txId)}`, undefined, {
      method: "PATCH",
      body: {
        kind: patch.kind,
        trade_date: patch.tradeDate,
        quantity: patch.quantity,
        price: patch.price,
        fees: patch.fees,
        ratio: patch.ratio,
        note: patch.note,
      },
    });
  }

  deletePortfolioTransaction(id: string, txId: string): Promise<{ deleted?: boolean }> {
    return this.request<{ deleted?: boolean }>(`/portfolios/${enc(id)}/transactions/${enc(txId)}`, undefined, {
      method: "DELETE",
    });
  }

  importPortfolioFile(id: string, input: PortfolioImportInput): Promise<PortfolioImportSummary> {
    return this.request<PortfolioImportSummary>(`/portfolios/${enc(id)}/imports`, undefined, {
      method: "POST",
      body: { content_base64: input.contentBase64, filename: input.filename },
    });
  }

  listPortfolioImports(id: string): Promise<PortfolioImportsResponse> {
    return this.request<PortfolioImportsResponse>(`/portfolios/${enc(id)}/imports`);
  }

  listPortfolioImportRows(
    id: string,
    importId: string,
    params?: { status?: "imported" | "ignored" | "duplicate" | "error"; limit?: number; offset?: number },
  ): Promise<PortfolioImportRowsResponse> {
    return this.request<PortfolioImportRowsResponse>(`/portfolios/${enc(id)}/imports/${enc(importId)}/rows`, {
      status: params?.status,
      limit: params?.limit,
      offset: params?.offset,
    });
  }

  getPortfolioImportTemplate(): Promise<string> {
    return this.requestText("/portfolios/import-template");
  }

  reconcilePortfolioAsset(id: string, asset: PortfolioAssetRef, targetQty: number, asOf: string): Promise<unknown> {
    return this.request<unknown>(`/portfolios/${enc(id)}/reconcile`, undefined, {
      method: "POST",
      body: { asset_type: asset.assetType, symbol: asset.symbol, target_qty: targetQty, as_of: asOf },
    });
  }
}

/** Segmento de path seguro (tickers/códigos vêm da UI/URL). */
function enc(segment: string): string {
  return encodeURIComponent(segment);
}
