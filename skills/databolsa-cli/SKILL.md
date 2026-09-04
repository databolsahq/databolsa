---
name: databolsa-cli
description: Use the DataBolsa CLI to retrieve, screen, compare, and analyze current, sourced financial-market data. Covers market assets, macro, documents, events, screeners, ownership, and the object graph. Discover operations from the CLI and OpenAPI instead of relying on a fixed command list; route Wallet, Advisor, and Credit Desk work to their dedicated skills.
license: Apache-2.0
compatibility: Node.js 18+ and network access. A DATABOLSA_API_KEY is required for the hosted API.
metadata:
  version: "3.12.0"
---

# DataBolsa CLI

Use the CLI as a thin client. The loaded OpenAPI contract defines the current
operations, parameters, schemas, units, and availability. Treat responses as
evidence, not investment advice.

## Keep credentials out of the conversation

The API key must come from the environment. Never ask the user to paste it,
print it, or save it in source control.

```bash
export DATABOLSA_API_KEY="db_live_..."
```

Run with `npx --yes @databolsa/cli`, or with `databolsa` when installed
globally.

## Choose the contract

- Market data, documents, events, and the object graph:
  `databolsa <operation>`.
- Personal or organization portfolios and suitability use the separate
  `databolsa-wallet-cli` skill. The main CLI's `databolsa wallet <operation>`
  form remains a convenience alias for that contract.
- An advisory office uses the separate `databolsa-advisor-cli` skill.
- A credit desk uses the separate `databolsa-credit-cli` skill.

Do not guess an operation across contracts.

## Discover before calling

At the start of a research task:

```bash
npx --yes @databolsa/cli getHealth --json
npx --yes @databolsa/cli --list
```

Before using an operation whose syntax was not confirmed in the current task:

```bash
npx --yes @databolsa/cli <operation> --help
```

The help is the shell interface. When an exact request body, response field,
enum, unit, or new operation matters, inspect only that operation or component
in the live OpenAPI contract. Follow [references/openapi.md](references/openapi.md);
do not load the whole contract into context.

If an operation is absent from `--list`, inspect the live contract before
concluding the data does not exist. Never invent a fallback command.

## Research workflow

1. Record API freshness and the relevant reference dates.
2. Resolve identity before joining data. Prefer the object graph when the task
   connects an issuer, instrument, fund, index, indicator, or series.
3. Read the chosen operation's description and response-field descriptions.
   They carry grain, units, null semantics, coverage, and domain caveats.
4. Use the smallest set of calls that answers the question. Add history,
   comparison, or primary documents when a snapshot cannot support the claim.
5. Preserve source lineage, timestamps, units, missing values, and quality flags.
6. Separate returned facts from calculations and interpretation.

Before reporting domain figures, read
[references/domains.md](references/domains.md). It explains what to inspect
without duplicating the API catalogue.

Load a focused reference only when the task needs it:

| Task | Reference |
| --- | --- |
| Search or quote official filings | [references/documents.md](references/documents.md) |
| Explain a dated event or find analogues | [references/events.md](references/events.md) |
| Analyze who has been buying or selling | [references/ownership.md](references/ownership.md) |
| Read public offerings | [references/offerings.md](references/offerings.md) |

## Output

Use `--json` whenever output will be filtered, compared, saved, or passed to
another tool. Lists normally return items in `data` and pagination/query context
in `meta`; single resources normally return the object directly. Confirm the
actual schema instead of assuming the envelope.

In the final answer:

- state the object or universe, filters, period, and freshness;
- preserve returned field names and units;
- distinguish market date, reference date, and filing date;
- cite source lineage and primary documents for material claims;
- label calculations and assumptions;
- retain nulls and quality warnings;
- do not turn a screen or scenario into a buy/sell instruction.

## Account data and writes

Read-only market and account operations do not need confirmation. Use account
data only when relevant, and do not expose exact values, quantities, documents,
or tax information beyond the user's request.

Before any create, update, import, reconcile, publish, or delete operation:

1. Inspect `<operation> --help` and the request schema.
2. Explain the target, effect, visibility, and reversibility.
3. Show the exact command without credentials.
4. Obtain explicit confirmation immediately before execution.
5. Confirm again if the target or payload changes.

Never perform a write to test connectivity. For uploads, use `--file <path>`
only after confirming the local file and operation.

## Failures

- Missing or unauthorized key: ask the user to configure the environment, not
  reveal the key.
- Unknown command or option: refresh `--list`, then inspect `--help` and the
  live contract.
- 402: report the plan or license restriction; do not retry as another write.
- 429: respect `Retry-After` when returned.
- Unavailable endpoint or empty search: report the limit of the evidence; do not
  fabricate a result or convert absence into a factual negative.
