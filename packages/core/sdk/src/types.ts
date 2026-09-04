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
export type IndicatorValue = Schemas["IndicatorValue"];
export type Document = Schemas["Document"];
export type CorporateEvent = Schemas["CorporateEvent"];
export type FiiListRow = Schemas["FiiListRow"];
export type RegimeSnapshot = Schemas["RegimeSnapshot"];
export type RegimeSignal = Schemas["RegimeSignal"];
export type ScreenerRow = Schemas["ScreenerRow"];
export type SearchResult = Schemas["SearchResult"];
export type InsiderMove = Schemas["InsiderMove"];
export type OptionContract = Schemas["OptionContract"];
export type OptionExpiry = Schemas["OptionExpiry"];
export type OptionQuote = Schemas["OptionQuote"];
export type IngestSourceStatus = Schemas["IngestSourceHealth"]["status"];
export type IngestSourceHealth = Schemas["IngestSourceHealth"];
export type IngestRunSummary = Schemas["IngestRunSummary"];
export type FundProfile = Schemas["FundProfile"];
export type FundHolding = Schemas["FundHolding"];
export type FundScreenerItem = Schemas["FundScreenerItem"];
export type InvestorFlow = Schemas["InvestorFlow"];
export type InvestorFlowMonthly = Schemas["InvestorFlowMonthly"];
export type PublicOffering = Schemas["PublicOffering"];
export type LiveQuote = Schemas["LiveQuote"];
export type IntradayPoint = Schemas["IntradayPoint"];

export type DocumentChunk = Schemas["DocumentChunk"];

// --- respostas (corpo 200 de cada operação) -------------------------------
export type HealthResponse = Ok<"getHealth">;
export type IngestHealthResponse = Ok<"getIngestHealth">;
export type ScreenStocksResponse = Ok<"screenStocks">;
export type FiiScreenResponse = Ok<"screenFiis">;
export type StockIndicatorsResponse = Ok<"getStockIndicators">;
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
export type ObjectListResponse = Ok<"listObjects">;
export type ObjectTableResult = Ok<"getObjectTable">;
/** A consulta reexecutável que produziu uma tabela — o mesmo `meta.query` da resposta. */
export type ObjectQuery = ObjectTableResult["meta"]["query"];
export type ObjectAggregateResponse = Ok<"aggregateObjects">;
export type ObjectEventsResponse = Ok<"getObjectEvents">;
export type TradingStatusResponse = Ok<"listTradingStatus">;
export type CorporateSuccessionsResponse = Ok<"listCorporateSuccessions">;
export type DocumentsResponse = Ok<"listCompanyDocuments">;
export type InsiderResponse = Ok<"listInsiderMoves">;
export type FiiIndicatorsResponse = Ok<"getFiiIndicators">;
export type IndexCompositionResponse = Ok<"getIndexComposition">;
export type BondCurveResponse = Ok<"getBondCurves">;
export type TesouroAuctionsResponse = Ok<"listTesouroAuctions">;

// --- commodities (futuros da B3: boi, milho, café, etanol, soja, ouro) -------
export type CommodityCurveResponse = Ok<"getCommodityCurve">;
export type CommoditySettlementsResponse = Ok<"listCommoditySettlements">;
export type DebenturesResponse = Ok<"listDebentures">;
export type CreditOtcQuotesResponse = Ok<"listOtcQuotes">;
export type CreditRatingsResponse = Ok<"listCreditRatings">;
export type CreditRatingAction = Schemas["CreditRatingAction"];
/** 'national_br' e 'global' NUNCA compartilham eixo de comparação. */
export type CreditRatingScale = CreditRatingAction["scale"];
export type FidcListResponse = Ok<"listFidcs">;
export type FidcRegulationTerms = Ok<"getFidcRegulationTerms">;
export type FidcDelinquencyResponse = Ok<"listFidcDelinquency">;
export type FidcScrResponse = Ok<"listFidcScr">;
export type FidcSecondaryResponse = Ok<"listFidcQuotes">;
export type FidcSectorResponse = Ok<"listFidcSectors">;
/** O inverso: as classes que declararam um CNPJ como cedente. */
export type FidcOriginatorExposureResponse = Ok<"listFidcOriginatorExposure">;
export type FidcInvestorResponse = Ok<"listFidcInvestors">;
export type FidcPricingResponse = Ok<"listFidcPricing">;

// --- crédito: screener de debêntures + look-through de fundos ---------------
export type DebentureScreenerRow = Schemas["DebentureScreenerRow"];
export type DebentureScreenerResponse = Ok<"screenDebentures">;

// --- crédito: curva de spread observada no secundário de debêntures ----------
export type CreditCurvePoint = Schemas["CreditCurvePoint"];
export type CreditCurveResponse = Ok<"getCreditCurve">;
export type MacroGearsResponse = Ok<"getMacroGears">;
export type CryptoLiveResponse = Ok<"listCryptoLive">;
export type UsAssetDetail = Ok<"getUsAsset">;
export type UsFilingsResponse = Ok<"listUsFilings">;
export type SearchResponse = Ok<"search">;
export type OptionsChainResponse = Ok<"getOptionsChain">;
export type OptionExpiriesResponse = Ok<"listOptionExpiries">;
export type OptionsQuotesResponse = Ok<"listOptionQuotes">;
export type FundHoldingsResponse = Ok<"listFundHoldings">;
export type FundScreenerResponse = Ok<"screenFunds">;
/** Demanda por papel (fundos + insider no mesmo eixo mensal). */
export type OwnershipFlowResponse = Ok<"listOwnershipFlow">;
/** Quem se mexeu no papel, fundo a fundo, numa competência. */
export type OwnershipMoversResponse = Ok<"listOwnershipMovers">;
export type InvestedFundsResponse = Ok<"listInvestedFunds">;
export type FundInvestorsResponse = Ok<"listFundInvestors">;
export type FundLookThroughResponse = Ok<"listFundLookThrough">;
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

export type DocumentSearchResponse = Ok<"searchDocuments">;
export type DocumentReadResponse = Ok<"readDocument">;
export type DocumentTaxonomy = Ok<"getDocumentTaxonomy">;

/** Corpo JSON da resposta 201 (criação) de uma operação do contrato. */
export type Created<Op extends keyof operations> = operations[Op] extends {
  responses: { 201: { content: { "application/json": infer T } } };
}
  ? T
  : never;







/** Filtros da busca semântica de documentos — `GET /v1/documents/search`. */
export interface SearchDocumentsParams {
  /** Papéis a filtrar; array serializado em CSV pelo HttpClient. */
  tickers?: string[] | string;
  /** Categoria bruta da fonte; descubra valores em getDocumentTaxonomy(). */
  category?: string;
  /** Taxonomia estável do DataBolsa. */
  documentKind?: "material_fact" | "market_communication" | "financial_report" | "shareholder_notice" | "shareholder_meeting" | "periodic_report" | "management_report" | "debt_instrument" | "governing_document" | "offering_document" | "regulation" | "other";
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
export type MineralProducersResponse = Ok<"listMineralProducers">;
export type MineralObservationsResponse = Ok<"listMineralObservations">;
