-- docs/machine.md — Fiscal (dívida pública).
with series as (
    select date, series_name, value
    from {{ ref('int_macro__series_decimal') }}
    where series_name in ('divida_bruta_pib', 'divida_liquida_pib')
),

dividas as (
    select
        date,
        series_name,
        value,
        value - lag(value, 12) over (partition by series_name order by date) as delta_12m
    from series
),

juro_real as (
    select date, value from {{ ref('mart_macro__juro_real') }}
    where indicator_id = 'juro_real_ex_ante'
),

-- (r − g) × dívida/PIB: quanto o estoque cresce sozinho
dinamica as (
    select
        d.date,
        (j.value - lp.pib_lp) * d.value as value
    from (select date, value from dividas where series_name = 'divida_bruta_pib') as d
    asof join juro_real as j on d.date >= j.date
    asof join {{ ref('int_macro__focus_lp') }} as lp on d.date >= lp.survey_date
    where lp.pib_lp is not null
),

custo_rolagem as (
    select base_date as date, rate as value
    from {{ ref('int_macro__td_curves') }}
    where curve_type = 'real' and tenor = 10.0
)

select date, series_name as indicator_id, value, 'decimal (% PIB)' as unit,
    cast(null as varchar) as label,
    case series_name when 'divida_bruta_pib' then 'sgs:13762' else 'sgs:4513' end as lineage
from dividas
union all
select date, series_name || '_delta_12m', delta_12m, 'decimal (Δ12m p.p. PIB)', null,
    case series_name when 'divida_bruta_pib' then 'sgs:13762' else 'sgs:4513' end
from dividas where delta_12m is not null
union all
select date, 'dinamica_divida', value, 'decimal (% PIB a.a.)', null,
    'sgs:13762;sgs:432;focus:anuais/pib_total(t+3)'
from dinamica
union all
select date, 'custo_rolagem_ntnb_10y', value, 'decimal a.a. (real)', null, 'td:ipca+(10y interpolado)'
from custo_rolagem
