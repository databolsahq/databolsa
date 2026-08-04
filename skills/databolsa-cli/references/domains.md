# Surfaces and their traps

The full catalogue of what the API covers, with the per-surface rules that
change the answer. Read the entry for a surface before reporting figures from it.

Discover the current operation list at runtime, but expect these surfaces:

- **Brazilian equities:** profiles, TTM fundamentals, quarterly indicator history,
  OHLCV, intraday and delayed live quotes, dividends/JCP, corporate events, VWAP
  and trades, insiders, funds that hold an asset, and the monthly ownership flow
  that puts fund position changes and insider trades on one timeline.
- **FIIs:** profiles, indicator snapshots and history, distributions, monthly
  reports, and screening by segment and portfolio type.
- **Funds, ETFs, BDRs, and indexes:** catalogs, profiles, fund holdings and flows,
  the fund-of-funds graph in both directions (which funds a fund invests in, and
  which funds invest in it), look-through exposure to listed assets, BDR prices,
  index levels, and current index composition. An ETF profile carries `net_worth`,
  always to be reported with its `net_worth_date`: it is a snapshot from the fund's
  registration date, not today's. `quota_count_authorized` is a registered ceiling
  on quotas, not size — it runs orders of magnitude above the real figure.
- **Fixed income and macro:** Tesouro Direto rates and prices, nominal and real
  curves, market yield curves by tenor (DI futures plus pre/IPCA+/implied-inflation
  reference curves), primary Treasury auctions since 2000, fixed-income benchmark
  indexes (IMA-B, IRF-M families, since 2002), Focus expectations, macro regime,
  and macro gears. The series catalog is exactly four sources — `bcb_sgs`, `fred`,
  `world_bank`, `benchmark`. Focus, Tesouro Direto and the index families have
  their own operations and are not reachable through `listSeries`.
- **Commodities:** B3 futures on live cattle, arabica coffee, hydrous ethanol,
  corn, gold and soy — catalog, daily settlement series, and one session's
  settlement curve by maturity. These are settlement prices, not traded quotes.
- **Minerals:** production and reserves by country and year (USGS Mineral
  Commodity Summaries): 97 commodities, 115 countries, each with its share of the
  world total. Two traps. A mineral can publish several aggregates — copper splits
  mine and refinery production — so `detail` selects the cut and figures from
  different cuts must never be summed. And where countries declare on incompatible
  bases, the share comes back null with `share_basis: 'incomparable_basis'` by
  design: that null is the answer, not missing data.
- **Private credit:** the full debenture catalog (issuer, as-filed indexation,
  incentivada status, guarantees, maturities) with per-session secondary-market
  prices since 2013, a debenture screener (filter by indexer, spread, maturity,
  liquidity and institutional demand), fund-level look-through (which funds hold
  each debenture, with declared monthly buys/sells and the disclosure-panel size
  — never read holder drops without checking `funds_panel_n`), over-the-counter
  secondary trades by instrument family (CDB, CRI, CRA, LCI, LCA and more), and
  quarterly bank-issuer solvency (Basileia ratio, capital, credit portfolio)
  behind any CDB rate, and an observed credit-spread curve by tenor bucket
  (median as-filed spread of papers that actually traded, with the median
  price-vs-par as the repricing gauge). Each debenture also carries its issuer's
  link to the CVM registry (`issuer_cd_cvm`, `issuer_primary_ticker`,
  `issuer_categ_reg`), and `getIssuerProfile` resolves a CNPJ into what can be
  known about that issuer.
- **Credit ratings:** `listCreditRatings` returns the rating currently in force
  per (agency, paper), and `listCreditRatingHistory` returns every observed
  rating action for one ISIN or issuer CNPJ. These are facts read out of
  documents filed with public regulators, so every row carries `agency`,
  `action_date` and `download_url` — cite the document whenever you state a
  rating, and never present it as a DataBolsa rating. Three rules that change
  the answer: `rating_notch` (1 = best) compares only **within the same
  `scale`**, because a Brazilian issuer is routinely AAA on the national scale
  and BB on the global one at the same time; `action_date_known: false` means
  the ordering fell back to the filing date, so the agency's own date is
  unknown rather than equal to it; and a missing paper means no rating document
  has been read yet, which is not the same as the paper having no rating. When
  agencies disagree, report all of them — do not pick one. The optional
  `declared` block is the rating the securitizer itself wrote in its monthly CVM
  filing, kept alongside for cross-checking; `is_parseable: false` there means
  **not declared in the filing**, again never "no rating".
- **FIDC (receivables funds):** `listFidcs` for a monthly cross-section, plus
  `listFidcHistory`, `listFidcSeries`, `listFidcDelinquency` and `listFidcScr`
  per class. FIDCs have their own surface rather than appearing in `/funds`
  because their quota is marked to an appraisal and never passes through the
  daily filing that feeds ordinary funds. Four things that change the answer:
  the key is the **class**, not the fund, so a multi-class fund has one CNPJ per
  class; `entity_kind: null` marks filings before 2020-11, when the source keyed
  on the fund and the grain was different; the two delinquency series never sum,
  because in `*_with_risk` the originator is on the hook and in `*_no_risk` the
  fund eats the loss; and `impaired_ratio` is a share of the **portfolio**, and
  comes back null with `impaired_exceeds_portfolio: true` when the declared
  impaired amount exceeds the portfolio — the raw components stay in the
  response. Senior, mezzanine and subordinated quota series are distinct
  instruments and are never consolidated. `listFidcScr` returns **SCR** levels
  (CMN Resolution 2.682, AA–H) assigned by the institution itself: this is not
  an agency rating and is not comparable to `brAAA` — agency ratings live in
  `listCreditRatings`. `declares_scr: false` means the class declared no level
  at all, which is not the same as declaring zero in a band.
