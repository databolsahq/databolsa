---
name: databolsa-wallet-cli
description: Use the DataBolsa Wallet CLI to read or manage personal and organization portfolios, transactions, imports, reconciliation, costs, history, x-ray, and suitability. Discover current operations from the Wallet CLI and Wallet OpenAPI, protect financial data, and confirm every write.
license: Apache-2.0
metadata:
  version: "3.9.0"
---

# DataBolsa Wallet CLI

Use `@databolsa/wallet-cli` as a thin client to the Wallet API. Its OpenAPI
contract defines current operations, schemas, permissions, units, and errors.
Treat portfolio output as private financial data and evidence, not advice.

## Credentials and workspace

Read credentials from the environment. Never ask the user to paste or print a
key.

```bash
export DATABOLSA_API_KEY="db_live_..."
export DATABOLSA_WORKSPACE="<organization id>" # omit for personal workspace
```

An explicit inaccessible workspace returns `workspace_not_found`; never retry
it against the personal workspace.

## Discover before calling

```bash
npx --yes @databolsa/wallet-cli --list
npx --yes @databolsa/wallet-cli listPortfolios --help
```

Use `--list` as the catalogue and `<operation> --help` as the shell interface.
For an exact body, field, enum, unit, or error, inspect only that operation or
component in the live contract. Follow
[references/openapi.md](references/openapi.md).

`databolsa wallet <operation>` is a convenience alias for the same contract.
Prefer the standalone package in scripts. Do not infer that other extensions
are main-CLI subcommands.

Discovery does not prove Wallet access. List and help can work while a real call
returns:

- `404 wallet_not_installed` when Wallet is unavailable;
- `403 wallet_suspended` for writes while suspended; reads remain available;
- `403 wallet_scope_missing` or `wallet_resource_forbidden` without access.

Report the error without probing another workspace or claiming the resource
does not exist.

## Workflow

1. Confirm personal or organization workspace.
2. Discover the smallest read operation that answers the request.
3. Inspect help and the relevant schema; do not guess flags or bodies.
4. Use `--json` for filtering, comparison, or downstream processing.
5. Preserve ids, identity, dates, currencies, units, nulls, valuation method,
   and quality flags.
6. Separate returned facts from calculations and interpretation.

Positions are computed from the transaction ledger. Correct transactions or use
documented reconciliation instead of trying to overwrite a computed position.

## Privacy and writes

Retrieve and disclose only data required by the task. Prefer percentages and
aggregates when exact quantities, costs, or total wealth are unnecessary. Do not
place portfolio data in public output, logs, source control, or unrelated tools.

Before any create, update, import, reconcile, or delete:

1. Inspect `<operation> --help` and the request schema.
2. Explain target, effect, visibility, and reversibility.
3. Show the exact command without credentials.
4. Obtain explicit confirmation immediately before execution.
5. Confirm again if the target, file, workspace, or payload changes.

Never write to test access. Use `--file <path>` only when help documents it and
the user confirmed the file. The CLI does not execute trades or move money.
