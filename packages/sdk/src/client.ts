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
  IndexMeta,
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
  PortfolioImportInput,
  PortfolioImportRowsResponse,
  PortfolioImportSummary,
  PortfolioImportsResponse,
  PortfolioLookThroughResponse,
  PortfolioPatch,
  PortfolioResponse,
  PortfolioRfContract,
  PortfolioTransaction,
  PortfolioTransactionInput,
  PortfolioTransactionPatch,
  PortfolioTransactionsResponse,
  PortfolioXrayResponse,
  PortfoliosResponse,
  Query,
  QuotesResponse,
  RangeParams,
  RegimeSnapshot,
  ScreenStocksResponse,
  SearchDocumentsParams,
  SearchResponse,
  SearchResult,
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
  IssuerRiskResponse,
  MineralsResponse,
  MineralResponse,
  MineralProducersResponse,
  MineralObservationsResponse,
  IssuerProfileResponse,
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

/** Filtros do screener de ações — derivados de `GET /v1/screener/stocks`. */
export type ScreenStocksParams = Query<"screenStocks">;

/**
 * Filtros do listing de FIIs — derivados de `GET /v1/screener/fiis`, com uma
 * ergonomia: `paper` aceita `boolean` (o contrato pede `"true"`/`"false"`; o
 * HttpClient serializa). true = papel, false = tijolo, undefined = todos.
 */
export type ScreenFiisParams = Omit<Query<"screenFiis">, "paper"> & { paper?: boolean };

/** Filtros do screener de fundos — derivados de `GET /v1/screener/funds`. */
export type ScreenFundsParams = Query<"screenFunds">;

/**
 * Params do lote de cotações ao vivo — `GET /v1/quotes/live`, com uma ergonomia:
 * `tickers` aceita `string[]` (o contrato pede CSV; o HttpClient serializa). Forneça
 * exatamente um de `tickers` ou `index`.
 */
export type LiveQuotesParams = Omit<Query<"getLiveQuotes">, "tickers"> & { tickers?: string[] | string };

/**
 * Interface do cliente DataBolsa — métodos = operationIds do api/openapi.yaml.
 * O SDK público implementa esta interface com HttpClient; apps podem envolver
 * a interface com cache, hooks ou adaptadores próprios sem duplicar contrato.
 */
export interface DataBolsaClient {
  getHealth(): Promise<HealthResponse>;

  /** Saúde da ingestão: última run + saúde por fonte + histórico (data lake). */
  getIngestHealth(): Promise<IngestHealthResponse>;

  /** Lista/filtra ações por fundamentos (o universo real, não o preview). */
  screenStocks(params?: ScreenStocksParams): Promise<ScreenStocksResponse>;

  getStock(ticker: string): Promise<Stock>;
  listQuotes(
    ticker: string,
    params?: RangeParams & { adjusted?: boolean; limit?: number },
  ): Promise<QuotesResponse>;
  getStockIndicators(ticker: string, params?: { at?: string }): Promise<StockIndicatorsResponse>;
  getStockIndicatorHistory(ticker: string, name: string, params?: RangeParams): Promise<IndicatorHistoryResponse>;
  listDividends(ticker: string, params?: RangeParams): Promise<DividendsResponse>;
  listCorporateEvents(ticker: string, params?: RangeParams): Promise<CorporateEventsResponse>;
  /** `company` aceita ticker (BBAS3) OU código CVM numérico (1023) — os dois resolvem. */
  listCompanyDocuments(
    company: string | number,
    params?: RangeParams & { category?: string },
  ): Promise<DocumentsResponse>;
  /**
   * Saldo mensal de negociação de insiders (CVM VLMO). Série nível-COMPANHIA: todos os
   * tickers do emissor devolvem os MESMOS números, então somar PETR3 + PETR4 conta a mesma
   * movimentação duas vezes. `corporate_event_shares` vem separado e não soma a `net_shares`.
   */
  listInsiderMoves(ticker: string, params?: RangeParams): Promise<InsiderResponse>;
  /** Fundos de investimento que detêm o ativo (visão reversa do CDA/CVM), da competência mais recente por default. */
  listFundHolders(
    ticker: string,
    params?: { cursor?: string; limit?: number; date?: string },
  ): Promise<FundHoldersResponse>;
  /** VWAP oficial (TradAvrgPric) e nº de negócios por pregão, do consolidado B3. */
  listTradeStats(
    ticker: string,
    params?: RangeParams & { limit?: number; cursor?: string },
  ): Promise<TradeStatsResponse>;
  /**
   * "Quem está comprando" o papel, mês a mês: posição dos fundos (nível e delta) ao lado do
   * saldo de insiders. Antes de ler o delta como fluxo, confira `funds_delta_reason` — quando
   * ele vem preenchido o painel não é comparável e o número correto é a ausência.
   */
  listOwnershipFlow(
    ticker: string,
    params?: RangeParams & { cursor?: string; limit?: number },
  ): Promise<OwnershipFlowResponse>;
  /**
   * Quais fundos se mexeram no papel numa competência, um a um. `direction` filtra pelo sinal
   * da variação de quantidade (in = comprou, out = vendeu).
   */
  listOwnershipMovers(
    ticker: string,
    params?: { cursor?: string; limit?: number; date?: string; direction?: "in" | "out" | "all" },
  ): Promise<OwnershipMoversResponse>;

