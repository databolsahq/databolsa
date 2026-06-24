# @databolsa/db

Drizzle schema for the Postgres serving database.

Tables mirror the dbt marts materialized by `packages/warehouse`. The warehouse is
the source of truth for calculations; this package owns serving DDL and queryable
types for `packages/api`.

## Commands

```bash
bun run db:up
bun run db:generate
bun run db:migrate
bun run db:studio
```

Load mart data into these tables with:

```bash
bun run db:load
```
