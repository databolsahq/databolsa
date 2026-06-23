CREATE TABLE "paper_indicators" (
	"ticker" text NOT NULL,
	"class_group" text,
	"cnpj" text NOT NULL,
	"company_name" text,
	"eval_date" date NOT NULL,
	"statement_date" date,
	"scope" text,
	"price" double precision,
	"price_date" date,
	"market_cap" double precision,
	"company_market_cap" double precision,
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
	"dy_12m" double precision,
	"dps_12m" double precision,
	"payout" double precision,
	"jcp_sobre_total" double precision,
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
	"revenue_cagr_3y" double precision,
	"revenue_cagr_5y" double precision,
	"earnings_cagr_3y" double precision,
	"earnings_cagr_5y" double precision,
	"ebitda_cagr_3y" double precision,
	"negative_equity" boolean,
	"shares_quality" text,
	"quarters_available" bigint,
	CONSTRAINT "paper_indicators_ticker_eval_date_pk" PRIMARY KEY("ticker","eval_date")
);
--> statement-breakpoint
ALTER TABLE "fii_indicators" ADD COLUMN "qtd_imoveis" bigint;--> statement-breakpoint
ALTER TABLE "fii_indicators" ADD COLUMN "area_m2" double precision;--> statement-breakpoint
ALTER TABLE "fii_indicators" ADD COLUMN "preco_m2" double precision;--> statement-breakpoint
ALTER TABLE "fii_indicators" ADD COLUMN "aluguel_m2" double precision;--> statement-breakpoint
CREATE INDEX "paper_indicators_cnpj_idx" ON "paper_indicators" USING btree ("cnpj");--> statement-breakpoint
CREATE INDEX "paper_indicators_eval_date_idx" ON "paper_indicators" USING btree ("eval_date");--> statement-breakpoint
CREATE INDEX "paper_indicators_ticker_eval_idx" ON "paper_indicators" USING btree ("ticker","eval_date");