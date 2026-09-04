# Public offerings

Reading the CVM offering registry as objects, without producing plausible wrong
numbers.

The offering is an object (`kind=offering`). `listObjects --kind offering
--total` enumerates the registry with the filing on the row — `family`,
`instrument`, `offering_type`, `rite`, `regime`, `registration_regime`,
`numero_processo`, `numero_requerimento`, `series`, `issue`, `tax_incentive` and
the two sentinel guards. `rankObjects --kind offering --fact offering_amount
--since 1995-01-01` orders by size, with `offering_quantity` and
`offering_unit_price` in the same batch; the issuer comes off the `issued` edge.

The registry unifies regulatory regimes whose vocabularies differ, and reading it
as one flat table produces plausible wrong numbers. Three rules:

- Filter and group by `family` or `instrument`, never by `asset_type_as_filed`.
  The source spells the same instrument several ways depending on the regime, so
  `instrument=debenture` returns the whole set while a single spelling returns a
  fraction of it. `asset_type_as_filed` is provenance, not a filter.
- Build time series on the fact's own date. Restricted-effort offerings carry no
  registration date, so a window anchored on registration silently drops them —
  and they are a large share of the years before 2023. `registration_regime`
  separates registered offerings from exempt ones when that distinction matters.
- Before summing `offering_amount`, exclude `value_is_sentinel` and
  `value_pre_real_currency`. It is the REGISTERED amount, not the placed amount,
  and the source uses the field freely: filler values and pre-1994 currency both
  appear, and a single filler record can dominate a whole year.

For wide scans, `--props` projects the object listing to the properties needed,
which keeps a large page usable.
