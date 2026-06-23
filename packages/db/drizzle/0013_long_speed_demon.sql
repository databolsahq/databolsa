CREATE TABLE "bdr_profile" (
	"ticker" text NOT NULL,
	"name" text,
	"isin" text,
	"kind" text,
	"spec" text,
	"first_traded" date,
	"last_traded" date,
	"sessions" bigint
);
--> statement-breakpoint
CREATE INDEX "bdr_profile_ticker_idx" ON "bdr_profile" USING btree ("ticker");