import type { components, operations } from "./schema";

/** Corpo JSON da resposta 200 de uma operação do contrato. */
export type Ok<Op extends keyof operations> = operations[Op] extends {
  responses: { 200: { content: { "application/json": infer T } } };
}
  ? T
  : never;

/** Parâmetros de query de uma operação do contrato (sem o `| undefined`). */
export type Query<Op extends keyof operations> = operations[Op] extends {
  parameters: { query?: infer Q };
}
  ? NonNullable<Q>
  : never;

export type Schemas = components["schemas"];

// --- objetos de domínio (schemas do contrato) -----------------------------
export type Lineage = Schemas["Lineage"];
export type Company = Schemas["Company"];
export type Stock = Schemas["Stock"];
export type Quote = Schemas["Quote"];
export type IndicatorValue = Schemas["IndicatorValue"];
export type Observation = Schemas["Observation"];
export type Document = Schemas["Document"];
export type Dividend = Schemas["Dividend"];
export type CorporateEvent = Schemas["CorporateEvent"];
export type Fii = Schemas["Fii"];
export type FiiDistribution = Schemas["FiiDistribution"];
export type FiiMonthlyReport = Schemas["FiiMonthlyReport"];
export type FiiListRow = Schemas["FiiListRow"];
export type SeriesMeta = Schemas["SeriesMeta"];
export type TesouroBondQuote = Schemas["TesouroBondQuote"];
export type IndexMeta = Schemas["IndexMeta"];
export type Expectation = Schemas["Expectation"];
export type RegimeSnapshot = Schemas["RegimeSnapshot"];
export type RegimeSignal = Schemas["RegimeSignal"];
export type ScreenerRow = Schemas["ScreenerRow"];
export type CryptoCandle = Schemas["CryptoCandle"];
export type SearchResult = Schemas["SearchResult"];
export type InsiderMove = Schemas["InsiderMove"];
export type OptionContract = Schemas["OptionContract"];
export type OptionExpiry = Schemas["OptionExpiry"];
export type OptionQuote = Schemas["OptionQuote"];
export type BdrProfile = Schemas["BdrProfile"];
export type BdrQuote = Schemas["BdrQuote"];
export type IngestSourceStatus = Schemas["IngestSourceHealth"]["status"];
export type IngestSourceHealth = Schemas["IngestSourceHealth"];
export type IngestRunSummary = Schemas["IngestRunSummary"];
export type EtfProfile = Schemas["EtfProfile"];
export type FundProfile = Schemas["FundProfile"];
export type FundQuote = Schemas["FundQuote"];
export type FundHolding = Schemas["FundHolding"];
export type FundOwnershipSummary = Schemas["FundOwnershipSummary"];
export type FundScreenerItem = Schemas["FundScreenerItem"];
export type TradeStat = Schemas["TradeStat"];
export type InvestorFlow = Schemas["InvestorFlow"];
export type InvestorFlowMonthly = Schemas["InvestorFlowMonthly"];
export type PublicOffering = Schemas["PublicOffering"];
export type LiveQuote = Schemas["LiveQuote"];
export type IntradayPoint = Schemas["IntradayPoint"];
// --- carteira / perfil / documentos (servidos sob /v1, exigem chave por usuário) ---
export type PortfolioContext = Schemas["PortfolioContext"];
export type PortfolioHolding = Schemas["PortfolioHolding"];
export type SuitabilityProfile = Schemas["SuitabilityProfile"];
export type DocumentChunk = Schemas["DocumentChunk"];

// --- respostas (corpo 200 de cada operação) -------------------------------
export type HealthResponse = Ok<"getHealth">;
export type IngestHealthResponse = Ok<"getIngestHealth">;
export type ScreenStocksResponse = Ok<"screenStocks">;
export type FiiScreenResponse = Ok<"screenFiis">;
export type QuotesResponse = Ok<"listQuotes">;
export type StockIndicatorsResponse = Ok<"getStockIndicators">;
export type IndicatorHistoryResponse = Ok<"getStockIndicatorHistory">;
export type DividendsResponse = Ok<"listDividends">;
export type CorporateEventsResponse = Ok<"listCorporateEvents">;

