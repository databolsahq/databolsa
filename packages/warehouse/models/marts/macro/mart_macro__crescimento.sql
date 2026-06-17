-- docs/machine.md — Crescimento e produtividade.
with ibc as (
    select date, value
    from {{ ref('int_macro__series_decimal') }}
    where series_name = 'ibc_br_dessaz'
),

ibc_momentum as (
    select
        date,
        value,
        value / nullif(lag(value, 3) over (order by date), 0) - 1.0 as mom_3m,
        value / nullif(lag(value, 12) over (order by date), 0) - 1.0 as mom_12m
    from ibc
),

pib_tri as (
    select period_month as date, value / 100.0 as value
    from {{ ref('stg_sidra__series') }}
    where series_name = 'pib_var_trimestral'
),

pim as (
    select
        period_month as date,
        value,
        value / nullif(lag(value, 12) over (order by period_month), 0) - 1.0 as yoy
    from {{ ref('stg_sidra__series') }}
    where series_name = 'producao_industrial'
),

juro_real as (
    select date, value from {{ ref('mart_macro__juro_real') }}
    where indicator_id = 'juro_real_ex_ante'
),

r_g as (
    select
        j.date,
        j.value - lp.pib_lp as value
    from juro_real as j
    asof join {{ ref('int_macro__focus_lp') }} as lp on j.date >= lp.survey_date
    where lp.pib_lp is not null
),

-- PIB do ano (composição dos 4 trimestres t/t-1) vs Focus no início do ano
pib_anual as (
    select
        year(date) as ref_year,
        exp(sum(ln(1.0 + value))) - 1.0 as realized,
        count(*) as quarters
    from pib_tri
    group by 1
    having count(*) = 4
),

surpresa_atividade as (
    select
        make_date(p.ref_year, 12, 1) as date,
        p.realized - f.median / 100.0 as value
    from (
        select *, make_date(ref_year, 1, 15) as forecast_cutoff from pib_anual
    ) as p
    asof join (
        select survey_date, reference_year, median
        from {{ ref('stg_bcb_focus__anuais') }}
        where indicator = 'pib_total'
    ) as f
        on p.ref_year = f.reference_year and p.forecast_cutoff >= f.survey_date
)

select date, 'ibc_br_nivel' as indicator_id, value, 'índice dessaz' as unit,
    cast(null as varchar) as label, 'sgs:24364' as lineage
from ibc_momentum
union all
select date, 'ibc_br_momentum_3m', mom_3m, 'decimal 3m', null, 'sgs:24364' from ibc_momentum where mom_3m is not null
union all
select date, 'ibc_br_momentum_12m', mom_12m, 'decimal 12m', null, 'sgs:24364' from ibc_momentum where mom_12m is not null
union all
select date, 'pib_trimestral_qoq', value, 'decimal t/t-1 dessaz', null, 'sidra:5932' from pib_tri
union all
select date, 'producao_industrial_nivel', value, 'número-índice', null, 'sidra:8888' from pim
union all
select date, 'producao_industrial_yoy', yoy, 'decimal 12m', null, 'sidra:8888' from pim where yoy is not null
union all
select date, 'r_menos_g', value, 'decimal a.a.', null,
    'sgs:432;focus:inflacao_12m/ipca;focus:anuais/pib_total(t+3)'
from r_g
union all
select date, 'surpresa_atividade', value, 'decimal a.a.', null,
    'sidra:5932(4 trim. compostos);focus:anuais/pib_total(survey início do ano)'
from surpresa_atividade