  // --- companhias abertas (cadastro + demonstrações) ---------------------------
  /** Catálogo de companhias abertas, filtrável por setor e segmento de listagem. */
  listCompanies(
    params?: { cursor?: string; limit?: number; sector?: string; segment?: string; search?: string },
  ): Promise<CompanyListResponse>;
  /** Cadastro de uma companhia. `company` aceita ticker (BBAS3) OU código CVM (1023). */
  getCompany(company: string | number): Promise<CompanyResponse>;
  /** Demonstrações financeiras da companhia. `company` aceita ticker OU código CVM. */
  listCompanyStatements(
    company: string | number,
    params?: RangeParams & { cursor?: string; limit?: number; scope?: string },
  ): Promise<StatementsResponse>;

  /** Lista o universo real de FIIs (não o preview). */
  screenFiis(params?: ScreenFiisParams): Promise<FiiScreenResponse>;
  getFii(ticker: string): Promise<Fii>;
  getFiiIndicators(ticker: string, params?: { at?: string }): Promise<FiiIndicatorsResponse>;
  /** Série mensal de um indicador de FII — mesmo shape do histórico de ações. */
  getFiiIndicatorHistory(ticker: string, name: string, params?: RangeParams): Promise<IndicatorHistoryResponse>;
  listFiiDistributions(ticker: string, params?: RangeParams): Promise<FiiDistributionsResponse>;
  listFiiReports(ticker: string, params?: RangeParams): Promise<FiiReportsResponse>;

  // --- ETFs ------------------------------------------------------------------
  /** Catálogo de ETFs listados na B3. */
  listEtfs(params?: { cursor?: string; limit?: number; search?: string; segment?: string }): Promise<EtfListResponse>;
  getEtf(ticker: string): Promise<EtfProfile>;

  // --- fundos de investimento (CVM 175) ---------------------------------------
  /** Ranqueia o universo de fundos por patrimônio, retorno ou nº de cotistas. */
  screenFunds(params?: ScreenFundsParams): Promise<FundScreenerResponse>;
  /** Catálogo de fundos de investimento (CVM 175). */
  listFunds(
    params?: { cursor?: string; limit?: number; search?: string; classificacao?: string },
  ): Promise<FundListResponse>;
  /** Perfil de um fundo pelo CNPJ da classe. */
  getFund(cnpj: string): Promise<FundProfile>;
  /** Série diária de cota/PL/fluxo de um fundo. */
  listFundQuotes(
    cnpj: string,
    params?: RangeParams & { limit?: number; cursor?: string },
  ): Promise<FundQuotesResponse>;
  /** Carteira (holdings) de um fundo — BLC_4 do CDA, competência mais recente por default. */
  listFundHoldings(
    cnpj: string,
    params?: { cursor?: string; limit?: number; date?: string },
  ): Promise<FundHoldingsResponse>;
  /** Em quais outros fundos este fundo investe (cotas declaradas na competência). */
  listInvestedFunds(
    cnpj: string,
    params?: { cursor?: string; limit?: number; date?: string },
  ): Promise<InvestedFundsResponse>;
  /** A visão reversa: quais fundos detêm cotas DESTE fundo. */
  listFundInvestors(
    cnpj: string,
    params?: { cursor?: string; limit?: number; date?: string },
  ): Promise<FundInvestorsResponse>;
  /**
   * Exposição do fundo a ativos listados somando a posição direta e a que chega através das
   * cotas que ele detém. O número é PISO, nunca total — `indirect_coverage_pct` diz quanto da
   * carteira em cotas foi possível abrir, e exposição baixa não significa exposição ausente.
   */
  listFundLookThrough(
    cnpj: string,
    params?: { cursor?: string; limit?: number; date?: string; ticker?: string },
  ): Promise<FundLookThroughResponse>;

