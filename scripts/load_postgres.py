# /// script
# requires-python = ">=3.11"
# dependencies = ["duckdb>=1.1", "redis>=5"]
# ///
"""Load the dbt marts into the serving Postgres (the @databolsa/db schema).

The marts (`data/marts/*.parquet`) are the source of truth; this mirrors the
serving tables into Postgres using DuckDB's `postgres` extension (`ATTACH` +
`INSERT INTO ... SELECT`). It is idempotent — each table is replaced inside a
transaction, so re-running after a `dbt build` refreshes the serving DB. Heavy
corpora (the IPE filings) are never touched; only the built marts are read.

Columns are matched by NAME (introspected per mart), never by position, so
`companies.id` (a serving-only surrogate) auto-fills and warehouse column
re-orderings can't corrupt a load. The macro `date` is a midnight TIMESTAMP in
the mart and is cast to DATE.

Usage:  uv run scripts/load_postgres.py
Env:    Read from the repo-root `.env` (same as the API) unless already set in the shell.
        DATABASE_URL (default: postgresql://databolsa:databolsa_dev@localhost:5433/databolsa)
        REDIS_URL    (default: redis://localhost:6380 — the dev cache; see bump_cache_version)
        CACHE_ENABLED=false to skip the cache bump when the API runs without a response cache
"""

from __future__ import annotations

import os
import sys
import time
from pathlib import Path
from urllib.parse import unquote, urlparse

import duckdb


def load_dotenv(path: Path) -> None:
    """Minimal `.env` loader (no dependency) so this script sees the SAME env the API does
    — chiefly REDIS_URL/DATABASE_URL. Without it, the loader and the API can target
    different Postgres/Redis instances (host ports are picked to avoid collisions, so they
    are machine-specific and NOT guessable). Real environment variables win (setdefault).
    """
    if not path.is_file():
        return
    for raw in path.read_text().splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("export "):
            line = line[len("export ") :]
        key, sep, value = line.partition("=")
        if not sep:
            continue
        key, value = key.strip(), value.strip()
        if len(value) >= 2 and value[0] in "\"'" and value[-1] == value[0]:
            value = value[1:-1]  # quoted value — take verbatim
        else:
            hash_at = value.find(" #")  # strip inline comment on unquoted values
            if hash_at != -1:
                value = value[:hash_at].rstrip()
        if key:
            os.environ.setdefault(key, value)


REPO_ROOT = Path(__file__).resolve().parent.parent
MARTS_DIR = REPO_ROOT / "data" / "marts"
# Manifestos de execução do ingest (run-<id>.json, formato RunLedger). Espelhados na
# tabela ingest_runs p/ a API ler a Saúde dos dados do Postgres (não do filesystem).
RUNS_DIR = REPO_ROOT / "data" / "_runs"
load_dotenv(REPO_ROOT / ".env")  # align with the API's env before reading the URLs below
DATABASE_URL = os.environ.get(
    "DATABASE_URL", "postgresql://databolsa:databolsa_dev@localhost:5433/databolsa"
)
# The API namespaces every response-cache key by dbcache:version (ADR-0003); a load must
# bump it or the API keeps serving pre-load values. Default to the dev Redis — compose maps
# the container's 6379 to host 6380. Mirror the API's enable gate so the bump targets the
# same instance the API caches in (set REDIS_URL for another instance; CACHE_ENABLED=false
# to skip when the API runs cache-less).
REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6380")
CACHE_ENABLED = os.environ.get("CACHE_ENABLED", "true").lower() != "false"