// Superfície de objeto — o grafo de identidade.
export type ObjectResolveResponse = Ok<"resolveObject">;
export type ObjectResponse = Ok<"getObject">;
export type ObjectLinksResponse = Ok<"listObjectLinks">;
export type ObjectLinkHistoryResponse = Ok<"getObjectLinkHistory">;
export type ObjectEvidenceResponse = Ok<"getObjectEvidence">;
export type GlobalLinksResponse = Ok<"listGlobalLinks">;
export type ObjectLinkStats = Ok<"getObjectLinkStats">;
export type ObjectCensus = Ok<"getObjectCensus">;
export type ObjectRelationsResponse = Ok<"listObjectRelations">;
export type ObjectIntersectResponse = Ok<"intersectObjects">;
export type ObjectPathResponse = Ok<"traverseObjectPath">;
export type ObjectPathsFoundResponse = Ok<"findObjectPaths">;
export type ObjectFactsResponse = Ok<"getObjectFacts">;
export type ObjectPropertiesResponse = Ok<"getObjectProperties">;
export type ObjectHistoryResponse = Ok<"getObjectHistory">;
export type FactCatalogResponse = Ok<"listFactCatalog">;

export type ObjectRankResponse = Ok<"rankObjects">;
export type ObjectAggregateResponse = Ok<"aggregateObjects">;
export type ObjectEventsResponse = Ok<"getObjectEvents">;
export type TradingStatusResponse = Ok<"listTradingStatus">;
export type CorporateSuccessionsResponse = Ok<"listCorporateSuccessions">;
export type DocumentsResponse = Ok<"listCompanyDocuments">;
export type InsiderResponse = Ok<"listInsiderMoves">;
export type FiiIndicatorsResponse = Ok<"getFiiIndicators">;
export type FiiDistributionsResponse = Ok<"listFiiDistributions">;
export type FiiReportsResponse = Ok<"listFiiReports">;
export type SeriesResponse = Ok<"getSeries">;
export type IndexQuotesResponse = Ok<"listIndexQuotes">;
export type IndexListResponse = Ok<"listIndices">;
export type IndexCompositionResponse = Ok<"getIndexComposition">;
export type YieldCurveResponse = Ok<"getYieldCurve">;
export type TesouroBondsResponse = Ok<"listTesouroBonds">;
export type BondCurveResponse = Ok<"getBondCurves">;
export type TesouroAuctionsResponse = Ok<"listTesouroAuctions">;

// --- commodities (futuros da B3: boi, milho, café, etanol, soja, ouro) -------
export type CommoditiesResponse = Ok<"listCommodities">;
export type CommodityCurveResponse = Ok<"getCommodityCurve">;
export type CommoditySettlementsResponse = Ok<"listCommoditySettlements">;
export type DebenturesResponse = Ok<"listDebentures">;
export type DebentureResponse = Ok<"getDebenture">;
export type DebentureQuotesResponse = Ok<"listDebentureQuotes">;
export type CreditOtcQuotesResponse = Ok<"listOtcQuotes">;
export type IssuerRiskResponse = Ok<"getIssuerRisk">;
export type IssuerProfileResponse = Ok<"getIssuerProfile">;
export type CreditRatingsResponse = Ok<"listCreditRatings">;
export type CreditRatingHistoryResponse = Ok<"listCreditRatingHistory">;
export type CreditRatingAction = Schemas["CreditRatingAction"];
/** 'national_br' e 'global' NUNCA compartilham eixo de comparação. */
export type CreditRatingScale = CreditRatingAction["scale"];
export type FidcListResponse = Ok<"listFidcs">;
export type FidcHistoryResponse = Ok<"listFidcHistory">;
export type FidcSeriesResponse = Ok<"listFidcSeries">;
export type FidcRegulationTerms = Ok<"getFidcRegulationTerms">;
export type FidcDelinquencyResponse = Ok<"listFidcDelinquency">;
export type FidcScrResponse = Ok<"listFidcScr">;
export type FidcSecondaryResponse = Ok<"listFidcQuotes">;
export type FidcSectorResponse = Ok<"listFidcSectors">;
export type FidcOriginatorResponse = Ok<"listFidcOriginators">;
/** O inverso: as classes que declararam um CNPJ como cedente. */
export type FidcOriginatorExposureResponse = Ok<"listFidcOriginatorExposure">;
export type FidcFlowResponse = Ok<"listFidcFlows">;
export type FidcInvestorResponse = Ok<"listFidcInvestors">;
export type FidcPerformanceResponse = Ok<"listFidcPerformance">;
export type FidcReturnResponse = Ok<"listFidcReturns">;
export type OriginatorProfile = Ok<"getOriginatorProfile">;
export type FidcPortfolioOpsResponse = Ok<"listFidcPortfolioOps">;
export type FidcPricingResponse = Ok<"listFidcPricing">;
export type PortfolioCostsResponse = Ok<"getPortfolioCosts">;