  // --- fluxo de investidores (B3, BDM/BDI) ------------------------------------
  /** Fluxo diário por perfil de investidor (participação na B3). */
  listInvestorFlow(
    params?: RangeParams & { limit?: number; cursor?: string; investor_type?: string },
  ): Promise<InvestorFlowResponse>;
  /** Fechamento mensal por perfil de investidor × segmento de mercado. */
  listInvestorFlowMonthly(params?: {
    cursor?: string;
    limit?: number;
    month?: string;
    investor_type?: string;
    segment?: string;
  }): Promise<InvestorFlowMonthlyResponse>;

  // --- ofertas públicas (mercado primário, CVM) --------------------------------
  /** Ofertas públicas de distribuição (IPO/follow-on, debêntures, cotas de fundos). */
  listOfferings(
    params?: RangeParams & {
      cursor?: string;
      limit?: number;
      search?: string;
      regime?: "ICVM_400_476" | "RCVM_160";
      tipo_ativo?: string;
    },
  ): Promise<OfferingsResponse>;

  /** Ledger de eventos de mercado — o que foi relevante em cada dia. */
  listMarketEvents(params?: {
    date?: string;
    from?: string;
    to?: string;
    layer?: "estrutural" | "setorial" | "corporativa";
    category?: string;
    entity?: string;
    ticker?: string;
    thread?: string;
    cursor?: string;
    limit?: number;
  }): Promise<MarketEventsResponse>;
  getMarketEvent(id: number): Promise<MarketEvent>;
  getEventThread(slug: string): Promise<EventThread>;
  listMarketAnomalies(params?: {
    series?: "IBOV" | "IFIX" | "USDBRL" | "BRENT" | "VIX" | "SP500" | "NASDAQ";
    min_z?: number;
    from?: string;
    to?: string;
    cursor?: string;
    limit?: number;
  }): Promise<MarketAnomaliesResponse>;
  findSimilarMarketEvents(id: number, params?: { limit?: number }): Promise<SimilarMarketEventsResponse>;
  searchMarketEvents(q: string, params?: { limit?: number }): Promise<MarketEventSearchResponse>;

  listIndices(): Promise<IndexListResponse>;
  listIndexQuotes(code: string, params?: RangeParams & { limit?: number }): Promise<IndexQuotesResponse>;
  getIndexComposition(code: string): Promise<IndexCompositionResponse>;
  /** Série intradiária (delay 15 min) de um índice; default = sessão mais recente. */
  getIndexIntraday(code: string, params?: { session?: string }): Promise<IntradaySeriesResponse>;

  // --- cotações ao vivo (delay 15 min) ---------------------------------------
  /** Lote de cotações ao vivo por `tickers` (CSV/array, máx 200) OU `index` (constituintes). */
  getLiveQuotes(params: LiveQuotesParams): Promise<LiveQuotesResponse>;
  /** Série intradiária (delay 15 min) de uma ação; default = sessão mais recente. */
  getStockIntraday(ticker: string, params?: { session?: string }): Promise<IntradaySeriesResponse>;

  /** Catálogo de séries macro disponíveis (fonte + identificador para `getSeries`). */
  listSeries(
    params?: { cursor?: string; limit?: number; source?: string; search?: string },
  ): Promise<SeriesCatalogResponse>;
  getSeries(
    source: string,
    seriesId: string,
    params?: RangeParams & { accumulated?: "none" | "12m" | "ytd" },
  ): Promise<SeriesResponse>;
  getYieldCurve(params?: { kind?: "nominal" | "real" }): Promise<YieldCurveResponse>;
  listTesouroBonds(params?: {
    type?: string;
    maturity?: string;
    date?: string;
    limit?: number;
  }): Promise<TesouroBondsResponse>;
  /** Curvas de juros de mercado por vértice (DI e curvas de referência pré/IPCA+/implícita). */
  getBondCurves(params?: {
    kind?: "di" | "pre_ref" | "ipca_ref" | "implicita_ref";
    date?: string;
  }): Promise<BondCurveResponse>;
  /** Leilões primários da dívida pública federal (2000+), mais recente primeiro. */
  listTesouroAuctions(
    params?: { type?: string; cursor?: string; limit?: number } & RangeParams,
  ): Promise<TesouroAuctionsResponse>;

