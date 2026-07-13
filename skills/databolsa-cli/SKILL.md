---
name: databolsa-cli
description: Retrieve, screen, and analyze Brazilian financial-market data with the DataBolsa CLI. Use when asked for B3 stocks, FIIs, ETFs, BDRs, funds, Treasury bonds, indexes, macro data, quotes, dividends, fundamentals, or portfolio data from DataBolsa. Discover the current CLI commands and parameters from the live OpenAPI contract instead of guessing them.
license: Apache-2.0
compatibility: Node.js 18+ and network access. A DATABOLSA_API_KEY is required for the hosted API.
metadata:
  version: "1.0.0"
---

# DataBolsa CLI

Use the CLI as a thin client to the DataBolsa API. It loads the current API contract, so command names and options may evolve. Treat returned values as data, not investment advice.

## Setup

The API key must be available only through the environment. Never ask the user to paste it into chat, print it, or put it in source control.

```bash
export DATABOLSA_API_KEY="db_live_..."
```

Run commands with one of these launchers:

```bash
# Normal use, no global install
npx --yes @databolsa/cli <command> [arguments]

# If working inside a checkout of the DataBolsa repository
node packages/cli/dist/index.js <command> [arguments]
```

Use the second form only when that file exists. The first form is the portable default.

## Workflow

1. Confirm connectivity and inspect freshness:

   ```bash
   npx --yes @databolsa/cli getHealth --json
   ```

2. Discover the current command rather than inventing a path, option, filter, or unit:

   ```bash
   npx --yes @databolsa/cli --list
   npx --yes @databolsa/cli <command> --help
   ```

3. For analysis, request raw structured output and inspect it before drawing conclusions:

   ```bash
   npx --yes @databolsa/cli getStock PETR4 --json
   npx --yes @databolsa/cli getStockIndicators PETR4 --json
   npx --yes @databolsa/cli listQuotes PETR4 --from 2026-01-01 --limit 20 --json
   npx --yes @databolsa/cli listDividends PETR4 --limit 20 --json
   npx --yes @databolsa/cli screenStocks --sector Bancos --sort=-dy_12m --limit 20 --json
   ```

4. State the asset, applied filters, date/range, and any `data_freshness` returned by `getHealth`. Preserve missing values as missing; do not infer them or silently substitute a different metric.

5. Keep factual findings separate from interpretation. Mention that market data can be delayed or revised and do not present a screen or ranking as a buy/sell recommendation.

## Output and shell use

- Add `--json` whenever the result will be filtered, compared, saved, or passed to another tool. The CLI writes JSON to stdout and errors to stderr, so it is safe to pipe:

  ```bash
  npx --yes @databolsa/cli screenFiis --segment Logística --json | jq '.items[] | .ticker'
  ```

- Without `--json`, objects are rendered as key/value output and lists as compact tables, useful for a quick human check.
- Use the exact option spelling shown by `<command> --help`. Filters are not necessarily case-insensitive; for example, a sector filter can require an exact value.
- Use `--api-url <url>` only when the user explicitly requests another DataBolsa-compatible API origin.

## Safety for account-changing commands

Some commands read or modify a user's portfolio, import a file, publish community content, or delete data. For any command that can create, update, import, publish, reconcile, or delete:

1. Explain the intended effect and show the exact command with non-secret arguments.
2. Obtain explicit confirmation immediately before executing it.
3. Do not run destructive actions, imports, or writes merely to explore the CLI.
4. For an upload, verify the local file path with the user. Use the documented `--file <path>` option only after confirmation; it encodes the selected file for the request.

Read-only commands such as asset profiles, quotes, distributions, indicators, catalog listings, and screens do not need confirmation.

## Troubleshooting

- **`DATABOLSA_API_KEY` missing or unauthorized:** ask the user to configure their key in their environment; never request the key value.
- **Unknown command or option:** run `--list` or `<command> --help` and retry with the documented name.
- **Exit code 3 / unavailable endpoint:** report that the resource is not available in the current API preview; do not fabricate a fallback result.
- **Using a DataBolsa source checkout and `npx` cannot find `databolsa`:** run `node packages/cli/dist/index.js ...` from the repository root, or run the portable `npx` command from outside that checkout.