# (mart parquet basename, target table, source projection). The projection's output
# column names must all exist on the target; any target column absent here (e.g.
# companies.id) keeps its default.
LOADS: list[tuple[str, str, str]] = [
    (
        "mart_fund__company",
        "companies",
        # The mart has no clean natural key (cnpj and cd_cvm both repeat across
        # re-registrations) -> dedup to one row per cd_cvm, preferring an active,
        # higher-free-float record.
        """
        SELECT cnpj, cd_cvm, company_name, sector, status, issuer_status,
               ownership_control, tickers, listing_segment, has_active_ticker, free_float_pct,
               on_shares, pn_shares, total_shares
        FROM (
            SELECT *, row_number() OVER (
                PARTITION BY cd_cvm
                ORDER BY has_active_ticker DESC NULLS LAST, free_float_pct DESC NULLS LAST
            ) AS _rn
            FROM read_parquet('{src}')
        )
        WHERE _rn = 1
        """,
    ),
    ("mart_fund__indicators", "fund_indicators", "SELECT * FROM read_parquet('{src}')"),
    ("mart_fund__paper_indicators", "paper_indicators", "SELECT * FROM read_parquet('{src}')"),
    ("mart_fund__statements", "fund_statements", "SELECT * FROM read_parquet('{src}')"),
    ("mart_prices__adjusted", "prices", "SELECT * FROM read_parquet('{src}')"),
    ("mart_prices__stats", "price_stats", "SELECT * FROM read_parquet('{src}')"),
    (
        "mart_macro__indicators",
        "macro_indicators",
        "SELECT section, indicator_id, CAST(date AS DATE) AS date, value, unit, label, lineage "
        "FROM read_parquet('{src}')",
    ),
    (
        "mart_macro__cross_asset",
        "macro_cross_asset",
        "SELECT CAST(date AS DATE) AS date, indicator_id, value, unit, label, lineage "
        "FROM read_parquet('{src}')",
    ),
    (
        "mart_macro__regime",
        "macro_regime",
        "SELECT CAST(date AS DATE) AS date, indicator_id, value, unit, label, lineage "
        "FROM read_parquet('{src}')",
    ),
    ("mart_b3__dividends", "dividends", "SELECT * FROM read_parquet('{src}')"),
    ("mart_b3__events", "corporate_events", "SELECT * FROM read_parquet('{src}')"),
    ("mart_cvm__insider", "insider_moves", "SELECT * FROM read_parquet('{src}')"),
    ("mart_cvm__documents", "company_documents", "SELECT * FROM read_parquet('{src}')"),
    ("mart_bonds__tesouro", "tesouro_bonds", "SELECT * FROM read_parquet('{src}')"),
    ("mart_indices__quotes", "index_quotes", "SELECT * FROM read_parquet('{src}')"),
    ("mart_indices__composition", "index_composition", "SELECT * FROM read_parquet('{src}')"),
    ("mart_crypto__quotes", "crypto_quotes", "SELECT * FROM read_parquet('{src}')"),
    ("mart_macro__series", "macro_series", "SELECT * FROM read_parquet('{src}')"),
    ("mart_macro__series_catalog", "macro_series_catalog", "SELECT * FROM read_parquet('{src}')"),
    ("mart_macro__expectations", "macro_expectations", "SELECT * FROM read_parquet('{src}')"),
    ("mart_fii__profile", "fii_profile", "SELECT * FROM read_parquet('{src}')"),
    ("mart_fii__reports", "fii_reports", "SELECT * FROM read_parquet('{src}')"),
    ("mart_fii__distributions", "fii_distributions", "SELECT * FROM read_parquet('{src}')"),
    ("mart_fii__indicators", "fii_indicators", "SELECT * FROM read_parquet('{src}')"),
    ("mart_bdr__profile", "bdr_profile", "SELECT * FROM read_parquet('{src}')"),
    ("mart_options__quotes", "options_quotes", "SELECT * FROM read_parquet('{src}')"),
    ("mart_options__chain", "options_chain", "SELECT * FROM read_parquet('{src}')"),
]


def libpq_conn_string(url: str) -> str:
    """postgresql://user:pw@host:port/db  ->  libpq keyword string for ATTACH."""
    u = urlparse(url)
    parts = {
        "host": u.hostname or "localhost",
        "port": str(u.port or 5432),
        "dbname": (u.path or "/").lstrip("/") or "postgres",
        "user": unquote(u.username) if u.username else "postgres",
    }
    if u.password:
        parts["password"] = unquote(u.password)
    return " ".join(f"{k}={v}" for k, v in parts.items())


def load_table(con: duckdb.DuckDBPyConnection, table: str, source: str) -> int:
    cols = [row[0] for row in con.execute(f"DESCRIBE ({source})").fetchall()]
    collist = ", ".join(f'"{c}"' for c in cols)
    con.execute("BEGIN TRANSACTION")
    con.execute(f"DELETE FROM pg.public.{table}")
    con.execute(f"INSERT INTO pg.public.{table} ({collist}) SELECT {collist} FROM ({source})")
    con.execute("COMMIT")
    return con.execute(f"SELECT count(*) FROM pg.public.{table}").fetchone()[0]


