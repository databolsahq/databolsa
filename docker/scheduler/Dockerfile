# DataBolsa daily ingestion scheduler (local dev).
#
# Self-contained: the ingest + warehouse code and their venvs are baked into the
# image; only the data lake (./data) is bind-mounted at runtime. Rebuild after
# changing connector or dbt code:  docker compose build scheduler
#
# Runs as the host UID (compose `user:`) so files written into the mounted lake
# stay host-owned; the baked venvs are world-executable and dbt's target/logs go
# to /tmp, so nothing needs to write into the (root-owned) /app tree.
FROM python:3.12-slim

# uv for fast, reproducible installs
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_CACHE_DIR=/tmp/uv-cache \
    HOME=/tmp \
    # put the ingest venv on PATH so `databolsa-ingest` resolves as a bare command
    # (the crontab calls both venvs' binaries by absolute path regardless)
    PATH="/app/packages/ingest/.venv/bin:${PATH}"

# supercronic: cron built for containers (logs to stdout, runs unprivileged)
ARG SUPERCRONIC_VERSION=v0.2.33
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl \
    && curl -fsSLo /usr/local/bin/supercronic \
        "https://github.com/aptible/supercronic/releases/download/${SUPERCRONIC_VERSION}/supercronic-linux-amd64" \
    && chmod +x /usr/local/bin/supercronic \
    && apt-get purge -y curl && apt-get autoremove -y \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Each package gets its own in-image venv (.venv). ingest is an installable
# project (exposes the `databolsa-ingest` script); warehouse is package=false
# (uv installs only dbt-core/dbt-duckdb, giving .venv/bin/dbt).
COPY packages/ingest /app/packages/ingest
RUN cd /app/packages/ingest && uv sync --frozen --no-dev
COPY packages/warehouse /app/packages/warehouse
RUN cd /app/packages/warehouse && uv sync --frozen --no-dev

# The post-build Postgres loader (PEP-723 inline deps: duckdb + redis). The crontab
# runs it with `uv run scripts/load_postgres.py`; uv resolves its deps into the
# /tmp uv cache on first run.
COPY scripts /app/scripts

COPY docker/scheduler/crontab /app/crontab

# supercronic runs each job via $SHELL; slim images don't set it, so set it
# explicitly (otherwise it tries to exec "" → "failed to fork exec").
ENV SHELL=/bin/sh

CMD ["supercronic", "/app/crontab"]
