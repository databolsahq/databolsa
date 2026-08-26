# Public offerings

Reading `listOfferings` across regulatory regimes without producing plausible
wrong numbers.

`listOfferings` unifies regulatory regimes whose vocabularies differ, and reading
it as one flat table produces plausible wrong numbers. Three rules:

- Filter and group by `instrumento` or `familia`, not by `tipo_ativo`. The source
  spells the same instrument several ways depending on the regime, so
  `instrumento=debenture` returns the whole set while a single spelling returns a
  fraction of it. `tipo_ativo` remains the as-filed text and matches only the
  spelling asked for.
- Build time series on `data_referencia`. Restricted-effort offerings carry no
  registration date, so filtering or sorting by `data_registro` silently drops
  them — and they are a large share of the years before 2023. `regime_registro`
  separates registered offerings from exempt ones when that distinction matters.
- Before summing `valor_total`, exclude `value_is_sentinel` and
  `value_pre_real_currency`. It is the REGISTERED amount, not the placed amount,
  and the source uses the field freely: filler values and pre-1994 currency both
  appear, and a single filler record can dominate a whole year.

For wide scans, `fields=` projects the response to the columns needed, which keeps
a large page usable.
