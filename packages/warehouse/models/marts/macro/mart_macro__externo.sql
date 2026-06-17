-- docs/machine.md — Setor externo. Séries em USD milhões são convertidas a BRL
-- pela PTAX venda média do mês quando comparadas ao PIB nominal (R$ milhões).
with series as (
    select date, series_name, value
    from {{ ref('int_macro__series_decimal') }}
),

ptax_mensal as (
    select date_trunc('month', date) as month, avg(value) as ptax
    from series where series_name = 'usd_brl_ptax_venda'
    group by 1
),

cc_12m_brl as (
    select
        cc.date,
        sum(cc.value * p.ptax) over (
            order by cc.date rows between 11 preceding and current row
        ) as cc_brl_12m,
        sum(cc.value) over (
            order by cc.date rows between 11 preceding and current row
        ) as cc_usd_12m
    from (select date, value from series where series_name = 'transacoes_correntes') as cc
    inner join ptax_mensal as p on date_trunc('month', cc.date) = p.month
),

cc_pib as (
    select
        c.date,
        c.cc_brl_12m / nullif(p.value, 0) as value
    from cc_12m_brl as c
    inner join (select date, value from series where series_name = 'pib_nominal_12m') as p
        on c.date = p.date
),

idp_12m as (
    select
        date,
        sum(value) over (order by date rows between 11 preceding and current row) as idp_usd_12m
    from series where series_name = 'investimento_direto_pais'
),

idp_cobertura as (
    select
        i.date,
        i.idp_usd_12m / nullif(-c.cc_usd_12m, 0) as value
    from idp_12m as i
    inner join cc_12m_brl as c on i.date = c.date
    where c.cc_usd_12m < 0
),

reservas_m2 as (
    select
        r.date,
        r.value / nullif(m.value / p.ptax, 0) as value
    from (select date, value from series where series_name = 'reservas_internacionais') as r
    inner join (select date, value from series where series_name = 'm2') as m on r.date = m.date
    inner join ptax_mensal as p on date_trunc('month', r.date) = p.month
),

balanca as (
    select
        date,
        value,
        sum(value) over (order by date rows between 11 preceding and current row) as saldo_12m
    from series where series_name = 'balanca_comercial_mensal'
)

select date, 'conta_corrente_pib' as indicator_id, value, 'decimal (12m/PIB 12m)' as unit,
    cast(null as varchar) as label,
    'sgs:22701(×PTAX sgs:1);sgs:4382' as lineage
from cc_pib
union all
select date, 'idp_cobertura_cc', value, 'razão (IDP 12m / déficit CC 12m)', null,
    'sgs:22885;sgs:22701'
from idp_cobertura
union all
select date, 'reservas_sobre_m2_usd', value, 'razão', null, 'sgs:4380;sgs:27575;sgs:1'
from reservas_m2
union all
select date, 'balanca_comercial_mensal', value, 'USD milhões', null, 'sgs:22707'
from balanca
union all
select date, 'balanca_comercial_12m', saldo_12m, 'USD milhões (soma 12m)', null, 'sgs:22707'
from balanca