// --- estruturados: COE ------------------------------------------------------
// Fora de Credit de propósito: COE é payoff de derivativo sobre o risco do banco
// emissor, não papel de crédito com retorno contratado.
export type CoeListResponse = Ok<"listCoes">;
export type CoeResponse = Ok<"getCoe">;

// --- crédito: screener de debêntures + look-through de fundos ---------------
export type DebentureScreenerRow = Schemas["DebentureScreenerRow"];
export type DebentureHolder = Schemas["DebentureHolder"];
export type DebentureDemandPoint = Schemas["DebentureDemandPoint"];
export type DebentureScreenerResponse = Ok<"screenDebentures">;
export type DebentureHoldersResponse = Ok<"listDebentureHolders">;
export type DebentureDemandResponse = Ok<"listDebentureDemand">;

// --- crédito: curva de spread observada no secundário de debêntures ----------
export type CreditCurvePoint = Schemas["CreditCurvePoint"];
export type CreditCurveResponse = Ok<"getCreditCurve">;
export type BenchmarkIndicesResponse = Ok<"listBenchmarkIndices">;
export type ExpectationsResponse = Ok<"getMarketExpectations">;
export type MacroGearsResponse = Ok<"getMacroGears">;
export type CryptoQuotesResponse = Ok<"listCryptoQuotes">;
export type CryptoListResponse = Ok<"listCrypto">;
export type CryptoAsset = Ok<"getCrypto">;
export type CryptoLiveResponse = Ok<"listCryptoLive">;
export type UsAssetsResponse = Ok<"listUsAssets">;
export type UsAssetDetail = Ok<"getUsAsset">;
export type UsQuotesResponse = Ok<"listUsAssetQuotes">;
export type UsFilingsResponse = Ok<"listUsFilings">;
export type SearchResponse = Ok<"search">;
export type OptionsChainResponse = Ok<"getOptionsChain">;
export type OptionExpiriesResponse = Ok<"listOptionExpiries">;
export type OptionsQuotesResponse = Ok<"listOptionQuotes">;
export type BdrListResponse = Ok<"listBdrs">;
export type BdrQuotesResponse = Ok<"listBdrQuotes">;
export type EtfListResponse = Ok<"listEtfs">;
export type FundListResponse = Ok<"listFunds">;
export type FundManagersResponse = Ok<"listFundManagers">;
export type FundQuotesResponse = Ok<"listFundQuotes">;
export type FundHoldingsResponse = Ok<"listFundHoldings">;
/**
 * Crédito privado na carteira do fundo (BLC_6/BLC_8 do CDA), o par de `listFundHoldings`
 * para o que não tem código de negociação. Leia `match_level` junto: o CDA não publica ISIN
 * nesses blocos, então filtrar por `isin` devolve um PISO, nunca o total.
 */
export type FundCreditHoldingsResponse = Ok<"listFundCreditHoldings">;
/** A visão inversa: quais fundos declaram posição num CRI/CRA/debênture, por ISIN. */
export type CreditFundHoldersResponse = Ok<"listCreditFundHolders">;
export type FundHoldersResponse = Ok<"listFundHolders">;
export type FundScreenerResponse = Ok<"screenFunds">;
export type CompanyListResponse = Ok<"listCompanies">;
export type CompanyResponse = Ok<"getCompany">;
export type StatementsResponse = Ok<"listCompanyStatements">;
export type SeriesCatalogResponse = Ok<"listSeries">;
/** Demanda por papel (fundos + insider no mesmo eixo mensal). */
export type OwnershipFlowResponse = Ok<"listOwnershipFlow">;
/** Quem se mexeu no papel, fundo a fundo, numa competência. */
export type OwnershipMoversResponse = Ok<"listOwnershipMovers">;
export type InvestedFundsResponse = Ok<"listInvestedFunds">;
export type FundInvestorsResponse = Ok<"listFundInvestors">;
export type FundLookThroughResponse = Ok<"listFundLookThrough">;
export type TradeStatsResponse = Ok<"listTradeStats">;
export type InvestorFlowResponse = Ok<"listInvestorFlow">;
export type InvestorFlowMonthlyResponse = Ok<"listInvestorFlowMonthly">;
export type OfferingsResponse = Ok<"listOfferings">;
export type MarketEventsResponse = Ok<"listMarketEvents">;
export type MarketEvent = Ok<"getMarketEvent">;
export type EventThread = Ok<"getEventThread">;
export type MarketAnomaliesResponse = Ok<"listMarketAnomalies">;
export type SimilarMarketEventsResponse = Ok<"findSimilarMarketEvents">;
export type MarketEventSearchResponse = Ok<"searchMarketEvents">;
export type LiveQuotesResponse = Ok<"getLiveQuotes">;
export type IntradaySeriesResponse = Ok<"getStockIntraday">;
export type PortfolioResponse = Ok<"getPortfolio">;
export type SuitabilityResponse = Ok<"getSuitability">;
export type DocumentSearchResponse = Ok<"searchDocuments">;
export type DocumentReadResponse = Ok<"readDocument">;
export type DocumentTaxonomy = Ok<"getDocumentTaxonomy">;

