CREATE TABLE "fii_distributions" (
	"ticker" text NOT NULL,
	"ex_date" date NOT NULL,
	"payment_date" date,
	"value_per_share" double precision,
	"tax_free" boolean
);
--> statement-breakpoint
CREATE TABLE "fii_indicators" (
	"ticker" text NOT NULL,
	"reference_date" date,
	"preco" double precision,
	"vp_cota" double precision,
	"patrimonio_liquido" double precision,
	"cotistas" bigint,
	"dividend_yield_mes" double precision,
	"dist_12m" double precision,
	"dy_12m" double precision,
	"pvp" double precision
);
--> statement-breakpoint
CREATE TABLE "fii_profile" (
	"ticker" text NOT NULL,
	"cnpj" text,
	"name" text,
	"segment" text,
	"administrator" text,
	"manager" text,
	"is_paper" boolean
);
--> statement-breakpoint
CREATE TABLE "fii_reports" (
	"ticker" text NOT NULL,
	"reference_month" text NOT NULL,
	"net_asset_value" double precision,
	"value_per_share" double precision,
	"monthly_dividend_yield_pct" double precision,
	"shareholders" bigint,
	"shares_issued" double precision
);
--> statement-breakpoint
CREATE INDEX "fii_distributions_ticker_idx" ON "fii_distributions" USING btree ("ticker","ex_date");--> statement-breakpoint
CREATE INDEX "fii_indicators_ticker_idx" ON "fii_indicators" USING btree ("ticker");--> statement-breakpoint
CREATE INDEX "fii_profile_ticker_idx" ON "fii_profile" USING btree ("ticker");--> statement-breakpoint
CREATE INDEX "fii_reports_ticker_idx" ON "fii_reports" USING btree ("ticker","reference_month");