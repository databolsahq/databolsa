-- docs/machine.md — Ciclo de crédito e dívida privada.
with series as (
    select date, series_name, value
    from {{ ref('int_macro__series_decimal') }}
),

credito_pib as (
    select
        date,
        value,
        value - avg(value) over (
            order by date rows between 59 preceding and current row
        ) as gap
    from series where series_name = 'credito_pib'
),

-- Impulso de crédito: Δ12m do crescimento (Δ12m) do crédito em % do PIB
credito_sobre_pib as (
    select
        c.date,
        c.value / nullif(p.value, 0) as ratio
    from (select date, value from series where series_name = 'credito_total') as c
    inner join (select date, value from series where series_name = 'pib_nominal_12m') as p
        on c.date = p.date
),

impulso as (
    select
        date,
        growth_12m - lag(growth_12m, 12) over (order by date) as value
    from (
        select
            date,
            ratio - lag(ratio, 12) over (order by date) as growth_12m
        from credito_sobre_pib
    )
),

selic_mensal as (
    select date_trunc('month', date) as month, last(value order by date) as selic
    from series where series_name = 'selic_meta'
    group by 1
),

custo_credito as (
    select
        s.date,
        s.value + m.selic as value
    from (select date, value from series where series_name = 'spread_credito') as s
    inner join selic_mensal as m on date_trunc('month', s.date) = m.month
)

select date, 'credito_pib' as indicator_id, value, 'decimal' as unit,
    cast(null as varchar) as label, 'sgs:20622' as lineage
from credito_pib
union all
select date, 'credito_pib_gap', gap, 'decimal (vs média móvel 60m)', null, 'sgs:20622' from credito_pib
union all
select date, 'impulso_credito', value, 'decimal (2ª derivada 12m)', null, 'sgs:20714;sgs:4382'
from impulso where value is not null
union all
select date, 'inadimplencia_total', value, 'decimal', null, 'sgs:21082'
from series where series_name = 'inadimplencia_total'
union all
select date, 'spread_credito', value, 'decimal a.a.', null, 'sgs:20783'
from series where series_name = 'spread_credito'
union all
select date, 'custo_credito', value, 'decimal a.a. (spread+Selic)', null, 'sgs:20783;sgs:432'
from custo_credito
union all
select date, 'endividamento_familias', value, 'decimal (% renda 12m)', null, 'sgs:29037'
from series where series_name = 'endividamento_familias'
union all
select date, 'comprometimento_renda_familias', value, 'decimal', null, 'sgs:29034'
from series where series_name = 'comprometimento_renda_familias'
