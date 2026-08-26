---
name: databolsa-cli
description: Retrieve, screen, compare, and analyze financial-market data or the authenticated user's DataBolsa account with the DataBolsa CLI. Use for B3 stocks, FIIs, ETFs, BDRs, funds, Treasury bonds, debentures and private credit, credit ratings, receivables funds (FIDC), structured notes (COE), yield curves, fixed-income benchmarks, indexes, macro, live or historical quotes, dividends, fundamentals, options, offerings, investor flow, fund ownership and insiders, official documents, US assets, crypto, portfolios, suitability, or investment theses. For thesis and portfolio-review tasks, combine account context, market history, primary documents, benchmarks, and explicit risks instead of using a single snapshot.
license: Apache-2.0
compatibility: Node.js 18+ and network access. A DATABOLSA_API_KEY is required for the hosted API.
metadata:
  version: "3.6.5"
---


# DataBolsa CLI

Use the CLI as a thin client to the DataBolsa API. The API contract is the source
of truth, so operation names, options, schemas, and availability can evolve.
Treat returned values as evidence, not investment advice.

## Surfaces

Brazilian equities · FIIs and FIAGROs · funds, ETFs, BDRs and indexes · fixed income and macro
(Tesouro Direto, yield curves, Focus, benchmark indexes) · commodities · minerals ·
private credit (debentures, OTC families, FIDC, credit ratings, issuer solvency) ·
structured notes (COE) · derivatives and public offerings · investor flow ·
official documents and semantic search · the market events ledger · ownership flow ·
US assets and crypto · the authenticated account (portfolios, suitability, theses)
and its writes.

Discover the current operation list at runtime — `--list` is the truth, this is a
map. If a requested surface is not there, inspect the live contract before
concluding it does not exist. Do not invent a fallback operation.

**Almost every surface has a rule that changes the answer**: an ETF's `net_worth`
is a registration-date snapshot, minerals from different `detail` cuts must never
be summed, a COE's payoff is simply not in the data, FIDC delinquency series never
add up, a receivables fund's sector rows arrive in two layers where the second
re-opens the first and summing both double-counts the portfolio, the same
receivables originator is listed under both risk blocks of one fund so its
weights must not be added, a receivables fund's seniority cascade may only be
summed when `cascade_observable` is true because the source leaves most senior
tranches without a quota value and the sum would silently read as fully
subordinated, amortisation is not redemption and stays out of a
fund's net flow, a rating's
`rating_notch` compares only within the same `scale`, and
`listOtcQuotes` withholds size in seven families by disclosure rule rather than by
gap, a share is a different object from the company that issued it so `PETR4`
resolves to the share and not to Petrobras, and an economic indicator is a
different object from the series that publishes it. Read
[references/domains.md](references/domains.md) for the surface you are
about to report on, before reporting on it.

## Load a reference when the task calls for it

Keep this file in context; pull the rest on demand.

| Reference | Load it when |
| --- | --- |
| [domains.md](references/domains.md) | reporting figures from any surface — it carries the per-surface traps |
| [openapi.md](references/openapi.md) | the exact request body, response schema, enum, or a newly released operation matters |
| [theses.md](references/theses.md) | creating, reviewing, updating, or publishing an investment thesis |
| [documents.md](references/documents.md) | searching official filings or quoting a document |
| [events.md](references/events.md) | explaining what happened on a day, or finding a historical analogue |
| [ownership.md](references/ownership.md) | asking who has been buying or selling a paper |
| [offerings.md](references/offerings.md) | reading public offerings (`listOfferings`) |

## Setup and launcher
The API key identifies the user's account. It must be available only through the
environment. Never ask the user to paste it into chat, print it, or put it in
source control.

```bash
export DATABOLSA_API_KEY="db_live_..."
```

Run without a global install:

```bash
npx --yes @databolsa/cli <operation> [arguments]
```

Or, if the published package is installed globally:

```bash
databolsa <operation> [arguments]
```

