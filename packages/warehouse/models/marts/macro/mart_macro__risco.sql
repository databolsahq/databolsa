-- docs/machine.md — Prêmio de risco soberano.
-- ⚠️ EMBI descontinuado em jul/2024: indicadores morrem nessa data por construção
-- (lineage explicita), nunca aparecem como "atuais".
with embi as (
    select
        date,
        value,
        value - lag(value, 252) over (order by date) as delta_12m,
        percent_rank() over (order by value) as percentil_historico
    from {{ ref('int_macro__series_decimal') }}
    where series_name = 'embi_br'
),

selic as (
    select date, value from {{ ref('int_macro__series_decimal') }}
    where series_name = 'selic_meta'
),

fedfunds as (
    select date, value from {{ ref('int_macro__series_decimal') }}
    where series_name = 'fed_funds'
),

carry as (
    select
        e.date,
        s.value - f.value - e.value as value
    from embi as e
    asof join selic as s on e.date >= s.date
    asof join fedfunds as f on e.date >= f.date
)

select date, 'embi_br' as indicator_id, value, 'decimal (bps/10000)' as unit,
    cast(null as varchar) as label,
    'ipeadata:embi_br(histórico 1994–jul/2024, fonte descontinuada)' as lineage
from embi
union all
select date, 'embi_br_delta_12m', delta_12m, 'decimal (Δ~252 pregões)', null,
    'ipeadata:embi_br(histórico 1994–jul/2024)'
from embi where delta_12m is not null
union all
select date, 'embi_br_percentil', percentil_historico, 'percentil [0,1]', null,
    'ipeadata:embi_br(histórico 1994–jul/2024)'
from embi
union all
select date, 'carry_ajustado_risco', value, 'decimal a.a.', null,
    'sgs:432;fred:FEDFUNDS;ipeadata:embi_br(÷10000 — até jul/2024)'
from carry