  // --- commodities (futuros da B3) -----------------------------------------
  /** Mercadorias com futuro na B3: boi gordo, milho, café, etanol, soja e ouro. */
  /**
   * Catálogo das commodities minerais com produção ou reservas publicadas: lítio, cobre,
   * nióbio, cobalto, terras raras, grafita, ferro, ouro, fosfato e outras. Ponto de partida
   * do domínio — descubra aqui o `mineral` que as demais operações recebem.
   */
  listMinerals(params?: {
    search?: string;
    critical?: boolean;
    group?: string;
    cursor?: string;
    limit?: number;
  }): Promise<MineralsResponse>;
  /** Ficha de um mineral: rótulo, período coberto, unidades e maior produtor. */
  getMineral(mineral: string): Promise<MineralResponse>;
  /**
   * Ranking de países por produção (ou reservas) de um mineral, com a participação de cada
   * um no total mundial. Responde "quem produz mais" e "qual a concentração".
   * `share_of_world_pct` vem NULO quando a participação não pode ser calculada, e
   * `share_basis` diz o motivo — nunca zero por ausência. `meta.countries_withheld` maior
   * que zero significa ranking incompleto: a fonte reteve o dado de algum país.
   */
  listMineralProducers(
    mineral: string,
    params?: { statistic?: "production" | "reserves"; year?: number; detail?: string },
  ): Promise<MineralProducersResponse>;
  /**
   * Observações em formato longo, para série temporal ou visão por país. Use
   * `country` com o código ISO3 para responder "o que este país produz" (ex.: BRA).
   */
  listMineralObservations(params?: {
    mineral?: string;
    country?: string;
    statistic?: "production" | "reserves";
    year?: number;
    from?: number;
    to?: number;
    include_world_total?: boolean;
    cursor?: string;
    limit?: number;
  }): Promise<MineralObservationsResponse>;
  listCommodities(): Promise<CommoditiesResponse>;
  /**
   * Curva de ajuste de um pregão, um ponto por vencimento. O vencimento mais curto
   * NÃO é preço à vista — é base futura.
   */
  getCommodityCurve(
    commodity: string,
    params?: { date?: string },
  ): Promise<CommodityCurveResponse>;
  /**
   * Série de ajuste diário. Filtre por `contract` para série comparável no tempo —
   * sem isso a mesma data traz vários vencimentos.
   */
  listCommoditySettlements(
    commodity: string,
    params?: { contract?: string; cursor?: string; limit?: number } & RangeParams,
  ): Promise<CommoditySettlementsResponse>;

