CREATE TABLE "companies" (
	"id" serial PRIMARY KEY NOT NULL,
	"cnpj" text NOT NULL,
	"cd_cvm" bigint,
	"company_name" text,
	"sector" text,
	"status" text,
	"issuer_status" text,
	"ownership_control" text,
	"tickers" text,
	"listing_segment" text,
	"has_active_ticker" boolean,
	"free_float_pct" double precision
);
--> statement-breakpoint
CREATE TABLE "fund_indicators" (
	"cnpj" text NOT NULL,
	"ticker" text NOT NULL,
	"company_name" text,
	"eval_date" date NOT NULL,
	"statement_date" date,
	"scope" text,
	"market_cap" double precision,
	"price" double precision,
	"price_date" date,
	"total_shares" bigint,
	"pl" double precision,
	"pvp" double precision,
	"psr" double precision,
	"p_ebit" double precision,
	"p_fcf" double precision,
	"p_ativos" double precision,
	"p_cap_giro" double precision,
	"p_ativo_circ_liq" double precision,
	"ev_ebitda" double precision,
	"ev_ebit" double precision,
	"lpa" double precision,
	"vpa" double precision,
	"roe" double precision,
	"roa" double precision,
	"roic" double precision,
	"margem_bruta" double precision,
	"margem_ebit" double precision,
	"margem_liquida" double precision,
	"ebit_ativos" double precision,
	"giro_ativos" double precision,
	"div_liquida_ebitda" double precision,
	"div_liquida_pl" double precision,
	"div_bruta_pl" double precision,
	"liquidez_corrente" double precision,
	"dy_12m" double precision,
	"payout" double precision,
	"jcp_sobre_total" double precision,
	"revenue_cagr_3y" double precision,
	"revenue_cagr_5y" double precision,
	"earnings_cagr_3y" double precision,
	"earnings_cagr_5y" double precision,
	"ebitda_cagr_3y" double precision,
	"negative_equity" boolean,
	"shares_quality" text,
	"quarters_available" bigint,
	CONSTRAINT "fund_indicators_cnpj_eval_date_pk" PRIMARY KEY("cnpj","eval_date")
);
--> statement-breakpoint
CREATE TABLE "fund_statements" (
	"cnpj" text NOT NULL,
	"cd_cvm" bigint,
	"company_name" text,
	"ref_date" date NOT NULL,
	"scope" text NOT NULL,
	"quarters_available" bigint,
	"is_latest" boolean,
	"revenue_ttm" double precision,
	"gross_profit_ttm" double precision,
	"ebit_ttm" double precision,
	"ebitda_ttm" double precision,
	"net_income_ttm" double precision,
	"ocf_ttm" double precision,
	"fcf_ttm" double precision,
	"dna_ttm" double precision,
	"capex_ttm" double precision,
	"total_assets" double precision,
	"current_assets" double precision,
	"cash" double precision,
	"st_investments" double precision,
	"current_liabilities" double precision,
	"noncurrent_liabilities" double precision,
	"st_debt" double precision,
	"lt_debt" double precision,
	"gross_debt" double precision,
	"net_debt" double precision,
	"equity" double precision,
	"working_capital" double precision,
	"net_current_assets" double precision,
	"invested_capital" double precision,
	"nopat_ttm" double precision,
	CONSTRAINT "fund_statements_cnpj_ref_date_scope_pk" PRIMARY KEY("cnpj","ref_date","scope")
);
--> statement-breakpoint
CREATE TABLE "macro_cross_asset" (
	"date" date NOT NULL,
	"indicator_id" text NOT NULL,
	"value" double precision,
	"unit" text,
	"label" text,
	"lineage" text,
	CONSTRAINT "macro_cross_asset_indicator_id_date_pk" PRIMARY KEY("indicator_id","date")
);
--> statement-breakpoint
CREATE TABLE "macro_indicators" (
	"section" text NOT NULL,
	"indicator_id" text NOT NULL,
	"date" date NOT NULL,
	"value" double precision,
	"unit" text,
	"label" text,
	"lineage" text,
	CONSTRAINT "macro_indicators_section_indicator_id_date_pk" PRIMARY KEY("section","indicator_id","date")
);
--> statement-breakpoint
CREATE TABLE "prices" (
	"date" date NOT NULL,
	"ticker" text NOT NULL,
	"codbdi" text,
	"isin" text,
	"open_adj" double precision,
	"high_adj" double precision,
	"low_adj" double precision,
	"close_adj" double precision,
	"close_raw" double precision,
	"adj_factor" double precision,
	"volume_brl" double precision,
	"quantity" bigint,
	"adjust_type" text,
	"adjust_quality" text,
	CONSTRAINT "prices_ticker_date_pk" PRIMARY KEY("ticker","date")
);
--> statement-breakpoint
CREATE UNIQUE INDEX "companies_cd_cvm_key" ON "companies" USING btree ("cd_cvm");--> statement-breakpoint
CREATE INDEX "companies_cnpj_idx" ON "companies" USING btree ("cnpj");--> statement-breakpoint
CREATE INDEX "companies_sector_idx" ON "companies" USING btree ("sector");--> statement-breakpoint
CREATE INDEX "fund_indicators_ticker_idx" ON "fund_indicators" USING btree ("ticker");--> statement-breakpoint
CREATE INDEX "fund_indicators_eval_date_idx" ON "fund_indicators" USING btree ("eval_date");--> statement-breakpoint
CREATE INDEX "fund_indicators_ticker_eval_idx" ON "fund_indicators" USING btree ("ticker","eval_date");--> statement-breakpoint
CREATE INDEX "fund_statements_cnpj_latest_idx" ON "fund_statements" USING btree ("cnpj","is_latest");--> statement-breakpoint
CREATE INDEX "macro_indicators_section_idx" ON "macro_indicators" USING btree ("section");--> statement-breakpoint
CREATE INDEX "macro_indicators_indicator_date_idx" ON "macro_indicators" USING btree ("indicator_id","date");--> statement-breakpoint
CREATE INDEX "prices_ticker_date_idx" ON "prices" USING btree ("ticker","date");