/** Corpo JSON da resposta 201 (criação) de uma operação do contrato. */
export type Created<Op extends keyof operations> = operations[Op] extends {
  responses: { 201: { content: { "application/json": infer T } } };
}
  ? T
  : never;

// --- gestão de carteira (escrita; exigem chave por usuário) --------------------
export type PortfolioListItem = Schemas["PortfolioListItem"];
export type PortfolioDetail = Schemas["PortfolioDetail"];
export type PortfolioTransaction = Schemas["PortfolioTransaction"];
export type PortfolioHistoryResponse = Ok<"getPortfolioHistory">;
/** Concentração da carteira por classe, setor, indexador e moeda. */
export type PortfolioXrayResponse = Ok<"getPortfolioXray">;
/** Exposição efetiva: abre as posições em fundos nos ativos que eles detêm. */
export type PortfolioLookThroughResponse = Ok<"getPortfolioLookThrough">;
export type PortfoliosResponse = Ok<"listPortfolios">;
export type PortfolioTransactionsResponse = Ok<"listPortfolioTransactions">;
export type PortfolioImportsResponse = Ok<"listPortfolioImports">;
export type PortfolioImportRowsResponse = Ok<"listPortfolioImportRows">;
export type CreatePortfolioResponse = Created<"createPortfolio">;
export type AddPortfolioTransactionResponse = Created<"addPortfolioTransaction">;
export type PortfolioImportSummary = Schemas["PortfolioImportSummary"];

// --- teses de investimento (documentos de research do dono da chave) ------------
export type ThesisSummary = Schemas["ThesisSummary"];
export type ThesisDetail = Schemas["ThesisDetail"];
export type ThesesResponse = Ok<"listMyTheses">;
export type ThesisResponse = Ok<"getThesis">;
export type CreateThesisResponse = Created<"createThesis">;
export type ThesisExportStatus = Schemas["ThesisExportStatus"];
export type ThesisWarning = Schemas["ThesisWarning"];
export interface ThesisWriteInput {
  /**
   * Markdown da tese (frontmatter + GFM + cercas ```db:*) — o caminho preferido.
   * Bloco fora do formato degrada para aviso em `warnings`; a tese salva.
   */
  md?: string;
  /** ReportDoc completo (JSON) — caminho legado, validação tudo-ou-nada. */
  doc?: Record<string, unknown>;
  visibility?: "private" | "unlisted" | "public";
  /** Arquiva (some do público) / desarquiva a tese. */
  archived?: boolean;
  /** Rótulos PRIVADOS de organização (substitui o conjunto; nunca aparecem no público). */
  tags?: string[];
}

/** Referência de ativo dentro de uma carteira (chave natural). */
export interface PortfolioAssetRef {
  assetType: "stock" | "fii" | "bdr" | "index" | "tesouro" | "crypto" | "option" | "renda_fixa" | "us";
  /** Ticker (PETR4, AAPL) ou, para Tesouro, o nome oficial do título. */
  symbol: string;
}

/** Campos de uma transação — `POST /v1/portfolios/{id}/transactions`. */
export interface PortfolioTransactionInput {
  kind: "buy" | "sell" | "split";
  /** Data do negócio (AAAA-MM-DD). */
  tradeDate: string;
  /** Obrigatória em buy/sell (> 0). */
  quantity?: number;
  /** Preço unitário na moeda de negociação do ativo: BRL, ou USD para asset_type=us (omita se desconhecido). */
  price?: number | null;
  fees?: number;
  /** Fator do split (2 = 2:1; 0.5 = grupamento 1:2). */
  ratio?: number;
  note?: string;
}