  // --- crédito privado (debêntures, balcão, risco de emissor) ---------------
  /** Catálogo de debêntures (vivas e vencidas), com indexação as-filed e último negócio. */
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
  }): Promise<DebenturesResponse>;
  getDebenture(code: string): Promise<DebentureResponse>;
  /** Secundário de uma debênture por pregão (PU e % da curva), desde 2013. */
  listDebentureQuotes(
    code: string,
    params?: { cursor?: string; limit?: number } & RangeParams,
  ): Promise<DebentureQuotesResponse>;
  /** Secundário de balcão por família de instrumento (CDB, CRI, CRA, LCI, LCA…). */
  listOtcQuotes(
    params: { family: string; date?: string; cursor?: string; limit?: number } & RangeParams,
  ): Promise<CreditOtcQuotesResponse>;
  /**
   * Catálogo de COE do registro de balcão: emissor, tamanho da emissão, prazo e liquidez
   * secundária. Superfície separada de `credit` de propósito — COE é payoff de derivativo
   * embrulhado no risco do banco emissor, não papel de crédito com retorno contratado.
   *
   * NÃO responde quanto o COE rende: estrutura, proteção de capital, subjacente e cenários
   * vivem no DIE, que não é dado estruturado público. `indexer` é campo do REGISTRO ("SEM
   * REMUNERACAO" é comum) e não descreve o retorno do investidor.
   *
   * Os campos de secundário vêm null na quase totalidade dos papéis — é o dado (COE é
   * carregado até o vencimento), não lacuna. `tradedOnly` isola os que tiveram mercado.
   */
  listCoes(params?: {
    issuer?: string;
    maturityFrom?: string;
    maturityTo?: string;
    minIssueSize?: number;
    tradedOnly?: boolean;
    cursor?: string;
    limit?: number;
  }): Promise<CoeListResponse>;
  /** Detalhe de um COE pelo código do instrumento no balcão (não o ISIN nem o nome comercial). */
  getCoe(code: string): Promise<CoeResponse>;
  /**
   * Classes de FIDC numa competência. Superfície própria porque a cota de FIDC é marcada a
   * LAUDO e não passa pelo informe diário — o fundo não aparece nas séries de `/funds`.
   * A chave é a CLASSE: um fundo multiclasse tem um CNPJ por classe. As duas séries de
   * inadimplência (`*_with_risk` e `*_no_risk`) NÃO se somam.
   */
  listFidcs(params?: {
    q?: string;
    cnpj?: string;
    date?: string;
    minNetWorth?: number;
    cursor?: string;
    limit?: number;
  }): Promise<FidcListResponse>;
  /** Série mensal de uma classe. `entity_kind` null marca a era anterior a 2020-11. */
  listFidcHistory(
    cnpj: string,
    params?: { from?: string; to?: string; cursor?: string; limit?: number },
  ): Promise<FidcHistoryResponse>;
  /** Séries de cota (sênior/mezanino/subordinada) — instrumentos distintos, nunca consolidados. */
  listFidcSeries(cnpj: string, params?: { date?: string }): Promise<FidcSeriesResponse>;
  /** Aging por faixa. Somar `risk_retained` true e false conta o mesmo fundo duas vezes. */
  listFidcDelinquency(cnpj: string, params?: { date?: string }): Promise<FidcDelinquencyResponse>;
  /** Mix SCR (Res. CMN 2.682). NÃO é rating de agência — este vive em listCreditRatings. */
  listFidcScr(cnpj: string, params?: { date?: string }): Promise<FidcScrResponse>;
  /**
   * Raio-X de CUSTOS da carteira: quanto ela paga por ano, para quem, e o que está acima
   * da referência. Só custo RECORRENTE observável no dado público — taxa efetiva de fundo
   * e de FII, custódia do Tesouro na B3 e gap de RF bancária abaixo de 100% do CDI.
   * O que não é observável NÃO vira número: vai para `not_estimated` com o motivo.
   * Não inclui corretagem, IR/IOF nem spread de compra. Nenhuma linha é recomendação.
   */
  getPortfolioCosts(id: string): Promise<PortfolioCostsResponse>;
  /** Solidez trimestral do emissor bancário (Basileia, PR, carteira) pela raiz do CNPJ. */
  getIssuerRisk(cnpj: string): Promise<IssuerRiskResponse>;
  /**
   * Perfil do emissor (CNPJ completo, 14 dígitos). Use quando getIssuerRisk devolver 404:
   * `kind` diz se o emissor é corporativo — caso em que a solidez prudencial do BCB não
   * existe por definição, e não por falta de dado.
   */
  getIssuerProfile(cnpj: string): Promise<IssuerProfileResponse>;
  /**
   * Rating vigente por (agência, papel), lido de documento protocolado em órgão público.
   * Toda linha carrega `agency`, `action_date` e `download_url` — a citação é parte do
   * dado. `rating_notch` (1 = melhor) só compara DENTRO da mesma `scale`: um emissor
   * brasileiro costuma ser AAA nacional e BB global ao mesmo tempo. Papel ausente
   * significa que ainda não lemos documento dele, nunca "sem rating".
   */
  listCreditRatings(params?: {
    assetCode?: string;
    issuerCnpj?: string;
    agency?: string;
    entityType?: string;
    scale?: CreditRatingScale;
    confidence?: "high" | "medium" | "low";
    cursor?: string;
    limit?: number;
  }): Promise<CreditRatingsResponse>;
  /**
   * Histórico append-only das ações de rating de UM papel (ISIN) ou emissor (CNPJ) —
   * um dos dois é obrigatório. `superseded_by` marca a linha corrigida: correção cria
   * linha nova em vez de editar o fato.
   */
  listCreditRatingHistory(params: {
    assetCode?: string;
    issuerCnpj?: string;
    agency?: string;
  }): Promise<CreditRatingHistoryResponse>;
  /**
   * Curva de crédito observada no secundário de debêntures: spread mediano por bucket de
   * prazo (janela de 21 pregões). Spread é o DA EMISSÃO (as-filed, mix de safras); o
   * reapreçamento está em `pct_of_curve_median` (<100 = deságio).
   */
  getCreditCurve(params?: {
    indexer?: "DI" | "IPCA";
    date?: string;
  }): Promise<CreditCurveResponse>;
  /** Screener de debêntures: indexação, spread, vencimento, liquidez e demanda de fundos. */
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
  }): Promise<DebentureScreenerResponse>;
  /** Fundos que detêm a debênture na carteira mensal mais recente (ou na competência `date`). */
  listDebentureHolders(
    code: string,
    params?: { date?: string; cursor?: string; limit?: number },
  ): Promise<DebentureHoldersResponse>;
  /** Série mensal da demanda institucional pela debênture (holders, valor e fluxo declarado). */
  listDebentureDemand(
    code: string,
    params?: { cursor?: string; limit?: number },
  ): Promise<DebentureDemandResponse>;
  /** Benchmarks de renda fixa (IMA/IRF; nível, retorno e duration, 2002+). */
  listBenchmarkIndices(
    params?: { code?: string; cursor?: string; limit?: number } & RangeParams,
  ): Promise<BenchmarkIndicesResponse>;
  getMarketExpectations(
    indicator: "ipca" | "selic" | "pib" | "cambio",
    params?: { reference?: string } & RangeParams,
  ): Promise<ExpectationsResponse>;
  getMacroRegime(params?: { at?: string }): Promise<RegimeSnapshot>;
  getMacroGears(params?: { gear?: string }): Promise<MacroGearsResponse>;

  // --- cripto (catálogo + velas diárias em BRL + snapshot quase-live) ---
  /** Catálogo de criptoativos (paginado; busca por símbolo/nome). */
  listCrypto(params?: { search?: string; limit?: number; cursor?: string }): Promise<CryptoListResponse>;
  getCrypto(symbol: string): Promise<CryptoAsset>;
  /** Snapshot quase-live (~1 min, 24/7) de todo o universo de cripto. */
  listCryptoLive(): Promise<CryptoLiveResponse>;
  listCryptoQuotes(
    symbol: string,
    params?: RangeParams & { interval?: "1d" | "1h"; limit?: number },
  ): Promise<CryptoQuotesResponse>;

  // --- ativos dos EUA (EOD em USD + fundamentos e filings SEC) ---
  /** Catálogo de ativos dos EUA (paginado; filtra por tipo, busca por ticker/nome). */
  listUsAssets(params?: {
    search?: string;
    type?: "stock" | "etf";
    bdr?: string;
    limit?: number;
    cursor?: string;
  }): Promise<UsAssetsResponse>;
  /** Perfil de um ativo dos EUA com fundamentos SEC inline. */
  getUsAsset(ticker: string): Promise<UsAssetDetail>;
  /** Cotações EOD em USD (ajustadas por desdobramento na fonte). */
  listUsAssetQuotes(
    ticker: string,
    params?: RangeParams & { limit?: number; cursor?: string },
  ): Promise<UsQuotesResponse>;
  /** Filings SEC (10-K/10-Q/8-K…) com link do documento no EDGAR. */
  listUsFilings(
    ticker: string,
    params?: { form?: string; limit?: number; cursor?: string },
  ): Promise<UsFilingsResponse>;

  // --- opções (chain viva + greeks europeus/americanos; histórico por série) ---
  /** Cadeia viva de um subjacente (séries não vencidas, mais negociadas). Filtra por vencimento/tipo. */
  getOptionsChain(
    underlying: string,
    params?: { expiry?: string; type?: "call" | "put" },
  ): Promise<OptionsChainResponse>;
  /** @deprecated use `getOptionsChain`, que é o nome da operação no contrato. */
  listOptionsChain(
    underlying: string,
    params?: { expiry?: string; type?: "call" | "put" },
  ): Promise<OptionsChainResponse>;
  /** Vencimentos distintos disponíveis para um subjacente (com contagem de séries). */
  listOptionExpiries(underlying: string): Promise<OptionExpiriesResponse>;
  /** Histórico EOD de UMA série de opção (paginado; só europeu). */
  listOptionQuotes(
    optionTicker: string,
    params?: RangeParams & { limit?: number; cursor?: string },
  ): Promise<OptionsQuotesResponse>;

  // --- BDRs (catálogo + cotações em BRL; dolarização via USD/BRL no client) ---
  /** Catálogo de BDRs (paginado; busca por ticker/nome). */
  listBdrs(params?: { search?: string; limit?: number; cursor?: string }): Promise<BdrListResponse>;
  getBdr(ticker: string): Promise<BdrProfile>;
  /** Histórico EOD de um BDR em BRL (paginado). */
  listBdrQuotes(
    ticker: string,
    params?: RangeParams & { limit?: number; cursor?: string },
  ): Promise<BdrQuotesResponse>;

  /** Busca unificada (ações, FIIs, índices, títulos, séries macro) — backed o Cmd+K. */
  search(q: string, params?: { limit?: number }): Promise<SearchResponse>;

  // --- carteira / perfil / documentos (exigem chave por usuário; /conta) --------
  /**
   * Sua carteira consolidada: patrimônio, posições, preço médio, P&L, alocação.
   * Escopada ao dono da chave de API (a mesma da conta) — passe sua chave por usuário.
   */
  getPortfolio(): Promise<PortfolioResponse>;
  /** Histórico mensal consolidado da carteira (patrimônio × aporte × proventos × realizado). */
  getPortfolioHistory(): Promise<PortfolioHistoryResponse>;
  /** Seu perfil de investidor (suitability). `profile` é nulo se ainda não definido. */
  getSuitability(): Promise<SuitabilityResponse>;

  // --- gestão de carteira (escrevem na SUA carteira real; exigem chave por usuário) ---
  /** Lista as suas carteiras (id, nome, nº de ativos). */
  listPortfolios(): Promise<PortfoliosResponse>;
  /** Cria uma carteira. O número de carteiras depende do plano (erro 402 no teto). */
  createPortfolio(name: string, visibility?: "private" | "unlisted" | "public"): Promise<CreatePortfolioResponse>;
  /** Uma carteira computada: posições, preço médio, P&L, alocação. */
  getPortfolioDetail(id: string): Promise<PortfolioDetail>;
  /** Raio-X da carteira: concentração, sobreposição e exposição por classe e ativo. */
  getPortfolioXray(id: string): Promise<PortfolioXrayResponse>;
  /**
   * Exposição TRANSPARENTE da carteira: abre os fundos e FIIs em posição e soma o que a
   * carteira detém indiretamente ao que ela detém direto. Profundidade 1 — carteira
   * declarada do fundo, não do fundo do fundo — e `indirect_coverage_pct` diz quanto do
   * PL aberto foi de fato reconciliado.
   */
  getPortfolioLookThrough(id: string): Promise<PortfolioLookThroughResponse>;
  /** Renomeia, muda visibilidade e/ou marca como simulação. */
  updatePortfolio(id: string, patch: PortfolioPatch): Promise<unknown>;
  /** APAGA a carteira com todos os ativos e transações (irreversível). */
  deletePortfolio(id: string): Promise<{ deleted?: boolean }>;

  // --- teses de investimento (documentos de research; exigem chave por usuário) ---
  /** Lista as suas teses (resumo + limite do plano). */
  listMyTheses(): Promise<ThesesResponse>;
  /** Cria uma tese a partir do markdown (compilado no servidor; 402 no teto do plano). */
  createThesis(input: ThesisWriteInput): Promise<CreateThesisResponse>;
  /** Cria uma tese enviando o arquivo (.md ou JSON do doc) em base64 — caminho do CLI `--file`. */
  importThesisFile(input: { filename?: string; contentBase64: string; visibility?: "private" | "unlisted" | "public" }): Promise<CreateThesisResponse>;
  /** Markdown + status do export. `include: "doc"` acrescenta o ReportDoc compilado. */
  getThesis(id: string, opts?: { include?: "doc" }): Promise<ThesisResponse>;
  /** Substitui o markdown INTEIRO e/ou muda visibilidade, arquivamento e tags privadas. */
  updateThesis(id: string, patch: Partial<ThesisWriteInput>): Promise<ThesisResponse>;
  /** Troca UM trecho do markdown — `oldText` tem de ser único no documento. */
  editThesis(id: string, edit: { oldText: string; newText: string }): Promise<ThesisResponse>;
  /** Define a ordem manual da vitrine (perfil + gerenciador): `ids` na ordem desejada. */
  reorderTheses(ids: string[]): Promise<{ ok?: boolean }>;
  /** APAGA a tese (irreversível). */
  deleteThesis(id: string): Promise<{ deleted?: boolean }>;
  /** Muda a visibilidade (public aparece no perfil; o doc publicado vai inteiro). */
  publishThesis(id: string, visibility: "private" | "unlisted" | "public"): Promise<ThesisResponse>;
  /** Exporta em PDF (plano pago): 202 queued ou 200 ready com o link. */
  exportThesis(id: string): Promise<ThesisExportStatus>;
  /** Histórico mensal de UMA carteira. */
  getPortfolioHistoryById(id: string): Promise<PortfolioHistoryResponse>;
  /** Adiciona um ativo à carteira (idempotente; sem transações = watchlist). */
  addPortfolioAsset(id: string, asset: PortfolioAssetRef): Promise<unknown>;
  /** Remove um ativo da carteira, APAGANDO o ledger dele nela (irreversível). */
  removePortfolioAsset(id: string, asset: PortfolioAssetRef): Promise<unknown>;
  /** Define a taxa contratada de uma posição de renda fixa (indexer "none" limpa). */
  updatePortfolioAsset(id: string, asset: PortfolioAssetRef, rf: PortfolioRfContract): Promise<unknown>;
  /** Ledger (transações) de um ativo da carteira. */
  listPortfolioTransactions(id: string, asset: PortfolioAssetRef): Promise<PortfolioTransactionsResponse>;
  /** Lança uma transação; o ativo é adicionado automaticamente se preciso. */
  addPortfolioTransaction(
    id: string,
    asset: PortfolioAssetRef,
    tx: PortfolioTransactionInput,
  ): Promise<AddPortfolioTransactionResponse>;
  /** Edita uma transação (patch parcial). */
  updatePortfolioTransaction(id: string, txId: string, patch: PortfolioTransactionPatch): Promise<PortfolioTransaction>;
  /** Remove uma transação do ledger (irreversível). */
  deletePortfolioTransaction(id: string, txId: string): Promise<{ deleted?: boolean }>;
  /**
   * Importa uma planilha (Negociação/Movimentação da B3 em .xlsx, ou o template
   * manual em .csv/.xlsx) para a carteira. Idempotente: reenviar o mesmo arquivo
   * não duplica lançamentos. Retorna o resumo (importadas/duplicadas/avisos).
   */
  importPortfolioFile(id: string, input: PortfolioImportInput): Promise<PortfolioImportSummary>;
  /** Histórico de imports da carteira. */
  listPortfolioImports(id: string): Promise<PortfolioImportsResponse>;
  /** Linhas de um import, com status (imported/ignored/duplicate/error) e motivo. */
  listPortfolioImportRows(
    id: string,
    importId: string,
    params?: { status?: "imported" | "ignored" | "duplicate" | "error"; limit?: number; offset?: number },
  ): Promise<PortfolioImportRowsResponse>;
  /** Template CSV do import manual (texto). */
  getPortfolioImportTemplate(): Promise<string>;
  /** Reconcilia a posição de um ativo à quantidade declarada pela B3 (ajuste idempotente). */
  reconcilePortfolioAsset(
    id: string,
    asset: PortfolioAssetRef,
    targetQty: number,
    asOf: string,
  ): Promise<unknown>;
  /**
   * Busca semântica no texto de documentos CVM/B3 (fatos relevantes, releases,
   * balanços, relatórios de FII, atas). Filtre por papel/categoria/ano quando souber.
   */
  searchDocuments(q: string, params?: SearchDocumentsParams): Promise<DocumentSearchResponse>;
  /** Categorias, subtipos e cobertura disponíveis para filtrar documentos. */
  getDocumentTaxonomy(): Promise<DocumentTaxonomy>;
}

export class NotInPreviewError extends Error {
  constructor(public readonly entity: string) {
    super(`"${entity}" não está disponível na API DataBolsa atual.`);
    this.name = "NotInPreviewError";
  }
}
