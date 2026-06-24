# @databolsa/api

Serving API over the Postgres marts loaded from `data/marts`.

The API is intentionally thin: routing, validation, auth seam, cache and
serialization live here; financial calculations stay in `packages/warehouse`.

## Run

```bash
bun run db:up
bun run db:load
bun run api:dev
```

Useful endpoints:

- `GET /` service metadata.
- `GET /openapi.json` live generated contract.
- `GET /v1/health` public health/freshness check.

## Contract

Routes carry OpenAPI metadata in code. Regenerate the checked-in YAML after route
or schema changes:

```bash
bun run gen:api
```

The generated file is `api/openapi.yaml`.