/** Patch parcial de uma transação — `PATCH /v1/portfolios/{id}/transactions/{txId}`. */
export type PortfolioTransactionPatch = Partial<PortfolioTransactionInput>;

/** Ajustes de uma carteira — `PATCH /v1/portfolios/{id}`. */
export interface PortfolioPatch {
  name?: string;
  visibility?: "private" | "unlisted" | "public";
  /** true = carteira de simulação (fora do consolidado). */
  excludeFromConsolidated?: boolean;
}

/** Import de planilha — `POST /v1/portfolios/{id}/imports`. */
export interface PortfolioImportInput {
  /** Conteúdo do arquivo (xlsx da B3 ou CSV do template) em base64. Máx. 8 MB. */
  contentBase64: string;
  filename?: string;
}

/** Taxa contratada de renda fixa — `PATCH /v1/portfolios/{id}/assets`. */
export interface PortfolioRfContract {
  /** cdi = % do CDI; prefixado = % a.a.; ipca = IPCA + % a.a.; none limpa. */
  indexer: "cdi" | "prefixado" | "ipca" | "none";
  rate?: number;
}

/** Filtros da busca semântica de documentos — `GET /v1/documents/search`. */
export interface SearchDocumentsParams {
  /** Papéis a filtrar; array serializado em CSV pelo HttpClient. */
  tickers?: string[] | string;
  /** Categoria bruta da fonte; descubra valores em getDocumentTaxonomy(). */
  category?: string;
  /** Taxonomia estável do DataBolsa. */
  documentKind?: "material_fact" | "market_communication" | "financial_report" | "shareholder_notice" | "shareholder_meeting" | "periodic_report" | "management_report" | "debt_instrument" | "governing_document" | "other";
  /** Tipo de entidade que o documento descreve. `issuer` é a companhia
   *  registrada apenas para emitir dívida (não tem ticker); `securitization` é
   *  o certificado CRI/CRA/OTS, identificado pelo ISIN. */
  entityType?: "stock" | "fii" | "fiagro" | "issuer" | "securitization" | "fidc";
  /** CNPJ do emissor (14 dígitos) — chave de entidade para crédito. */
  issuerCnpj?: string;
  /** ISIN, código ANBIMA ou código de instrumento B3 do papel. */
  assetCode?: string;
  /** Família do papel; eixo independente de entityType. */
  assetFamily?: "DEB" | "CRI" | "CRA" | "OTS" | "FIDC" | "FIAGRO";
  /** Ano de referência (AAAA). */
  year?: number;
  /** Corte point-in-time pela data real de protocolo/publicação. */
  filedBefore?: string;
  /** Só documentos protocolados a partir desta data. */
  filedAfter?: string;
  /** Restringe a um protocolo exato; ainda é busca semântica dentro do documento. */
  protocol?: string;
  /** Período de referência exato (AAAA-MM-DD). */
  referenceDate?: string;
  referenceFrom?: string;
  referenceTo?: string;
  /** Subtipo bruto da fonte; descubra em getDocumentTaxonomy(). */
  docType?: string;
  /** Restringe a trechos de tabela (fatos numéricos). */
  tablesOnly?: boolean;
  /** Restringe a emissores financeiros; false restringe aos demais. */
  financialOnly?: boolean;
  /** false omite o contexto concatenado e reduz a resposta. */
  includeContext?: boolean;
  /** Máximo de trechos (1–25, default 8). */
  limit?: number;
}

/** Paginação da leitura determinística de um documento já descoberto. */
export interface ReadDocumentParams {
  /** Conector devolvido em citation.source; recomendado para identidade inequívoca. */
  source?: string;
  /** meta.next_cursor da página anterior. */
  cursor?: string;
  /** Trechos por página (1–50, default 20). */
  limit?: number;
}

/**
 * Agrupamento client-side de `from`/`to` (datas ISO) — não é um schema do
 * contrato; os endpoints os recebem como query params soltos. Único tipo
 * mantido à mão de propósito.
 */
export interface RangeParams {
  from?: string;
  to?: string;
}

// Minerais (USGS Mineral Commodity Summaries): produção e reservas por país.
export type MineralsResponse = Ok<"listMinerals">;
export type MineralResponse = Ok<"getMineral">;
export type MineralProducersResponse = Ok<"listMineralProducers">;
export type MineralObservationsResponse = Ok<"listMineralObservations">;