Do not translate a newly discovered API operation into guessed shell syntax.

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
   - `getStock` reports whether the code is still traded: `active: false` means the
     ticker was retired by a succession, with `successor`, `renamed_at`,
     `succession_type` (`rename` = 1:1 code change, `incorporation` = merger) and
     `succession_ratio` (shares of the successor per unit of the old code). The
     `company.tickers` list carries the same fields per class. Never quote a retired
     code as a current price: its `latest_quote` is frozen at the succession date —
     read the successor instead, and convert quantities by the ratio.
   - `trading_status` reports the issuer's standing as flagged by the exchange:
     `regular`, `recuperacao_judicial`, `recuperacao_extrajudicial`, `sancionada`
     or `concordataria`, with `trading_status_since` for the current spell. It is
     NOT a trading halt — a company under court-supervised reorganization keeps
     trading normally. Say so when reporting such a name: valuation multiples on a
     distressed issuer mean something different, and the reader deserves the flag.
   - Check `sessions_behind` before quoting any price. It counts market sessions
     between the quote and the latest session: `0` is current, anything higher is
     the last known trade of an illiquid or halted paper, frozen. In that case
     `change_pct` comes back null on purpose — there is no variation for today —
     so never present a frozen quote as a daily move.
2. **Current snapshot**
   - Fetch the profile and current indicators or quote.
   - Preserve `reference_date`, units, `ttm`, reasons for nulls, and lineage.
   - For historical or backtest reads, `getStockIndicators --at <date>` is
     point-in-time by publication: it returns the latest statement already FILED
     with the regulator on that date (`filed_at` in the response), and `price`
     reflects the closest trading session on or before the date. When `filed_at`
     is null the cutoff falls back to the accounting period — say so when the
     distinction matters. Price-derived indicators (`beta`, `volatilidade`,
     `retorno_12m`, `volume_medio_2m`) have no historical series: under a
     historical `--at` they come back null with an explicit `reason` instead
     of leaking today's value — never present them as values for that date.
     `free_float` comes from the CURRENT registry (no dated series), so it is
     null under any `--at`.
   - For structured statement series (revenue, EBITDA, net income, cash, debt,
     equity, TTM flows), use `listCompanyStatements <ticker, CVM code or CNPJ>`
     (all three resolve) with `from`/`to`
     on the accounting period and `filed_at` per row for point-in-time cuts,
     instead of scraping numbers from document text.
   - Reach for the 14-digit CNPJ when the issuer has no ticker. A company
     registered with the regulator only to issue debt files the same quarterly
     statements as a listed one and never gets a ticker, and debt instruments
     identify their issuer by CNPJ — so ticker lookup finds nothing and the
     absence reads like "no data" when the full statement series is there.
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
- list the user's theses and open a thesis detail.

Use account data only when it is relevant to the request. Do not expose exact
portfolio value, quantity, average price, tax information, or other personal
fields in public-facing content unless the user explicitly asks for them. Prefer
weights and rounded aggregates for reports intended to be shared.

For a portfolio review, inspect both the consolidated view and the relevant
portfolio detail. Identify concentration, duplicated risk factors, tiny positions,
unpriced assets, and ledger or corporate-event inconsistencies before discussing
allocation.

`getPortfolioDetail` responds compact by default: closed positions and the
per-holding monthly series are omitted. Pass `include=closed,monthly` (composable
with `transactions`) when the review needs realized history or per-asset monthly
income. Each holding carries `valuation` telling how it was priced — market
quote, fixed-income accrual, or cost — treat cost-valued positions as unpriced
when discussing performance. Portfolios accept stocks, FIIs, BDRs, ETFs, options,
Tesouro titles, crypto, US assets, private fixed income (`renda_fixa`),
debentures/CRI/CRA matched to the catalog (`debenture`), and funds by CNPJ
(`fund`).

