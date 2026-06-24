-- docs/machine.md — O regime: quadrantes crescimento × inflação.
-- Grão mensal. Cada eixo é a média dos sinais disponíveis (+1/−1); o quadrante
-- cruza as direções. lineage carrega os insumos de cada sinal.
with months as (
    select distinct date_trunc('month', date) as month
    from {{ ref('int_macro__series_decimal') }}
    where series_name = 'ipca' and date >= date '2003-01-01'
),

month_ends as (
    select month, month + interval 1 month - interval 1 day as month_end from months
),

-- sinais de crescimento
ibc as (
    select date, value from {{ ref('mart_macro__crescimento') }}
    where indicator_id = 'ibc_br_momentum_12m'
),

pib as (
    select date, value from {{ ref('mart_macro__crescimento') }}
    where indicator_id = 'pib_trimestral_qoq'
),

desemprego_delta as (
    select
        date,
        value - lag(value, 12) over (order by date) as delta_12m
    from {{ ref('mart_macro__emprego') }}
    where indicator_id = 'desemprego_pnad'
),

impulso as (
    select date, value from {{ ref('mart_macro__credito') }}
    where indicator_id = 'impulso_credito'
),

-- sinais de inflação
ipca_12m as (
    select date, value from {{ ref('mart_macro__inflacao') }}
    where indicator_id = 'ipca_12m'
),

target as (
    select year, target_center_pct / 100.0 as center from {{ ref('inflation_targets') }}
),

breakeven_delta as (
    select
        date,
        value - lag(value, 126) over (order by date) as delta_6m
    from {{ ref('mart_macro__inflacao') }}
    where indicator_id = 'breakeven_5y'
),

focus_delta as (
    select
        month,
        expected - lag(expected, 6) over (order by month) as delta_6m
    from (
        select date_trunc('month', survey_date) as month, avg(ipca_12m_expected) as expected
        from {{ ref('int_macro__focus_ipca_12m') }}
        group by 1
    )
),

signals as (
    select
        m.month,
        sign(ibc.value) as s_ibc,
        sign(pib.value) as s_pib,
        -sign(d.delta_12m) as s_desemprego,
        sign(imp.value) as s_impulso,
        sign(i.value - t.center) as s_ipca_vs_meta,
        sign(b.delta_6m) as s_breakeven,
        sign(f.delta_6m) as s_focus
    from month_ends as m
    asof left join ibc on m.month_end >= ibc.date
    asof left join pib on m.month_end >= pib.date
    asof left join desemprego_delta as d on m.month_end >= d.date
    asof left join impulso as imp on m.month_end >= imp.date
    asof left join ipca_12m as i on m.month_end >= i.date
    asof left join breakeven_delta as b on m.month_end >= b.date
    asof left join focus_delta as f on m.month >= f.month
    left join target as t on t.year = year(m.month)
),

scores as (
    select
        month,
        (coalesce(s_ibc, 0) + coalesce(s_pib, 0) + coalesce(s_desemprego, 0) + coalesce(s_impulso, 0))
            / nullif(
                (s_ibc is not null)::int + (s_pib is not null)::int
                + (s_desemprego is not null)::int + (s_impulso is not null)::int, 0
            ) as growth_score,
        (coalesce(s_ipca_vs_meta, 0) + coalesce(s_breakeven, 0) + coalesce(s_focus, 0))
            / nullif(
                (s_ipca_vs_meta is not null)::int + (s_breakeven is not null)::int
                + (s_focus is not null)::int, 0
            ) as inflation_score
    from signals
),

quadrants as (
    select
        month,
        growth_score,
        inflation_score,
        case
            when growth_score >= 0 and inflation_score >= 0 then 1
            when growth_score >= 0 and inflation_score < 0 then 2
            when growth_score < 0 and inflation_score >= 0 then 3
            else 4
        end as quadrant,
        case
            when growth_score >= 0 and inflation_score >= 0 then 'crescimento↑ inflação↑'
            when growth_score >= 0 and inflation_score < 0 then 'crescimento↑ inflação↓'
            when growth_score < 0 and inflation_score >= 0 then 'crescimento↓ inflação↑'
            else 'crescimento↓ inflação↓'
        end as label
    from scores
    where growth_score is not null and inflation_score is not null
)

select month as date, 'regime_growth_score' as indicator_id, growth_score as value,
    'score [-1,1]' as unit, cast(null as varchar) as label,
    'sgs:24364;sidra:5932,6381;sgs:20714,4382' as lineage
from quadrants
union all
select month, 'regime_inflation_score', inflation_score, 'score [-1,1]', null,
    'sgs:433;seed:inflation_targets;td:breakeven_5y;focus:inflacao_12m/ipca'
from quadrants
union all
select month, 'regime_quadrante', quadrant, 'quadrante 1–4', label,
    'composto: growth_score × inflation_score'
from quadrants
