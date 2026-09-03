---
name: databolsa-advisor-cli
description: Use the DataBolsa Advisor CLI to read or manage an advisory office's organizations, members, clients, portfolios, and audit trail. Discover current operations from the CLI and Advisor OpenAPI. Confirm all writes and keep client data within the requested scope.
license: Apache-2.0
compatibility: Node.js 18+ and network access. A DataBolsa Advisor member credential is required.
metadata:
  version: "3.8.0"
---

# DataBolsa Advisor CLI

Use `databolsa-advisor` as a thin client to the Advisor API. The Advisor
OpenAPI contract is separate from the market-data contract and defines the
current commands, schemas, permissions, and errors.

## Credentials and scope

Credentials must come from the environment. Never ask the user to paste or
print a key.

```bash
export DATABOLSA_ADVISOR_API_KEY="db_live_..."
export DATABOLSA_ADVISOR_WORKSPACE="<organization id>"
```

The personal key follows the member's role and client visibility.
`advisorGetMe` shows the organizations the credential can use. Other
operations take the organization id or slug as their first positional argument.

## Discover before calling

```bash
npx --yes @databolsa/advisor-cli --list
npx --yes @databolsa/advisor-cli advisorGetMe --help
npx --yes @databolsa/advisor-cli advisorGetMe --json
```

Use `--list` as the operation catalogue and `<operation> --help` as the shell
interface. When the exact request body, response field, enum, or error matters,
inspect only that operation or component in the live contract. Follow
[references/openapi.md](references/openapi.md).

Do not copy an operation inventory into the task, guess flags, or use a
market-data operation as an Advisor fallback.

## Workflow

1. Identify the organization with `advisorGetMe`.
2. Discover the smallest read operation that answers the request.
3. Inspect help and the schema before any write.
4. Preserve returned ids, timestamps, units, visibility, and audit metadata.
5. Use `--json` for filtering, comparison, or downstream tools.

Resources outside the organization or the member's client visibility answer
404; do not infer whether they exist. An expired license blocks writes with 402
while reads remain available. Portfolio positions are derived from the
transaction ledger, so correct the ledger rather than trying to set a position.

## Client data

Names, documents, profiles, restrictions, and portfolio values are personal
data controlled by the office. Retrieve and disclose only what the task needs.
Do not place them in public output, logs, source control, or unrelated tools.

## Writes

Every write changes the office's real data and enters its audit trail. Before
creating, updating, inviting, importing, reconciling, or deleting:

1. Show the target, effect, visibility, and reversibility.
2. Show the exact command without credentials.
3. Obtain explicit confirmation immediately before execution.
4. Confirm again if the target or payload changes.

Never write to test access. Use `--file <path>` only when the operation help
documents it and the user confirmed the file.

## Boundaries

The CLI does not execute trades or move money. Treat its output as evidence for
the professional's analysis, not advice to an end client. Market data lives in
the main `databolsa` CLI.
