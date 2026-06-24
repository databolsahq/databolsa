CREATE TABLE "options_chain" (
	"option_ticker" text NOT NULL,
	"underlying_ticker" text,
	"underlying_root" text,
	"option_type" text,
	"strike" double precision,
	"expiry" date,
	"date" date,
	"last" double precision,
	"volume_brl" double precision,
	"trades" bigint,
	"underlying_spot" double precision,
	"days_to_expiry" integer,
	"moneyness" double precision,
	"intrinsic" double precision,
	"time_value" double precision
);
--> statement-breakpoint
CREATE TABLE "options_quotes" (
	"option_ticker" text NOT NULL,
	"underlying_ticker" text,
	"underlying_root" text,
	"option_type" text,
	"strike" double precision,
	"expiry" date,
	"date" date NOT NULL,
	"open" double precision,
	"high" double precision,
	"low" double precision,
	"last" double precision,
	"volume_brl" double precision,
	"trades" bigint,
	"quantity" bigint,
	"underlying_spot" double precision,
	"days_to_expiry" integer,
	"moneyness" double precision,
	"intrinsic" double precision,
	"time_value" double precision
);
--> statement-breakpoint
CREATE INDEX "options_chain_underlying_idx" ON "options_chain" USING btree ("underlying_ticker","expiry");--> statement-breakpoint
CREATE INDEX "options_chain_option_idx" ON "options_chain" USING btree ("option_ticker");--> statement-breakpoint
CREATE INDEX "options_quotes_option_date_idx" ON "options_quotes" USING btree ("option_ticker","date");--> statement-breakpoint
CREATE INDEX "options_quotes_underlying_date_idx" ON "options_quotes" USING btree ("underlying_ticker","date");