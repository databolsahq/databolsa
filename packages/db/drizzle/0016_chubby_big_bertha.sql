ALTER TABLE "options_chain" ADD COLUMN "iv" double precision;--> statement-breakpoint
ALTER TABLE "options_chain" ADD COLUMN "delta" double precision;--> statement-breakpoint
ALTER TABLE "options_chain" ADD COLUMN "gamma" double precision;--> statement-breakpoint
ALTER TABLE "options_chain" ADD COLUMN "vega" double precision;--> statement-breakpoint
ALTER TABLE "options_chain" ADD COLUMN "theta" double precision;--> statement-breakpoint
ALTER TABLE "options_quotes" ADD COLUMN "iv" double precision;--> statement-breakpoint
ALTER TABLE "options_quotes" ADD COLUMN "delta" double precision;--> statement-breakpoint
ALTER TABLE "options_quotes" ADD COLUMN "gamma" double precision;--> statement-breakpoint
ALTER TABLE "options_quotes" ADD COLUMN "vega" double precision;--> statement-breakpoint
ALTER TABLE "options_quotes" ADD COLUMN "theta" double precision;