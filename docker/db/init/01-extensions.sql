-- Enabled on fresh databases so serving tables can use time-series indexes and
-- future vector search without a later extension migration.
CREATE EXTENSION IF NOT EXISTS timescaledb;
CREATE EXTENSION IF NOT EXISTS vector;
-- pg_trgm powers the unified global search (trigram similarity over tickers/names).
-- Also created by migration 0012 for already-provisioned DBs; here for fresh boots.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