Portfolio totals are always in BRL. A holding traded in another currency (today,
`asset_type=us` in USD) also carries a `native` block with the same position in
that currency, and the portfolio carries the `fx` rate that converted it. The two
returns answer different questions and both are correct: `unrealized_pct` includes
the currency move, because each purchase was converted at the rate of its own trade
date, while `native.unrealized_pct` is the asset's own return. Report whichever the
question asks for, and say which one you used. Do not derive the native figures by
dividing the BRL ones by `fx.usd_brl` — that rate is the spot used for marking, not
the historical rate behind the cost basis. For the same reason, `transactions[]`
comes raw in the trade currency: read `transactions[].currency` before formatting a
ledger price.

## Screeners, rankings, and comparisons
- Confirm exact filter names, valid sort fields, units, and case sensitivity with
  `--help`.
- State every applied filter, sort, universe, date, and limit.
- Treat a screen as candidate generation, not a recommendation.
- For each shortlisted candidate, inspect history, cash distributions, debt, and
  documents before ranking quality.
- Preserve missing fields instead of silently excluding or assigning a score.
- Never add up `net_worth` across fund classes to size a manager or a segment. Brazilian
  funds are structured master/feeder, so the feeder reports the money and the master
  reports it again. Filter funds by manager with `manager`, and take the house total from
  `listFundManagers`, whose `net_worth_net` removes what a house allocates into its own
  classes. Say which of the two figures you are quoting; `net_worth_net` is still a floor,
  because it can only discount what was disclosed.
- Identify a manager by `manager_cnpj` (on a fund) or `registry.cnpj` (on a manager row),
  never by matching the published name. The name is the regulator's spelling and changes
  with corporate reorganizations, so two spellings of one house are two rows. `registry`
  also says where the house is, what it is licensed to do, and since when it operates; it
  is null when the manager is an individual or runs under another entity's license.

## Live data and time-sensitive requests
- State the quote delay or snapshot timestamp returned by the operation.
- Distinguish EOD, intraday, and near-live crypto data.
- For “today” or “latest,” verify the date and market session instead of relying on
  the conversation date.
- Read `sessions_behind` before calling a quote or an intraday series “current.”
  Quotes and intraday series report it; `0` means the current session, and anything
  greater means the payload describes an older session. Without an explicit
  `session`, an intraday series returns the most recent one available, which is not
  necessarily the market's latest — say which session you are quoting.
- Cross-check material claims against official documents or the underlying
  structured data when available.

## Output discipline
Add `--json` whenever output will be filtered, compared, saved, or passed to
another tool. The CLI writes JSON to stdout and errors to stderr.

Every listing and every series answers the same envelope: the items in `data`, and
in `meta` the pagination (`next_cursor`, `count`) plus the query context (ticker,
session, indicator, reference date). Filter with `.data[]` regardless of the
operation; single resources answer the object directly, without `data`.

```bash
npx --yes @databolsa/cli screenFiis --segment Logística --json | jq '.data[] | .ticker'
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
  run `<operation> --help`. Update the published CLI package if the installed
  command is older than the live contract.
- **HTTP 402:** the requested account feature requires another plan. Report the
  feature and detail; do not retry as a different write.
- **HTTP 429:** report the applicable limit and `Retry-After` when available.
- **Exit code 3 or unavailable endpoint:** report that the resource is unavailable;
  do not fabricate a fallback result.
- **Empty semantic search:** vary the query and verify document coverage; do not
  convert an empty result into a factual negative.
- **Missing value or conflicting source:** preserve and explain it. Never silently
  substitute a different metric.
- **`getIssuerRisk` returns 404:** solvency ratios exist only for banks supervised
  by the central bank, so a corporate issuer has none by definition, not by gap.
  Call `getIssuerProfile` with the same CNPJ: `kind` tells you which universe the
  issuer belongs to, and a `corporate` issuer with a `cd_cvm` has financial
  statements and filed documents to read instead. Report the absence as a
  different kind of issuer, never as missing data.
