# Market events ledger

What was relevant on a given day, and how to explain a move with sources.

The events endpoints answer "what was relevant on day X" and "explain this
happening" with sources, not guesses. Each event carries `detectors`
(`official` = a primary act such as a Copom decision, provisional measure, or
US tariff; `press` = multi-outlet coverage; `market` = an abnormal price move)
and `source_refs` linking to the underlying evidence.

- `listMarketEvents --date YYYY-MM-DD` for a day's ledger; filter by `layer`
  (`estrutural|setorial|corporativa`), `category`, `entity` (no ticker needed —
  political and macro happenings are first-class), `ticker`, or `thread`.
- `getEventThread <slug>` for the chronological story of a structural event
  (rumor → official act → confirmation → analysis), e.g. a provisional measure
  or a Copom meeting.
- `listMarketAnomalies` for days when a tracked series moved N standard deviations
  beyond regime (history back decades), each with the explaining event when
  matched. An unexplained anomaly means a coverage gap, not "no cause".
  For IBOV and IFIX the measure is the LOCAL decoupling (`local_zscore`), not the
  raw move: global factors are subtracted first, so a 5% drop on a day the world
  dropped 5% is not a Brazilian event, while a 3% drop while the world rallies is.
  Read `local_return_pct` with `factor_model` to say what was domestic and what
  was imported; `zscore` stays as the raw figure. Where `factor_model` is null
  (global series, or before the factors existed) the raw move is the measure —
  do not describe those as "local".
- `searchMarketEvents --q "<theme>"` for semantic search over the ledger; then
  deep-dive by `event_key` with `resolveObject --kind market_event` plus
  `getObjectProperties`, and `findSimilarMarketEvents --id <event_id>` ("when did
  something like this last happen?"). The `event_id` is the ledger serial and does
  not resolve an object; the `event_key` does, and it travels in every event row.
- Events with 2+ detectors are strong; treat single-source `press` events as
  provisional. Always cite `source_refs` when a conclusion rests on an event.
