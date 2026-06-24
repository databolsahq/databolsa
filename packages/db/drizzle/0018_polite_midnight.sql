CREATE TABLE "index_composition" (
	"code" text NOT NULL,
	"effective_date" date,
	"ticker" text NOT NULL,
	"asset_name" text,
	"asset_type" text,
	"weight" double precision,
	"theoretical_quantity" double precision
);
--> statement-breakpoint
CREATE INDEX "index_composition_code_idx" ON "index_composition" USING btree ("code");