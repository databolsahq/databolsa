CREATE TABLE "company_documents" (
	"cvm_code" bigint NOT NULL,
	"category" text,
	"type" text,
	"subject" text,
	"reference_date" date,
	"filed_at" date,
	"protocol" text,
	"download_url" text,
	"has_text" boolean
);
--> statement-breakpoint
CREATE TABLE "corporate_events" (
	"ticker" text NOT NULL,
	"type" text NOT NULL,
	"approved_date" date,
	"ex_date" date NOT NULL,
	"factor" double precision,
	"detail" text
);
--> statement-breakpoint
CREATE TABLE "dividends" (
	"ticker" text NOT NULL,
	"type" text NOT NULL,
	"ex_date" date NOT NULL,
	"payment_date" date,
	"value_per_share_gross" double precision,
	"value_per_share_net" double precision
);
--> statement-breakpoint
CREATE TABLE "insider_moves" (
	"cnpj" text NOT NULL,
	"reference_month" text NOT NULL,
	"net_shares" double precision,
	"net_value_brl" double precision,
	"buy_value_brl" double precision,
	"sell_value_brl" double precision
);
--> statement-breakpoint
CREATE INDEX "company_documents_cvm_idx" ON "company_documents" USING btree ("cvm_code","filed_at");--> statement-breakpoint
CREATE INDEX "corporate_events_ticker_ex_idx" ON "corporate_events" USING btree ("ticker","ex_date");--> statement-breakpoint
CREATE INDEX "dividends_ticker_ex_idx" ON "dividends" USING btree ("ticker","ex_date");--> statement-breakpoint
CREATE INDEX "insider_moves_cnpj_idx" ON "insider_moves" USING btree ("cnpj","reference_month");