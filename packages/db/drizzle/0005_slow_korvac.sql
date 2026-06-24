CREATE TABLE "crypto_quotes" (
	"symbol" text NOT NULL,
	"date" date NOT NULL,
	"open" double precision,
	"high" double precision,
	"low" double precision,
	"close" double precision,
	"volume" double precision,
	"quote_volume" double precision,
	"trades" bigint
);
--> statement-breakpoint
CREATE INDEX "crypto_quotes_symbol_date_idx" ON "crypto_quotes" USING btree ("symbol","date");