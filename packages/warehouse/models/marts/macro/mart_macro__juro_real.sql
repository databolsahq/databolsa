-- docs/machine.md — Política monetária e juro real. Tudo em decimal a.a., Fisher.
with selic as (
    select date, value as selic_meta
    from {{ ref('int_macro__series_decimal') }}
    where series_name = 'selic_meta'
),

focus_12m as (
    select survey_date, ipca_12m_expected from {{ ref('int_macro__focus_ipca_12m') }}
),

ex_ante as (
    select
        s.date,
        {{ fisher('s.selic_meta', 'f.ipca_12m_expected') }} as value
    from selic as s
    asof join focus_12m as f on s.date >= f.survey_date
),

ipca_12m as (
    select
        date,
        date + interval 1 month - interval 1 day as month_end,
        value as ipca_acum_12m
    from {{ ref('int_macro__series_decimal') }}
    where series_name = 'ipca_acum_12m'
),

ex_post as (
    select
        i.date,
        {{ fisher('a.selic_acum_12m', 'i.ipca_acum_12m') }} as value
    from ipca_12m as i
    asof join {{ ref('int_macro__selic_acum_12m') }} as a on i.month_end >= a.date
),

aperto as (
    select
        e.date,
        e.value - lp.juro_neutro as value
    from ex_ante as e
    asof join {{ ref('int_macro__focus_lp') }} as lp on e.date >= lp.survey_date
    where lp.juro_neutro is not null
),

copom as (
    select date, delta as value
    from (
        select date, selic_meta - lag(selic_meta) over (order by date) as delta
        from selic
    )
    where delta is not null and delta != 0
)

select date, 'juro_real_ex_ante' as indicator_id, value, 'decimal a.a.' as unit,
    cast(null as varchar) as label,
    'sgs:432;focus:inflacao_12m/ipca(Suavizada=S)' as lineage
from ex_ante
union all
select date, 'juro_real_ex_post', value, 'decimal a.a.', null,
    'sgs:11(composta 12m);sgs:13522'
from ex_post
union all
select date, 'aperto_monetario', value, 'decimal a.a.', null,
    'sgs:432;focus:inflacao_12m/ipca;focus:anuais/selic,ipca(t+3)'
from aperto
union all
select date, 'copom_degrau', value, 'decimal (Δ na meta)', null, 'sgs:432'
from copom
