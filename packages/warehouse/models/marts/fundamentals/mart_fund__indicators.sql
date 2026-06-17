-- Os 49 indicadores fundamentalistas (docs/indicators.md) por (cnpj, data de
-- avaliação). Wide: é a tabela do screener (GET /v1/screener, /v1/indicators).
-- Convenções: P/L negativo é mostrado (não N/A); CAGR com base negativa = null;
-- bancos: receita = conta 7.01 (DVA) quando 3.01 = 0; preço NÃO ajustado por
-- eventos (fase de preços ajustados) — shares_quality sinaliza.
with ttm_hist as (
    select
        *,
        coalesce(nullif(revenue_ttm, 0), dva_revenue_ttm) as revenue_eff_ttm,
        lag(revenue_ttm, 12) over w as revenue_3y,
        lag(revenue_ttm, 20) over w as revenue_5y,
        lag(net_income_ttm, 12) over w as net_income_3y,
        lag(net_income_ttm, 20) over w as net_income_5y,
        lag(ebitda_ttm, 12) over w as ebitda_3y,
        lag(ref_date, 12) over w as ref_3y_date,
        lag(ref_date, 20) over w as ref_5y_date
    from {{ ref('int_fund__ttm') }}
    window w as (partition by cnpj order by ref_date)
),

mc as (
    select * from {{ ref('int_fund__market_cap') }}
),

divs as (
    select * from {{ ref('int_fund__dividends_12m') }}
),

-- Grão empresa: provento preferencial = SOMA de PN+PNA+PNB (o balde preferencial
-- foi separado por classe em int_fund__dividends_12m p/ o DY por papel; aqui voltamos
-- ao total da empresa, idêntico ao 'PN' colapsado de antes). ON segue separado.
divs_pref as (
    select cnpj, eval_date, sum(dps_12m) as dps_12m, sum(jcp_ps_12m) as jcp_ps_12m
    from divs
    where class_group in ('PN', 'PNA', 'PNB')
    group by 1, 2
),

joined as (
    select
        m.cnpj,
        m.eval_date,
        m.market_cap,
        m.main_ticker,
        m.main_price,
        m.price_date,
        m.total_shares,
        m.on_shares,
        m.pn_shares,
        t.*exclude (cnpj),
        -- DY da empresa = classe do ticker principal (ON se termina em 3, senão o total PN)
        case when m.main_ticker like '%3' then don.dps_12m else dpref.dps_12m end as dps_12m,
        case when m.main_ticker like '%3' then don.jcp_ps_12m else dpref.jcp_ps_12m end as jcp_ps_12m,
        don.dps_12m as dps_on_12m,
        dpref.dps_12m as dps_pn_12m
    from mc as m
    asof join ttm_hist as t
        on m.cnpj = t.cnpj and m.eval_date >= t.ref_date
    left join divs as don
        on m.cnpj = don.cnpj and m.eval_date = don.eval_date and don.class_group = 'ON'
    left join divs_pref as dpref
        on m.cnpj = dpref.cnpj and m.eval_date = dpref.eval_date
    where t.ref_date > m.eval_date - interval 9 months  -- TTM velho demais não vale
)

select
    cnpj,
    main_ticker as ticker,
    company_name,
    eval_date,
    ref_date as statement_date,
    scope,
    market_cap,
    main_price as price,
    price_date,
    total_shares,

    -- Valuation
    market_cap / nullif(net_income_ttm, 0) as pl,
    market_cap / nullif(equity, 0) as pvp,
    market_cap / nullif(revenue_eff_ttm, 0) as psr,
    market_cap / nullif(ebit_ttm, 0) as p_ebit,
    market_cap / nullif(fcf_ttm, 0) as p_fcf,
    market_cap / nullif(total_assets, 0) as p_ativos,
    market_cap / nullif(working_capital, 0) as p_cap_giro,
    market_cap / nullif(net_current_assets, 0) as p_ativo_circ_liq,
    (market_cap + net_debt) / nullif(ebitda_ttm, 0) as ev_ebitda,
    (market_cap + net_debt) / nullif(ebit_ttm, 0) as ev_ebit,

    -- Por ação
    net_income_ttm / nullif(total_shares, 0) as lpa,
    equity / nullif(total_shares, 0) as vpa,

    -- Rentabilidade
    net_income_ttm / nullif(equity, 0) as roe,
    net_income_ttm / nullif(total_assets, 0) as roa,
    case when invested_capital > 0
        then nopat_ttm / invested_capital end as roic,
    gross_profit_ttm / nullif(revenue_eff_ttm, 0) as margem_bruta,
    ebit_ttm / nullif(revenue_eff_ttm, 0) as margem_ebit,
    net_income_ttm / nullif(revenue_eff_ttm, 0) as margem_liquida,
    ebit_ttm / nullif(total_assets, 0) as ebit_ativos,
    revenue_eff_ttm / nullif(total_assets, 0) as giro_ativos,

    -- Dívida e liquidez
    net_debt / nullif(ebitda_ttm, 0) as div_liquida_ebitda,
    net_debt / nullif(equity, 0) as div_liquida_pl,
    gross_debt / nullif(equity, 0) as div_bruta_pl,
    current_assets / nullif(current_liabilities, 0) as liquidez_corrente,

    -- Dividendos (JCP bruto incluído). Proventos corrompidos filtrados a montante
    -- (int_fund__dividends_12m, por preço-no-ex); DY > 100% é permitido (real).
    dps_12m / nullif(main_price, 0) as dy_12m,
    (coalesce(dps_on_12m, 0) * coalesce(on_shares, 0)
        + coalesce(dps_pn_12m, 0) * coalesce(pn_shares, 0))
        / nullif(net_income_ttm, 0) as payout,
    jcp_ps_12m / nullif(dps_12m, 0) as jcp_sobre_total,

    -- Crescimento (base negativa → null; janela com tolerância de ±6 meses)
    case when revenue_ttm > 0 and revenue_3y > 0
            and date_diff('month', ref_3y_date, ref_date) between 30 and 42
        then pow(revenue_ttm / revenue_3y, 1.0 / 3) - 1 end as revenue_cagr_3y,
    case when revenue_ttm > 0 and revenue_5y > 0
            and date_diff('month', ref_5y_date, ref_date) between 54 and 66
        then pow(revenue_ttm / revenue_5y, 1.0 / 5) - 1 end as revenue_cagr_5y,
    case when net_income_ttm > 0 and net_income_3y > 0
            and date_diff('month', ref_3y_date, ref_date) between 30 and 42
        then pow(net_income_ttm / net_income_3y, 1.0 / 3) - 1 end as earnings_cagr_3y,
    case when net_income_ttm > 0 and net_income_5y > 0
            and date_diff('month', ref_5y_date, ref_date) between 54 and 66
        then pow(net_income_ttm / net_income_5y, 1.0 / 5) - 1 end as earnings_cagr_5y,
    case when ebitda_ttm > 0 and ebitda_3y > 0
            and date_diff('month', ref_3y_date, ref_date) between 30 and 42
        then pow(ebitda_ttm / ebitda_3y, 1.0 / 3) - 1 end as ebitda_cagr_3y,

    -- Flags de qualidade
    equity < 0 as negative_equity,
    'fre_sem_ajuste_pos_evento' as shares_quality,
    quarters_available
from joined
