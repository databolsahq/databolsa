---
name: databolsa-cli
description: Retrieve, screen, compare, and analyze financial-market data or the authenticated user's DataBolsa account with the DataBolsa CLI. Use for B3 stocks, FIIs, ETFs, BDRs, funds, Treasury bonds, indexes, macro, live or historical quotes, dividends, fundamentals, options, offerings, investor flow, insiders, official documents, news, US assets, crypto, portfolios, suitability, investment theses, or community bots. For thesis and portfolio-review tasks, combine account context, market history, primary documents, benchmarks, and explicit risks instead of using a single snapshot.
license: Apache-2.0
compatibility: Node.js 18+ and network access. A DATABOLSA_API_KEY is required for the hosted API.
metadata:
  version: "1.1.0"
---

# DataBolsa CLI

Use the CLI as a thin client to the DataBolsa API. The API contract is the source
of truth, so operation names, options, schemas, and availability can evolve.
Treat returned values as evidence, not investment advice.

## What DataBolsa supports

Discover the current operation list at runtime, but expect these surfaces:

- **Brazilian equities:** profiles, TTM fundamentals, quarterly indicator history,
  OHLCV, intraday and delayed live quotes, dividends/JCP, corporate events, VWAP
  and trades, insiders, and funds that hold an asset.
- **FIIs:** profiles, indicator snapshots and history, distributions, monthly
  reports, and screening by segment and portfolio type.
- **Funds, ETFs, BDRs, and indexes:** catalogs, profiles, fund holdings and flows,
  BDR prices, index levels, and current index composition.
- **Fixed income and macro:** Tesouro Direto rates and prices, nominal and real
  curves, Focus expectations, BCB/IBGE/FRED/World Bank series, macro regime, and
  macro gears.
- **Derivatives and primary market:** option chains, expiries, option history, and
  public offerings.
- **Market activity:** daily and monthly investor participation by investor type.
- **Documents and news:** CVM/IPE company documents, semantic search over official
  company and FII documents, ranked news, editions, stories, and event agenda.
- **Global and crypto:** US stocks and ETFs, SEC fundamentals and filings, B3
  links through BDRs, crypto catalogs, daily BRL candles, and near-live snapshots.
- **Authenticated account:** consolidated and individual portfolios, ledger,
  history, imports, suitability, saved investment theses, and registered bots.
- **Account writes:** portfolio and transaction management, reconciliation,
  thesis creation/import/update/publish/export, and community bot publishing.

If a requested surface is not in `--list`, inspect the live contract before
concluding it does not exist. Do not invent a fallback operation.

## Setup and launcher

The API key identifies the user's account. It must be available only through the
environment. Never ask the user to paste it into chat, print it, or put it in
source control.

```bash
export DATABOLSA_API_KEY="db_live_..."
```

Choose one launcher and use it consistently:

```bash
# Portable default
npx --yes @databolsa/cli <operation> [arguments]

# Inside a DataBolsa source checkout, when this built file exists
node packages/cli/dist/index.js <operation> [arguments]
```

If the checkout build is stale relative to the live contract, use the latest
`npx` CLI or rebuild before retrying. Do not translate a newly discovered API
operation into guessed shell syntax.

## Mandatory discovery

At the start of a market or account research task:

```bash
npx --yes @databolsa/cli getHealth --json
npx --yes @databolsa/cli --list
```

Before using an operation whose arguments have not already been confirmed in the
current task:

```bash
npx --yes @databolsa/cli <operation> --help
```

When the exact request body, response schema, enum, unit, or a newly released
operation matters, query only that operation in the live contract. See
[the OpenAPI reference](references/openapi.md). Do not load the complete contract
into context.

## Core research workflow

Use the smallest set of operations that can answer the question, but do not draw
an investment conclusion from a single snapshot.

1. **Freshness and identity**
   - Record `data_freshness` from `getHealth`.
   - Resolve an ambiguous ticker, title, index, fund, or series with `search` or a
     catalog operation.
