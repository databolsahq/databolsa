-- docs/machine.md — Moeda e debasement.
with series as (
    select date, series_name, value
    from {{ ref('int_macro__series_decimal') }}
),

m2 as (
    select
        date,
        value / nullif(lag(value, 12) over (order by date), 0) - 1.0 as yoy
    from series where series_name = 'm2'
),

pib_nominal as (
    select
        date,
        value / nullif(lag(value, 12) over (order by date), 0) - 1.0 as yoy
    from series where series_name = 'pib_nominal_12m'
),

impressao as (
    select m.date, m.yoy - p.yoy as value
    from m2 as m
    inner join pib_nominal as p on m.date = p.date
    where m.yoy is not null and p.yoy is not null
),

-- Câmbio real proxy: PTAX média mensal deflacionada pelo índice IPCA,
-- rebase jan/2010 = 100. Sem CPI americano ainda (futuro) — proxy parcial.
ptax_mensal as (
    select date_trunc('month', date) as date, avg(value) as ptax
    from series where series_name = 'usd_brl_ptax_venda'
    group by 1
),

cambio_real as (
    select
        p.date,
        p.ptax / i.ipca_index as deflated
    from ptax_mensal as p
    inner join {{ ref('int_macro__ipca_index') }} as i on p.date = i.date
),

cambio_real_rebased as (
    select
        date,
        100.0 * deflated / first(deflated) over (
            order by abs(date_diff('day', date, date '2010-01-01'))
        ) as value
    from cambio_real
),

crypto as (
    select
        date,
        symbol,
        close,
        close / nullif(lag(close, 365) over (partition by symbol order by date), 0) - 1.0 as yoy
    from {{ ref('stg_crypto__daily') }}
    where symbol in ('BTCBRL', 'ETHBRL')
)

select date, 'impressao_vs_economia' as indicator_id, value, 'decimal (M2 yoy − PIB nom. yoy)' as unit,
    cast(null as varchar) as label, 'sgs:27575;sgs:4382' as lineage
from impressao
union all
select date, 'cambio_real_proxy', value, 'índice (jan/2010=100, deflator só IPCA)', null,
    'sgs:1;sgs:433(índice composto)'
from cambio_real_rebased
union all
select date, lower(symbol) || '_nivel', close, 'BRL', null, 'crypto:' || symbol || '/1d'
from crypto
union all
select date, lower(symbol) || '_yoy', yoy, 'decimal 12m', null, 'crypto:' || symbol || '/1d'
from crypto where yoy is not null
