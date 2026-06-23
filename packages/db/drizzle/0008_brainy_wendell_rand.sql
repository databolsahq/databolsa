CREATE TABLE "price_stats" (
	"ticker" text PRIMARY KEY NOT NULL,
	"reference_date" date,
	"retorno_12m" double precision,
	"volatilidade" double precision,
	"beta" double precision,
	"volume_medio_2m" double precision
);
