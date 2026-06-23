-- docs/machine.md — Engrenagem global (FRED).
with series as (
    select date, series_name, value
    from {{ ref('int_macro__series_decimal') }}
),

selic as (
    select date, value from series where series_name = 'selic_meta'
),

diferencial as (
    select
        f.date,
        s.value - f.value as value
    from (select date, value from series where series_name = 'fed_funds') as f
    asof join selic as s on f.date >= s.date
),

us_2s10s as (
    select
        a.date,
        a.value - b.value as value
    from (select date, value from series where series_name = 'us_10y') as a
    inner join (select date, value from series where series_name = 'us_2y') as b
        on a.date = b.date
),

-- Pulso de commodities e apetite a risco: nível + variação 12m (asof ~1 ano atrás)
levels as (
    select date, series_name, value
    from series
    where series_name in ('brent', 'minerio_ferro', 'soja', 'dxy_amplo', 'vix', 'sp500')
),

yoy as (
    select
        cur.date,
        cur.series_name,
        cur.value / nullif(prev.value, 0) - 1.0 as value
    from (select *, date - interval 12 months as prior_date from levels) as cur
    asof join levels as prev
        on cur.series_name = prev.series_name and cur.prior_date >= prev.date
)

select date, 'diferencial_selic_fedfunds' as indicator_id, value, 'decimal a.a.' as unit,
    cast(null as varchar) as label, 'sgs:432;fred:FEDFUNDS' as lineage
from diferencial
union all
select date, 'us_2s10s', value, 'decimal a.a.', null, 'fred:DGS10,DGS2' from us_2s10s
union all
select date, series_name || '_nivel', value, 'nível (unidade da fonte)', null,
    'fred:' || series_name
from levels
union all
select date, series_name || '_yoy', value, 'decimal 12m', null, 'fred:' || series_name
from yoy where value is not null
