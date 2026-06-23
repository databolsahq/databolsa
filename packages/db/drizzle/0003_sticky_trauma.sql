CREATE TABLE "index_quotes" (
	"code" text NOT NULL,
	"date" date NOT NULL,
	"close" double precision
);
--> statement-breakpoint
CREATE TABLE "macro_expectations" (
	"indicator" text NOT NULL,
	"reference" text NOT NULL,
	"survey_date" date NOT NULL,
	"median" double precision,
	"mean" double precision,
	"std_dev" double precision,
	"respondents" integer,
	"base" integer
);
--> statement-breakpoint
CREATE TABLE "macro_series" (
	"source" text NOT NULL,
	"series_id" text NOT NULL,
	"date" date NOT NULL,
	"value" double precision
);
--> statement-breakpoint
CREATE TABLE "macro_series_catalog" (
	"source" text NOT NULL,
	"series_id" text NOT NULL,
	"name" text,
	"label" text,
	"unit" text,
	"frequency" text,
	"first_date" date,
	"last_date" date
);
--> statement-breakpoint
CREATE TABLE "tesouro_bonds" (
	"type" text NOT NULL,
	"name" text,
	"maturity" date NOT NULL,
	"date" date NOT NULL,
	"buy_rate" double precision,
	"sell_rate" double precision,
	"buy_price" double precision,
	"sell_price" double precision,
	"maturity_years" double precision
);
--> statement-breakpoint
CREATE INDEX "index_quotes_code_date_idx" ON "index_quotes" USING btree ("code","date");--> statement-breakpoint
CREATE INDEX "macro_expectations_idx" ON "macro_expectations" USING btree ("indicator","reference","survey_date");--> statement-breakpoint
CREATE INDEX "macro_series_idx" ON "macro_series" USING btree ("source","series_id","date");--> statement-breakpoint
CREATE INDEX "macro_series_catalog_idx" ON "macro_series_catalog" USING btree ("source","series_id");--> statement-breakpoint
CREATE INDEX "tesouro_bonds_date_idx" ON "tesouro_bonds" USING btree ("date");--> statement-breakpoint
CREATE INDEX "tesouro_bonds_type_idx" ON "tesouro_bonds" USING btree ("type","date");