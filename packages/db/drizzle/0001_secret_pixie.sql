CREATE TABLE "macro_regime" (
	"date" date NOT NULL,
	"indicator_id" text NOT NULL,
	"value" double precision,
	"unit" text,
	"label" text,
	"lineage" text,
	CONSTRAINT "macro_regime_indicator_id_date_pk" PRIMARY KEY("indicator_id","date")
);
