# DataBolsa local serving DB: Postgres 16 + pgvector + TimescaleDB.
#
# Slim alternative to timescale/timescaledb-ha (~600 MB vs ~5.4 GB). It's the
# stock postgres image (via pgvector/pgvector) so the runtime is standard:
# PGDATA=/var/lib/postgresql/data, honors POSTGRES_* and /docker-entrypoint-initdb.d.
# See docs/adr/0002-serving-db-timescale-pgvector.md.
FROM pgvector/pgvector:pg16

RUN set -eux; \
    apt-get update; \
    apt-get install -y --no-install-recommends ca-certificates gnupg wget; \
    codename="$(. /etc/os-release && echo "$VERSION_CODENAME")"; \
    echo "deb https://packagecloud.io/timescale/timescaledb/debian/ ${codename} main" \
        > /etc/apt/sources.list.d/timescaledb.list; \
    wget -qO - https://packagecloud.io/timescale/timescaledb/gpgkey \
        | gpg --dearmor -o /etc/apt/trusted.gpg.d/timescaledb.gpg; \
    apt-get update; \
    apt-get install -y --no-install-recommends timescaledb-2-postgresql-16; \
    # Bake the preload into initdb's template so `CREATE EXTENSION timescaledb`
    # succeeds in /docker-entrypoint-initdb.d on first boot (the temp init server
    # reads the generated postgresql.conf).
    echo "shared_preload_libraries = 'timescaledb'" >> "$(pg_config --sharedir)/postgresql.conf.sample"; \
    apt-get purge -y --auto-remove wget gnupg; \
    rm -rf /var/lib/apt/lists/* /etc/apt/sources.list.d/timescaledb.list
