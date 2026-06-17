-- docs/machine.md — Inflação: realizado, esperado e implícito.
with curves as (
    select base_date, curve_type, tenor, rate
    from {{ ref('int_macro__td_curves') }}
),

breakeven as (
    select
        n.base_date as date,
        n.tenor,
        {{ fisher('n.rate', 'r.rate') }} as value
    from curves as n
    inner join curves as r
        on n.base_date = r.base_date and n.tenor = r.tenor
        and n.curve_type = 'nominal' and r.curve_type = 'real'
),

ipca_mensal as (
    select date, value from {{ ref('int_macro__series_decimal') }}
    where series_name = 'ipca'
),

-- IPCA realizado do mês vs mediana Focus para aquele mês feita ~12m antes
surpresa as (
    select
        i.date,
        i.value - f.median / 100.0 as value
    from (
        select date, value, date - interval 12 months as forecast_cutoff
        from ipca_mensal
    ) as i
    asof join (
        select survey_date, reference_month, median
        from {{ ref('stg_bcb_focus__mensais') }}
        where indicator = 'ipca'
    ) as f
        on i.date = f.reference_month and i.forecast_cutoff >= f.survey_date
),

incerteza as (
    select survey_date as date, ipca_12m_std_dev as value
    from {{ ref('int_macro__focus_ipca_12m') }}
),

ancoragem as (
    select
        f.survey_date as date,
        f.median / 100.0 - t.target_center_pct / 100.0 as value
    from {{ ref('stg_bcb_focus__anuais') }} as f
    inner join {{ ref('inflation_targets') }} as t
        on t.year = f.reference_year
    where f.indicator = 'ipca' and f.horizon_years = 2
),

-- Tripé de índices: mensal + acumulado 12m de IPCA, IGP-M e INPC
tripe as (
    select
        date,
        series_name,
        value as monthly_rate,
        exp(
            sum(ln(1.0 + value)) over (
                partition by series_name
                order by date
                range between interval 11 months preceding and current row
            )
        ) - 1.0 as rate_12m
    from {{ ref('int_macro__series_decimal') }}
    where series_name in ('ipca', 'igpm', 'inpc')
)

select date, 'breakeven_' || cast(cast(tenor as integer) as varchar) || 'y' as indicator_id,
    value, 'decimal a.a.' as unit, cast(null as varchar) as label,
    'td:prefixado×ipca+(tenor interpolado, Fisher)' as lineage
from breakeven
union all
select date, 'surpresa_inflacao', value, 'decimal a.m.', null,
    'sgs:433;focus:mensais/ipca(survey ~12m antes)'
from surpresa
union all
select date, 'incerteza_inflacao', value, 'decimal (desvio-padrão Focus)', null,
    'focus:inflacao_12m/ipca(DesvioPadrao,S)'
from incerteza
union all
select date, 'ancoragem_expectativas', value, 'decimal (desvio da meta t+2)', null,
    'focus:anuais/ipca(t+2);seed:inflation_targets'
from ancoragem
union all
select date, series_name || '_mensal', monthly_rate, 'decimal a.m.', null,
    'sgs:433,189,188'
from tripe
union all
select date, series_name || '_12m', rate_12m, 'decimal 12m', null,
    'sgs:433,189,188(composto 12m)'
from tripe
