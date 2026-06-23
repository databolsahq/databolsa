ALTER TABLE "options_chain" ADD COLUMN "iv_amer" double precision;--> statement-breakpoint
ALTER TABLE "options_chain" ADD COLUMN "delta_amer" double precision;--> statement-breakpoint
ALTER TABLE "options_chain" ADD COLUMN "gamma_amer" double precision;--> statement-breakpoint
ALTER TABLE "options_chain" ADD COLUMN "vega_amer" double precision;--> statement-breakpoint
ALTER TABLE "options_chain" ADD COLUMN "theta_amer" double precision;--> statement-breakpoint
ALTER TABLE "options_chain" ADD COLUMN "early_ex_premium" double precision;