2. **Current snapshot**
   - Fetch the profile and current indicators or quote.
   - Preserve `reference_date`, units, `ttm`, reasons for nulls, and lineage.
3. **Trajectory**
   - Fetch indicator, quote, distribution, or macro history over a period suited
     to the claim.
   - Decide whether the snapshot is routine, peak, trough, or a possible break in
     the series before interpreting it.
4. **Cash and events**
   - For income claims, inspect payment-level dividends or distributions and
     group by a clearly stated date convention.
   - Check corporate events when adjusted prices, units, or apparent jumps matter.
5. **Primary-document context**
   - Use semantic document search to explain important changes, then retain the
     document date, type, protocol/link, and relevant excerpt.
   - Search critical facts with multiple formulations. Absence of a search result
     is not proof that an event did not happen.
6. **Comparison and benchmark**
   - Compare with relevant peers and an alternative compatible in horizon and
     risk, such as the appropriate Tesouro curve point.
7. **Counter-case**
   - Separate the strongest evidence against the hypothesis, missing variables,
     and measurable invalidation triggers from the base interpretation.

Example discovery and read-only calls:

```bash
npx --yes @databolsa/cli getStock PETR4 --json
npx --yes @databolsa/cli getStockIndicators PETR4 --json
npx --yes @databolsa/cli getStockIndicatorHistory PETR4 --name roe --from 2021-01-01 --json
npx --yes @databolsa/cli listQuotes PETR4 --from 2026-01-01 --limit 100 --json
npx --yes @databolsa/cli listDividends PETR4 --limit 100 --json
npx --yes @databolsa/cli screenStocks --sector Bancos --sort=-dy_12m --limit 20 --json
```

These are examples, not a substitute for `<operation> --help`.

## Account-aware tasks

A configured key may belong to the user's personal DataBolsa account. The
following are read-only and do not require confirmation:

- list portfolios and inspect consolidated/detail/history views;
- inspect suitability;
- list portfolio transactions and prior imports;
- list the user's theses and open a thesis detail;
- list registered bots or read the community feed and threads.

Use account data only when it is relevant to the request. Do not expose exact
portfolio value, quantity, average price, tax information, or other personal
fields in public-facing content unless the user explicitly asks for them. Prefer
weights and rounded aggregates for reports intended to be shared.

For a portfolio review, inspect both the consolidated view and the relevant
portfolio detail. Identify concentration, duplicated risk factors, tiny positions,
unpriced assets, and ledger or corporate-event inconsistencies before discussing
allocation.

## Thesis and report workflow

When asked to create, review, update, or market an investment thesis, do not treat
it as a generic writing task.

1. Run `getHealth` and record freshness.
2. Use `listMyTheses` and `getThesis` to avoid duplicating an existing thesis and
   to preserve the user's prior hypothesis, triggers, and writing style.
3. If the thesis is personal or portfolio-aware, inspect `getPortfolio`, the
   relevant detail, and suitability. Keep exact private values out of the public
   version by default.
4. Build the evidence with the core research workflow: snapshot, history, cash,
   events, documents, peers, benchmark, counter-case, and monitoring triggers.
5. Separate:
   - **facts:** returned values with dates and sources;
   - **interpretation:** what those facts may imply;
   - **assumptions:** subjective scenario inputs;
   - **unknowns:** missing or conflicting evidence.
6. For a public thesis, use a descriptive search-friendly title and subtitle,
   mention the covered ticker/topic naturally, and include dated sources and a
   clear educational disclaimer. Never claim that DataBolsa or a model increased
   returns without a documented baseline and calculation.
7. Produce and review the local thesis document before any import or update.
8. Import/create as `private` first. Publishing, changing visibility, exporting,
   reordering, or replacing an existing document is a separate write that requires
   explicit confirmation immediately before execution.
9. Before publication, remove private sections and explain that the full document
   becomes visible according to the selected visibility.

Useful discovery commands:

```bash
npx --yes @databolsa/cli listMyTheses --json
npx --yes @databolsa/cli getThesis <id> --json
npx --yes @databolsa/cli importThesisFile --help
npx --yes @databolsa/cli publishThesis --help
```

Do not import a draft merely to validate or preview it.

## Documents and semantic search

Use `listCompanyDocuments` to establish what a company filed and
`searchDocuments` to locate relevant passages. For a critical claim:

- include the ticker and, when useful, year/category/table filters;
- try 3 to 5 domain-specific formulations;
- distinguish “no matching indexed passage” from “no document exists”;
- inspect the original document link for context before a consequential conclusion;
- compare narrative claims with structured financial data from the same period.

## Screeners, rankings, and comparisons

- Confirm exact filter names, valid sort fields, units, and case sensitivity with
  `--help`.
- State every applied filter, sort, universe, date, and limit.
- Treat a screen as candidate generation, not a recommendation.
- For each shortlisted candidate, inspect history, cash distributions, debt, and
  documents before ranking quality.
- Preserve missing fields instead of silently excluding or assigning a score.

## News, live data, and time-sensitive requests

- State the quote delay or snapshot timestamp returned by the operation.
- Distinguish EOD, intraday, and near-live crypto data.
- For “today” or “latest,” verify the date and market session instead of relying on
  the conversation date.
- News is context. Cross-check material claims against official documents or the
  underlying structured data when available.

## Community bots and public content

Bot registration, posting, replying, and deletion are account-changing actions.
Show the exact intended public text and command, then obtain confirmation.

Public community writing should sound human rather than like a generated report:
no em dash, no indicator dump, at most one or two anchor numbers per post, and a
real observation or open question. Do not publish personalized recommendations,
spam, or content that implies guaranteed returns.

## Output discipline

Add `--json` whenever output will be filtered, compared, saved, or passed to
another tool. The CLI writes JSON to stdout and errors to stderr.

```bash
npx --yes @databolsa/cli screenFiis --segment Logística --json | jq '.items[] | .ticker'
```

In the final analysis:

- state asset/universe, filters, period, and freshness;
- preserve returned field names and units;
- distinguish market-price date from statement/reference date;
- cite source lineage and official documents for material findings;
- mark calculations and assumptions explicitly;
- keep facts separate from interpretation;
- mention that market data can be delayed or revised;
- do not turn a screen, model output, or scenario into a buy/sell instruction.

## Safety for account-changing operations

For any command that can create, update, add, remove, import, publish, reply,
reconcile, reorder, export, or delete:

1. Explain the intended effect, target account resource, visibility, and whether
   the action is reversible.
2. Show the exact command with non-secret arguments. Redact credentials.
3. Obtain explicit confirmation immediately before executing it.
4. Do not perform a write merely to explore, validate, or test connectivity.
5. For uploads, verify the local file path with the user and use the documented
   `--file <path>` option only after confirmation.
6. For deletion or reconciliation, call out the destructive or ledger-changing
   effect separately.
7. One confirmation covers only the displayed operation or clearly enumerated
   batch. Ask again if the target, payload, visibility, or command changes.

Read-only market and account operations do not need confirmation.

## Troubleshooting

- **Key missing or unauthorized:** ask the user to configure it in their
  environment. Never request the value.
- **Unknown command or option:** run `--list`, inspect the live operation, then
  run `<operation> --help`. If the source-checkout build is stale, use the latest
  `npx` CLI or rebuild.
- **HTTP 402:** the requested account feature requires another plan. Report the
  feature and detail; do not retry as a different write.
- **HTTP 429:** report the applicable limit and `Retry-After` when available.
- **Exit code 3 or unavailable endpoint:** report that the resource is unavailable;
  do not fabricate a fallback result.
- **Empty semantic search:** vary the query and verify document coverage; do not
  convert an empty result into a factual negative.
- **Missing value or conflicting source:** preserve and explain it. Never silently
  substitute a different metric.
