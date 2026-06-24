-- Unified global search over native Postgres (pg_trgm). The serving catalog is tiny
-- (<5k rows), so trigram similarity on short ticker/name strings is the right tool —
-- no OpenSearch, no tsvector. See plans/fix-global-search.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
--> statement-breakpoint
-- GIN trigram indexes on the searchable base columns. A view can't be indexed, so the
-- planner pushes the similarity()/ILIKE predicates down to these.
CREATE INDEX IF NOT EXISTS "companies_name_trgm" ON "companies" USING gin ("company_name" gin_trgm_ops);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "companies_tickers_trgm" ON "companies" USING gin ("tickers" gin_trgm_ops);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "fii_profile_name_trgm" ON "fii_profile" USING gin ("name" gin_trgm_ops);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "fii_profile_tk_trgm" ON "fii_profile" USING gin ("ticker" gin_trgm_ops);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "macro_catalog_name_trgm" ON "macro_series_catalog" USING gin ("name" gin_trgm_ops);
--> statement-breakpoint
-- search_catalog normalizes every searchable entity into one shape. A plain VIEW (not a
-- materialized table) means the batch loader's DELETE+INSERT needs no changes — the view
-- always reflects the current base tables.
CREATE OR REPLACE VIEW "search_catalog" AS
  -- Stocks: one row per ticker (unnest the comma-joined `tickers` string) so exact/prefix
  -- match works on a single symbol and href points at /acoes/<TICKER>.
  SELECT
    'stock'::text AS kind,
    tk AS ticker,
    tk AS title,
    c.company_name AS subtitle,
    '/acoes/' || tk AS href,
    tk || ' ' || coalesce(c.company_name, '') AS search_text
  FROM companies c
  CROSS JOIN LATERAL unnest(string_to_array(coalesce(c.tickers, ''), ',')) AS tk
  WHERE c.has_active_ticker IS TRUE AND tk <> ''

  UNION ALL
  SELECT 'fii', f.ticker, f.ticker, f.name, '/fiis/' || f.ticker,
         f.ticker || ' ' || coalesce(f.name, '')
  FROM fii_profile f
  WHERE f.ticker IS NOT NULL

  -- Index names live here (not just the code) so "bovespa" matches IBOV. Mirrors the 2
  -- entries in INDEX_META (api/services/index-market.service.ts) — fall back to the code.
  UNION ALL
  SELECT 'index', q.code,
         coalesce(nm.name, q.code) AS title,
         q.code AS subtitle,
         '/indices/' || q.code,
         q.code || ' ' || coalesce(nm.name, '') AS search_text
  FROM (SELECT DISTINCT code FROM index_quotes) q
  LEFT JOIN (VALUES
    ('IBOV', 'Índice Bovespa'),
    ('IFIX', 'Índice de Fundos Imobiliários')
  ) AS nm(code, name) ON nm.code = q.code

  -- Bonds: deep-link needs type + maturity (route is /tesouro/[type]/[maturity]). Bond
  -- types carry spaces/"+" (e.g. "Tesouro Educa+"), so percent-encode them for the path
  -- segment (space → %20; "+" is literal in a pathname and round-trips as-is).
  UNION ALL
  SELECT 'bond', b.type, coalesce(b.name, b.type), b.maturity::text,
         '/tesouro/' || replace(b.type, ' ', '%20') || '/' || b.maturity::text,
         b.type || ' ' || coalesce(b.name, '')
  FROM (SELECT DISTINCT type, name, maturity FROM tesouro_bonds) b

  -- Macro: no per-series web route exists yet — link to /macro?serie=<source>:<id>.
  UNION ALL
  SELECT 'macro', m.series_id, coalesce(m.label, m.name), m.unit,
         '/macro?serie=' || m.source || ':' || m.series_id,
         coalesce(m.name, '') || ' ' || coalesce(m.label, '')
  FROM macro_series_catalog m;