- **Structured notes (COE):** `listCoes` for the over-the-counter register
  (issuer, issue size, maturity, observed secondary activity) and `getCoe` for
  one instrument, keyed by its B3 instrument code — not the ISIN and not the
  commercial campaign name, neither of which the register carries. This is a
  **separate surface from credit on purpose**: a COE is a derivative payoff
  wrapped in the issuing bank's credit risk, so the holder carries both, and
  reading it as fixed income is the mistake the product's opacity relies on.
  Two rules that change the answer. First, this endpoint cannot tell you what a
  COE pays: capital protection, underlying, participation and return scenarios
  live in the DIE (the essential-information document), which is not public
  structured data — `indexer`, `indexer_pct` and `additional_rate_pct` are
  register fields, commonly literally `SEM REMUNERACAO`, and never describe the
  investor's return. State plainly that the payoff is not in the data rather
  than inferring it from those fields. Second, the secondary-market aggregates
  are not lifetime figures: they cover only the OTC sessions the data spans, and
  `meta.secondary_window` on `listCoes` reports that window (`from`, `to`,
  `sessions`). They do come back null for the overwhelming majority of papers,
  but the only claim that supports is "no registered trade inside the window" —
  read it against `sessions`, because while the window is short the nulls are
  driven by the window and not by the market. That a COE is designed to be held
  to maturity with no organised exit market is a property of the product, stated
  in the DIE, not something these aggregates measure — do not present the nulls
  as proof of illiquidity, and do not present them as proven full coverage
  either. `tradedOnly` isolates the ones that traded inside the window, not the
  ones that ever traded. What the data answers well is how much each issuer
  placed and at what tenor. Per-session COE trades live in `listOtcQuotes` with
  `family=COE` — that is the flow, this is the catalogue.
- **`listOtcQuotes` omits size in some families, and that is a disclosure rule,
  not missing data.** In CCB, LCA, LCI, CCI, CCCB, CDAWA and LC the exchange
  publishes prices and financial volume but withholds the traded size, so
  `quantity` and `trade_count` come back `null` while `volume_brl` is real. Never
  read that `null` as no trade, and never treat it as zero: size the session with
  `volume_brl`, and derive implied quantity as `volume_brl / price_avg` when the
  unit count is genuinely needed. CDB, DEB, CRI, CRA and COE do publish size.
- **Naming, so the surfaces do not get confused:** what a Brazilian investor
  calls *renda fixa* is split across three surfaces here, cut by **who owes**
  rather than by payoff shape. Sovereign paper and curves are Bonds
  (`listTesouroBonds`, `getYieldCurve`). Private-issuer paper is Credit
  (debentures, the OTC families CDB, CRI, CRA, LCI, LCA, and FIDC) — the
  contracted return is incidental to the issuer risk. COE is Estruturados, for
  the reason above. A portfolio uses a fourth, user-facing axis: asset types
  there are `renda_fixa` (bank and securitized paper such as CDB/LCI/LCA and
  CRI/CRA, symbol = the OTC instrument code), `debenture` (symbol = the trading
  code, e.g. ELTN17) and `tesouro`. Do not assume those labels line up with the
  contract's tags. `search` resolves private-credit codes too: debentures by
  trading code and CRI/CRA/LCI/LCA by OTC instrument code, alongside the other
  classes.
- **Portfolio analytics:** `getPortfolioXray` (one-call concentration breakdown —
  class, sector, fixed-income indexer, currency, top positions, deterministic
  flags), `getPortfolioLookThrough` (effective exposure opening fund
  positions through their latest disclosed monthly portfolios, one
  fund-of-funds hop, with per-fund coverage) and `getPortfolioCosts`
  (deterministic annual-cost estimate: fund admin fees vs the peer median for
  the same CVM classification, Tesouro Direto custody, and the gap of taxable
  bank paper contracted below 100% of CDI — each item names the recipient, and
  whatever is not observable comes back in `not_estimated` with the reason).
- **Derivatives and primary market:** option chains, expiries, option history, and
  public offerings.
- **Market activity:** daily and monthly investor participation by investor type.
- **Documents:** CVM/IPE company documents and semantic search over official
  company and FII documents.
- **Market events ledger:** point-in-time record of what mattered each day —
  structural acts (rate decisions, provisional measures, tariffs, geopolitics),
  multi-source press stories and abnormal price days, with sources, threads
  (event timelines), semantic search, and historical analogues.
- **Global and crypto:** US stocks and ETFs, SEC fundamentals and filings, B3
  links through BDRs, crypto catalogs, daily BRL candles, and near-live snapshots.
- **Authenticated account:** consolidated and individual portfolios, ledger,
  history, imports, suitability, and saved investment theses.
- **Account writes:** portfolio and transaction management, reconciliation, and
  thesis creation/import/update/publish/export.

If a requested surface is not in `--list`, inspect the live contract before
concluding it does not exist. Do not invent a fallback operation.