def load_ingest_health(con: duckdb.DuckDBPyConnection) -> int:
    """Espelha os manifestos data/_runs/run-*.json na tabela serving `ingest_runs`.

    A API serve a Saúde dos dados a partir daí (Postgres), então qualquer pod a alcança
    sem volume compartilhado. DELETE+INSERT idempotente: a tabela reflete o diretório.
    `read_text` traz o JSON cru por arquivo; gravamos verbatim em `manifest` (text) e
    extraímos run_id/started_at p/ ordenar. Sem manifestos ainda → no-op silencioso.
    """
    files = sorted(RUNS_DIR.glob("run-*.json")) if RUNS_DIR.is_dir() else []
    if not files:
        print("  SKIP   ingest_runs        (nenhum manifesto em data/_runs)")
        return 0
    runs_glob = (RUNS_DIR / "run-*.json").as_posix()
    con.execute("BEGIN TRANSACTION")
    con.execute("DELETE FROM pg.public.ingest_runs")
    con.execute(
        f"""
        INSERT INTO pg.public.ingest_runs (run_id, started_at, manifest)
        SELECT json_extract_string(content, '$.run_id'),
               try_cast(json_extract_string(content, '$.started_at') AS TIMESTAMPTZ),
               content
        FROM read_text('{runs_glob}')
        WHERE json_extract_string(content, '$.run_id') IS NOT NULL
        """
    )
    con.execute("COMMIT")
    n = con.execute("SELECT count(*) FROM pg.public.ingest_runs").fetchone()[0]
    print(f"  LOADED ingest_runs        {n:>10,} runs")
    return n


def bump_cache_version() -> None:
    """Invalidate the API response cache by bumping its dataset version.

    The API namespaces every cache key by `dbcache:version`, so one INCR logically flushes
    the whole cache after a fresh load. Best-effort — never fails the load — but a missed
    bump is LOUD (stderr): it means the API keeps serving pre-load values until the next
    bump or TTL expiry.
    """
    if not CACHE_ENABLED:
        print("  cache bump skipped — CACHE_ENABLED=false (API runs without a response cache)")
        return
    try:
        import redis  # provided by the PEP-723 deps above

        version = redis.from_url(REDIS_URL).incr("dbcache:version")
        print(f"  cache invalidated — dbcache:version -> {version} ({REDIS_URL})")
    except Exception as exc:  # noqa: BLE001 — cache is best-effort, but warn loudly
        print(
            f"  WARNING: could not bump the API cache at {REDIS_URL}: {exc}\n"
            f"           the serving API may now return STALE pre-load values.\n"
            f"           fix: export REDIS_URL to the API's Redis (or CACHE_ENABLED=false if\n"
            f"           the API runs cache-less), or bump it manually:\n"
            f"           docker exec databolsa-redis redis-cli INCR dbcache:version",
            file=sys.stderr,
        )


def main() -> int:
    if not MARTS_DIR.is_dir():
        print(f"marts dir not found: {MARTS_DIR} — run `dbt build` first", file=sys.stderr)
        return 1

    con = duckdb.connect()
    con.execute("INSTALL postgres")
    con.execute("LOAD postgres")
    con.execute(f"ATTACH '{libpq_conn_string(DATABASE_URL)}' AS pg (TYPE postgres)")

    print(f"loading marts -> {DATABASE_URL}")
    total = 0
    missing: list[str] = []
    for mart, table, projection in LOADS:
        src = MARTS_DIR / f"{mart}.parquet"
        if not src.exists():
            print(f"  SKIP   {table:<18} (missing {src.name})")
            missing.append(src.name)
            continue
        source = projection.format(src=src.as_posix())
        t0 = time.perf_counter()
        n = load_table(con, table, source)
        total += n
        print(f"  LOADED {table:<18} {n:>10,} rows  ({time.perf_counter() - t0:5.1f}s)")

    # Saúde do ingest (manifestos _runs → ingest_runs). Fora do contrato de marts:
    # ausência não torna o serving "incompleto", então não entra no gate de `missing`.
    load_ingest_health(con)

    con.close()
    loaded = len(LOADS) - len(missing)
    print(f"done — {total:,} rows across {loaded}/{len(LOADS)} tables")

    # A missing mart means the serving DB is now incomplete relative to the contract.
    # Bumping the cache would advertise this partial state as fresh, so refuse: leave the
    # stale-but-complete cache in place and exit non-zero so the caller (cron/CI) notices.
    if missing:
        print(
            f"  ERROR: {len(missing)} expected mart(s) missing: {', '.join(missing)}\n"
            f"         the serving DB is INCOMPLETE — NOT bumping the cache.\n"
            f"         run `dbt build` to produce every mart, then re-run this loader.",
            file=sys.stderr,
        )
        return 1

    bump_cache_version()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
