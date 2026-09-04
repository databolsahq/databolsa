# Ownership flow: who is buying

Fund position changes and insider trading on one timeline, and the four rules
that decide whether the answer is real.

"Who has been buying this paper" is a series of the PAPER object: resolve the
ticker and ask `getObjectHistory` for the fund panel measures
(`funds_holders`, `funds_short_holders`, `funds_shares`, `funds_shares_delta`,
`funds_value_brl`, `funds_value_flow_brl`, `funds_value_price_effect_brl`,
`funds_implied_price`, `funds_entered`, `funds_exited`, `funds_increased`,
`funds_decreased`, `funds_opened_short`, `funds_closed_short`, `funds_panel_n`,
`funds_panel_coverage_pct`, `funds_qty_undisclosed`, `funds_partial_disclosure`,
`funds_appeared`). `listOwnershipMovers <ticker>` names the individual funds
behind that change, with `direction` (`in`, `out`, `all`). Four rules decide
whether the answer is real:

- **A delta only exists when the disclosure panel is comparable.** Funds report
  on different calendars, so a naive month-over-month difference reads a drop in
  who reported as selling. When the panel is not comparable the month simply has
  no `funds_shares_delta` point, and the reason lives in the paper property
  `funds_delta_reason` (read it with `getObjectProperties`). Read the two
  companion measures correctly: `funds_panel_n` is the NUMBER of funds present in
  both competencies, while `funds_panel_coverage_pct` is how much of the universe
  that panel covers, as a percentage from 0 to 100 (98.16 means 98.16%, not
  0.98%). Never fill a missing delta by subtracting the levels yourself, and never
  present a month with no delta as flat — it is unknown, not unchanged.
  `funds_appeared` and `funds_qty_undisclosed` count the funds deliberately cut
  from the delta: a fund that merely started disclosing has not bought anything.
- **Insider data is company-level, not ticker-level.** The same filing repeats on
  every ticker of the issuer, so a total that adds up all tickers double counts.
- **`corporate_event_shares` is not trading.** It isolates share changes that came
  from corporate events (splits, bonuses, conversions). It is reported beside
  `net_shares` in `listInsiderMoves`. Adding it to the net figure invents buying
  that never happened.
- **Flow in reais is `funds_value_flow_brl`.** The change in gross position value
  is not flow: it also contains price movement, and the two can carry opposite
  signs for the same month.

`listFundLookThrough <cnpj>` adds a fund's direct position in a listed asset to
what reaches it through the fund shares it holds. Read the result as a FLOOR, not
a total: only part of the underlying portfolios can be opened, and the share that
was is in `indirect_coverage_pct`. Say "at least" when quoting it.

The fund-of-funds graph is the `holds` edge: `listObjectLinks --rel holds
--direction out --other-kind fund` gives the funds a class invests in, and
`--direction in` gives the classes that invest in it. Where the weight of a
position could not be computed, `weight_reason` on the edge explains why — report
it instead of treating the weight as zero.

```bash
npx --yes @databolsa/cli getObjectHistory <paper-id> --facts funds_shares_delta,funds_value_flow_brl --json
npx --yes @databolsa/cli listOwnershipMovers PETR4 --direction in --json
```
