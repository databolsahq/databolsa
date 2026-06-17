-- docs/machine.md — Emprego e folga econômica.
with desemprego as (
    select
        period_month as date,
        value / 100.0 as rate,
        avg(value / 100.0) over (
            order by period_month
            rows between 11 preceding and current row
        ) as trend_12m,
        avg(value / 100.0) over () as historical_mean
    from {{ ref('stg_sidra__series') }}
    where series_name = 'desemprego_pnad'
),

hiato_ibc as (
    select
        date,
        value / nullif(
            avg(value) over (order by date rows between 23 preceding and current row), 0
        ) - 1.0 as value
    from {{ ref('int_macro__series_decimal') }}
    where series_name = 'ibc_br_dessaz'
)

select date, 'desemprego_pnad' as indicator_id, rate as value, 'decimal' as unit,
    cast(null as varchar) as label, 'sidra:6381' as lineage
from desemprego
union all
select date, 'desemprego_tendencia_12m', trend_12m, 'decimal', null, 'sidra:6381'
from desemprego
union all
select date, 'folga_desemprego', rate - historical_mean, 'decimal (vs média hist.)', null, 'sidra:6381'
from desemprego
union all
select date, 'hiato_ibc_br', value, 'decimal (vs média móvel 24m)', null, 'sgs:24364'
from hiato_ibc
