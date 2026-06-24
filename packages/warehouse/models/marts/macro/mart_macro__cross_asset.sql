-- docs/machine.md — Valor relativo cross-asset (agregado de mercado, ponderado
-- por market cap de TODAS as listadas com dado — proxy do IBOV até a composição
-- do índice entrar no lake; documentado na linhagem).
with agg as (
    select
        eval_date as date,
        sum(market_cap) as total_mc,
        sum(case when pl is not null then market_cap end) as mc_with_earnings,
        sum(net_income_ttm_total) as total_earnings,
        sum(divs_total) as total_divs
    from (
        select
            eval_date,
            market_cap,
            pl,
            market_cap / nullif(pl, 0) as net_income_ttm_total,
            dy_12m * market_cap as divs_total
        from {{ ref('mart_fund__indicators') }}
        where market_cap is not null
    )
    group by 1
),

earnings_yield as (
    select
        date,
        total_earnings / nullif(mc_with_earnings, 0) as ey,
        total_divs / nullif(total_mc, 0) as dy
    from agg
),

selic as (
    select date, value from {{ ref('int_macro__series_decimal') }}
    where series_name = 'selic_meta'
),

ntnb10 as (
    select base_date as date, rate from {{ ref('int_macro__td_curves') }}
    where curve_type = 'real' and tenor = 10.0
),

spreads as (
    select
        e.date,
        e.dy - s.value as dy_vs_selic,
        e.ey - n.rate as erp_vs_ntnb,
        e.ey as earnings_yield,
        e.dy as dividend_yield_agregado
    from earnings_yield as e
    asof join selic as s on e.date >= s.date
    asof join ntnb10 as n on e.date >= n.date
)

select date, 'dy_agregado_vs_selic' as indicator_id, dy_vs_selic as value,
    'decimal a.a.' as unit, cast(null as varchar) as label,
    'b3_corporate_actions+cotahist+fre(agregado mercado);sgs:432' as lineage
from spreads
union all
select date, 'erp_earnings_yield_vs_ntnb10', erp_vs_ntnb, 'decimal a.a.', null,
    'cvm_dfp_itr+fre+cotahist(agregado);td:ipca+10y'
from spreads
union all
select date, 'earnings_yield_agregado', earnings_yield, 'decimal a.a.', null,
    'cvm_dfp_itr+fre+cotahist(agregado mercado, proxy IBOV)'
from spreads
union all
select date, 'dividend_yield_agregado', dividend_yield_agregado, 'decimal a.a.', null,
    'b3_corporate_actions+cotahist+fre(agregado mercado)'
from spreads
