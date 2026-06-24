CREATE TABLE "ingest_runs" (
	"run_id" text PRIMARY KEY NOT NULL,
	"started_at" timestamp with time zone,
	"manifest" text NOT NULL
);
--> statement-breakpoint
CREATE INDEX "ingest_runs_started_idx" ON "ingest_runs" USING btree ("started_at");