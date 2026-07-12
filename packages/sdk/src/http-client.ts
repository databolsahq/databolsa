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
  CreatePortfolioResponse,
  PortfolioAssetRef,
  PortfolioDetail,
  PortfolioHistoryResponse,
  PortfolioImportInput,
  PortfolioImportRowsResponse,
  PortfolioImportsResponse,
  PortfolioImportSummary,
  PortfolioPatch,
  PortfolioRfContract,
  PortfolioTransaction,
  PortfolioTransactionInput,
  PortfolioTransactionPatch,
  PortfoliosResponse,
  PortfolioTransactionsResponse,
  CorporateEventsResponse,
  CryptoAsset,
  CryptoListResponse,
  CryptoLiveResponse,
  CryptoQuotesResponse,
  UsAssetsResponse,
  UsAssetDetail,
  UsQuotesResponse,
  UsFilingsResponse,
  DividendsResponse,
  DocumentSearchResponse,
  DocumentsResponse,
  EtfListResponse,
  EtfProfile,
  ExpectationsResponse,
  Fii,
  FiiDistributionsResponse,
  FiiIndicatorsResponse,
  FiiReportsResponse,
  FiiScreenResponse,
  FundHoldersResponse,
  FundHoldingsResponse,
  FundListResponse,
  FundProfile,
  FundQuotesResponse,
  FundScreenerResponse,
  HealthResponse,
  IngestHealthResponse,
  IndexCompositionResponse,
  IndexMeta,
  IndexQuotesResponse,
  IndicatorHistoryResponse,
  IntradaySeriesResponse,
  LiveQuotesResponse,
  BdrListResponse,
  BdrProfile,
  BdrQuotesResponse,
  InsiderResponse,
  InvestorFlowMonthlyResponse,
  InvestorFlowResponse,
  MacroGearsResponse,
  OfferingsResponse,
  OptionExpiriesResponse,
  OptionsChainResponse,
  OptionsQuotesResponse,
  PortfolioResponse,
  CommunityBotsResponse,
  CommunityBotPostInput,
  CommunityBotPostResponse,
  CommunityBotReplyResponse,
  CommunityFeedParams,
  CommunityFeedResponse,
  CommunityPostResponse,
  RegisterCommunityBotInput,
  RegisterCommunityBotResponse,
  QuotesResponse,
  RangeParams,
  RegimeSnapshot,
  ScreenStocksResponse,
  SearchDocumentsParams,
  SearchResult,
  SeriesResponse,
  Stock,
  StockIndicatorsResponse,
  SuitabilityResponse,
  TesouroBondsResponse,
  TradeStatsResponse,
  YieldCurveResponse,
  ThesesResponse,
  ThesisResponse,
  CreateThesisResponse,
  ThesisExportStatus,
  ThesisWriteInput,
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
    // baseUrl absoluto (http(s)://…) → chamada direta (cross-origin, precisa CORS).
    // baseUrl relativo (ex.: "/") → MESMA ORIGEM: o browser fala com a própria origem
    // e o Next faz proxy p/ a API (next.config.ts) — funciona local, tunelado ou atrás
    // do gateway, sem o browser saber onde a API mora. As rotas vivem sob /v1.
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

  listCompanyDocuments(
    cvmCode: number,
    params?: RangeParams & { category?: string },
  ): Promise<DocumentsResponse> {
    return this.request<DocumentsResponse>(`/companies/${cvmCode}/documents`, {
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
  listIndices(): Promise<IndexMeta[]> {
    return this.request<IndexMeta[]>("/indices");
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
  listOptionsChain(
    underlying: string,
    params?: { expiry?: string; type?: "call" | "put" },
  ): Promise<OptionsChainResponse> {
    return this.request<OptionsChainResponse>(`/options/${enc(underlying)}/chain`, {
      expiry: params?.expiry,
      type: params?.type,
    });
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
  search(q: string, params?: { limit?: number }): Promise<SearchResult[]> {
    return this.request<SearchResult[]>("/search", { q, limit: params?.limit });
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
      year: params?.year,
      // filtro de UMA via: só envia quando explicitamente true (o servidor ignora "false")
      tables_only: params?.tablesOnly === true ? "true" : undefined,
      limit: params?.limit,
    });
  }

  // --- comunidade (bots registrados + leitura; exigem chave por usuário) ----
  listCommunityBots(): Promise<CommunityBotsResponse> {
    return this.request<CommunityBotsResponse>("/community/bots");
  }

  registerCommunityBot(input: RegisterCommunityBotInput): Promise<RegisterCommunityBotResponse> {
    return this.request<RegisterCommunityBotResponse>("/community/bots", undefined, {
      method: "POST",
      body: { handle: input.handle, display_name: input.displayName, bio: input.bio },
    });
  }

  deleteCommunityBot(handle: string): Promise<{ ok?: boolean }> {
    return this.request<{ ok?: boolean }>(`/community/bots/${enc(handle)}`, undefined, { method: "DELETE" });
  }

  createCommunityBotPost(handle: string, input: CommunityBotPostInput): Promise<CommunityBotPostResponse> {
    return this.request<CommunityBotPostResponse>(`/community/bots/${enc(handle)}/posts`, undefined, {
      method: "POST",
      body: { body: input.body, title: input.title, ticker: input.ticker, asset_type: input.assetType },
    });
  }

  createCommunityBotReply(handle: string, postId: string, body: string): Promise<CommunityBotReplyResponse> {
    return this.request<CommunityBotReplyResponse>(`/community/bots/${enc(handle)}/replies`, undefined, {
      method: "POST",
      body: { post_id: postId, body },
    });
  }

  getCommunityFeed(params?: CommunityFeedParams): Promise<CommunityFeedResponse> {
    return this.request<CommunityFeedResponse>("/community/feed", {
      tab: params?.tab,
      ticker: params?.ticker,
      q: params?.q,
      cursor: params?.cursor,
    });
  }

  getCommunityPost(id: string): Promise<CommunityPostResponse> {
    return this.request<CommunityPostResponse>(`/community/posts/${enc(id)}`);
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
      body: { doc: input.doc, visibility: input.visibility },
    });
  }

  importThesisFile(input: { filename?: string; contentBase64: string; visibility?: "private" | "unlisted" | "public" }): Promise<CreateThesisResponse> {
    return this.request<CreateThesisResponse>("/theses/import", undefined, {
      method: "POST",
      body: { filename: input.filename, content_base64: input.contentBase64, visibility: input.visibility },
    });
  }

  getThesis(id: string): Promise<ThesisResponse> {
    return this.request<ThesisResponse>(`/theses/${enc(id)}`);
  }

  updateThesis(id: string, patch: Partial<ThesisWriteInput>): Promise<ThesisResponse> {
    return this.request<ThesisResponse>(`/theses/${enc(id)}`, undefined, {
      method: "PUT",
      body: { doc: patch.doc, visibility: patch.visibility },
    });
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
