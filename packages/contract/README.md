# @databolsa/contract

Shared Zod schemas for API validation and OpenAPI generation.

This package defines response/request shapes reused by `packages/api` and by
generated consumers. It should describe the public API contract, not contain data
access or business logic.

## Check

```bash
bun run --cwd packages/contract typecheck
```
