---
name: databolsa-credit-cli
description: Use the DataBolsa Credit CLI to read or manage a private-credit desk's organizations, members, watchlists, monitoring grids, alerts, notes, regulation terms, and audit trail. Discover current operations from the Credit CLI and Credit OpenAPI, preserve source units, protect desk data, and confirm every write.
license: Apache-2.0
metadata:
  version: "3.8.0"
---

# DataBolsa Credit CLI

Use `@databolsa/credit-cli` as a thin client to the Credit Desk API. Its
OpenAPI contract is separate from market data, Wallet, and Advisor and defines
current operations, schemas, permissions, units, and errors.

## Credentials and desk

Read credentials from the environment. Never ask the user to paste or print a
key.

```bash
export DATABOLSA_CREDIT_API_KEY="db_live_..."
export DATABOLSA_CREDIT_WORKSPACE="<organization id>"
```

Use the personal member credential only within the organizations and role it
returns. A resource outside that scope answers 404; do not infer whether it
exists or probe another organization.

## Discover before calling

```bash
npx --yes @databolsa/credit-cli --list
npx --yes @databolsa/credit-cli deskGetMe --help
npx --yes @databolsa/credit-cli deskGetMe --json
```

Use `--list` as the catalogue and `<operation> --help` as the shell interface.
For an exact body, field, enum, unit, or error, inspect only that operation in
the live contract. Follow [references/openapi.md](references/openapi.md).

Do not guess operations, copy a fixed inventory, or use another contract as a
fallback.

## Workflow

1. Use the current identity operation to discover accessible desks and roles.
2. Confirm the target organization before reading sensitive data.
3. Discover the smallest operation that answers the request.
4. Inspect help and schema before interpreting or writing.
5. Use `--json` for filtering, comparison, or downstream processing.
6. Preserve ids, reference dates, provenance, nulls, units, and audit metadata.
7. Separate returned facts from calculations and interpretation.

Follow contract descriptions exactly: ratios commonly travel as fractions,
while some source fields use percentages. Missing data is `null`, never zero.
Do not silently normalize either convention.

## Privacy and writes

Desk membership, notes, alerts, thresholds, and research context may be
confidential. Retrieve and disclose only what the task needs. Do not place desk
data in public output, logs, source control, or unrelated tools.

Every write is audited. Before creating, updating, inviting, acknowledging,
reviewing, or deleting:

1. Inspect `<operation> --help` and the request schema.
2. Explain target, effect, visibility, and reversibility.
3. Show the exact command without credentials.
4. Obtain explicit confirmation immediately before execution.
5. Confirm again if the target, workspace, or payload changes.

Never write to test access. An inactive license returns 402 for writes while
reads remain available; report it instead of retrying another write. Use the
main DataBolsa CLI for public market data. The CLI does not execute trades or
move money.
