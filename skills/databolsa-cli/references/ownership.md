# Ownership flow: who is buying

Fund position changes and insider trading on one timeline, and the four rules
that decide whether the answer is real.

`listOwnershipFlow <ticker>` answers "who has been buying this paper" month by
month, putting the change in fund positions next to insider trading on one
timeline. `listOwnershipMovers <ticker>` names the individual funds behind that
change, with `direction` (`in`, `out`, `all`). Four rules decide whether the
answer is real:

- **A delta only exists when the disclosure panel is comparable.** Funds report
  on different calendars, so a naive month-over-month difference reads a drop in
  who reported as selling. When the panel is not comparable, `funds_shares_delta`
  comes back null with the cause in `funds_delta_reason`. Read the two companion
  fields correctly: `funds_panel_n` is the NUMBER of funds present in both
  competencies, while `funds_panel_coverage_pct` is how much of the universe that
  panel covers, as a percentage from 0 to 100 (98.16 means 98.16%, not 0.98%).
  Never fill a null delta by subtracting the levels yourself, and never present a
  month whose `funds_delta_reason` is set as flat — it is unknown, not unchanged.
  `funds_appeared` and `funds_qty_undisclosed` count the funds deliberately cut
  from the delta: a fund that merely started disclosing has not bought anything.
- **Insider data is company-level, not ticker-level.** The same filing repeats on
  every ticker of the issuer, so a total that adds up all tickers double counts.
  Aggregate only rows where `is_issuer_anchor_ticker` is true.
- **`corporate_event_shares` is not trading.** It isolates share changes that came
  from corporate events (splits, bonuses, conversions). It is reported beside
  `net_shares` in `listInsiderMoves`, and as `insider_corporate_event_shares` in
  the ownership flow. Adding it to the net figure invents buying that never
  happened.
- **Flow in reais is `funds_value_flow_brl`.** The change in gross position value
  is not flow: it also contains price movement, and the two can carry opposite
  signs for the same month.

Months where only insider data exists come back with a null `comptc_date`.

`listFundLookThrough <cnpj>` adds a fund's direct position in a listed asset to
what reaches it through the fund shares it holds. Read the result as a FLOOR, not
a total: only part of the underlying portfolios can be opened, and the share that
was is in `indirect_coverage_pct`. Say "at least" when quoting it.

`listInvestedFunds <cnpj>` and `listFundInvestors <cnpj>` walk the fund-of-funds
graph in each direction. Where the weight of a position could not be computed,
`weight_reason` explains why — report it instead of treating the weight as zero.

```bash
npx --yes @databolsa/cli listOwnershipFlow PETR4 --from 2025-01-01 --json
npx --yes @databolsa/cli listOwnershipMovers PETR4 --direction in --json
```
