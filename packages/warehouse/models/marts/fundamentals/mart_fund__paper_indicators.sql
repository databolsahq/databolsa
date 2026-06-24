-- Indicadores POR PAPEL (grão = ticker × data de avaliação). Complementa
-- mart_fund__indicators (que continua POR EMPRESA, grão cnpj). SAPR3/SAPR4/
-- SAPR11 são analisados separadamente: preço, P/L, P/VP, PSR, DY, P/EBIT, EV/*
-- mudam por papel; fundamentos (margens, ROE, ROIC, dívida, crescimento, LPA,
-- VPA) são da empresa e iguais em todos os papéis.
--
-- "Market cap do papel" (mc_paper):
--   ON/PN  -> preço_do_papel × total_shares  (convenção Fundamentus: como se a
--             empresa toda valesse o preço daquela classe; é o que faz P/L do
--             SAPR3 ≠ SAPR4).
--   UNIT   -> market cap real (Σ ON×preço + PN×preço), pois a unit representa a
--             empresa inteira (e não temos a composição da unit p/ decompor).
-- DY usa o provento da CLASSE do papel (int_fund__dividends_12m já separa
-- ON/PN/UNIT). Preço NÃO ajustado por eventos (igual ao mart por empresa).
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

papers as (
    select distinct
        cnpj,
        ticker,
        class_group,
        -- classe do PROVENTO p/ casar com int_fund__dividends_12m: PNA(5)/PNB(6) têm
        -- balde próprio (DY do CEBR5 ≠ CEBR6); 4/7/8 = PN. class_group (econômico,
        -- ON/PN/UNIT) segue p/ a lógica de UNIT e a saída.
        case regexp_extract(ticker, '(\d+)$', 1)
            when '3' then 'ON'
            when '5' then 'PNA'
            when '6' then 'PNB'
            when '11' then 'UNIT'
            else 'PN'
        end as div_class
    from {{ ref('int_fund__ticker_map') }}
    where class_group in ('ON', 'PN', 'UNIT')
),

prices as (
    select * from {{ ref('int_fund__prices') }}
),

divs as (
    select * from {{ ref('int_fund__dividends_12m') }}
),

-- Total de proventos preferenciais (PN+PNA+PNB) por empresa/data — p/ o payout, que
-- soma ON×ações_on + PREF×ações_pn (ações_pn = total preferencial da empresa).
divs_pref as (
    select cnpj, eval_date, sum(dps_12m) as dps_12m, sum(jcp_ps_12m) as jcp_ps_12m
    from divs
    where class_group in ('PN', 'PNA', 'PNB')
    group by 1, 2
),

joined as (
    select
        pa.ticker,
        pa.class_group,
        m.cnpj,
        m.eval_date,
        m.market_cap,
        m.total_shares,
        m.on_shares,
        m.pn_shares,
        pp.close as price_paper,
        pp.date as price_date,
        t.*exclude (cnpj),
        d.dps_12m as class_dps_12m,
        d.jcp_ps_12m as class_jcp_12m,
        don.dps_12m as dps_on_12m,
        dpn.dps_12m as dps_pn_12m
    from mc as m
    inner join papers as pa on pa.cnpj = m.cnpj
    asof join prices as pp
        on pa.ticker = pp.ticker and m.eval_date >= pp.date
    asof join ttm_hist as t
        on m.cnpj = t.cnpj and m.eval_date >= t.ref_date
    left join divs as d
        on d.cnpj = m.cnpj and d.eval_date = m.eval_date
        and d.class_group = pa.div_class
    left join divs as don
        on don.cnpj = m.cnpj and don.eval_date = m.eval_date and don.class_group = 'ON'
    left join divs_pref as dpn
        on dpn.cnpj = m.cnpj and dpn.eval_date = m.eval_date
    where t.ref_date > m.eval_date - interval 9 months
        and pp.date >= m.eval_date - interval 10 day
),

priced as (
    select
        *,
        case when class_group = 'UNIT'
            then market_cap
            else price_paper * total_shares
        end as mc_paper
    from joined
),

-- setor do cadastro (1 linha por cnpj) p/ marcar instituições financeiras: bancos,
-- seguradoras e intermediários usam plano de contas deslocado (sem EBIT/EBITDA, receita
-- com conceito próprio), então margem/PSR/EV-EBIT não se aplicam — a API as zera p/ esses.
co as (
    select cnpj, any_value(sector) as sector from {{ ref('stg_cvm__cadastro') }} group by cnpj
)

select
    ticker,
    class_group,
    priced.cnpj as cnpj,
    company_name,
    eval_date,
    ref_date as statement_date,
    scope,
    price_paper as price,
    price_date,
    -- "Valor de mercado" do papel = cotação × nº ações (= mc_paper p/ ON/PN), igual
    -- à convenção do Fundamentus. UNIT usa o market cap real da empresa.
    mc_paper as market_cap,
    market_cap as company_market_cap,
    total_shares,

    -- Valuation (por papel via mc_paper)
    mc_paper / nullif(net_income_ttm, 0) as pl,
    mc_paper / nullif(equity, 0) as pvp,
    mc_paper / nullif(revenue_eff_ttm, 0) as psr,
    mc_paper / nullif(ebit_ttm, 0) as p_ebit,
    mc_paper / nullif(fcf_ttm, 0) as p_fcf,
    mc_paper / nullif(total_assets, 0) as p_ativos,
    mc_paper / nullif(working_capital, 0) as p_cap_giro,
    mc_paper / nullif(net_current_assets, 0) as p_ativo_circ_liq,
    (mc_paper + net_debt) / nullif(ebitda_ttm, 0) as ev_ebitda,
    (mc_paper + net_debt) / nullif(ebit_ttm, 0) as ev_ebit,

    -- Dividendos do papel (proventos corrompidos já filtrados em int_fund__dividends_12m
    -- por preço-no-ex; DY 12m > 100% é permitido — retorno de capital / pagador alto real).
    class_dps_12m / nullif(price_paper, 0) as dy_12m,
    class_dps_12m as dps_12m,
    (coalesce(dps_on_12m, 0) * coalesce(on_shares, 0)
        + coalesce(dps_pn_12m, 0) * coalesce(pn_shares, 0))
        / nullif(net_income_ttm, 0) as payout,
    case when class_dps_12m > 0
        then class_jcp_12m / class_dps_12m end as jcp_sobre_total,

    -- Por ação. ON/PN: lucro/patrimônio por ação da empresa. UNIT: a unit é um
    -- pacote de N ações ordinárias-equivalentes, então LPA/VPA são POR UNIT, p/ casar
    -- com o preço da unit (do contrário P/L = preço/LPA não fecha). Sem a composição
    -- da unit, derivamos do mc real: lpa_unit = preço × lucro / mc_paper (= preço/P-L)
    -- e vpa_unit = preço × PL / mc_paper (= preço/P-VP). Para ON/PN, onde
    -- mc_paper = preço × total_shares, a fórmula reduz exatamente ao valor por ação.
    case when class_group = 'UNIT'
        then price_paper * net_income_ttm / nullif(mc_paper, 0)
        else net_income_ttm / nullif(total_shares, 0)
    end as lpa,
    case when class_group = 'UNIT'
        then price_paper * equity / nullif(mc_paper, 0)
        else equity / nullif(total_shares, 0)
    end as vpa,

    -- Fundamentos da EMPRESA (iguais em todos os papéis) — replicados p/ que o
    -- consumo por papel seja self-contained no screener.
    net_income_ttm / nullif(equity, 0) as roe,
    net_income_ttm / nullif(total_assets, 0) as roa,
    case when invested_capital > 0 then nopat_ttm / invested_capital end as roic,
    gross_profit_ttm / nullif(revenue_eff_ttm, 0) as margem_bruta,
    ebit_ttm / nullif(revenue_eff_ttm, 0) as margem_ebit,
    net_income_ttm / nullif(revenue_eff_ttm, 0) as margem_liquida,
    ebit_ttm / nullif(total_assets, 0) as ebit_ativos,
    revenue_eff_ttm / nullif(total_assets, 0) as giro_ativos,
    net_debt / nullif(ebitda_ttm, 0) as div_liquida_ebitda,
    net_debt / nullif(equity, 0) as div_liquida_pl,
    gross_debt / nullif(equity, 0) as div_bruta_pl,
    current_assets / nullif(current_liabilities, 0) as liquidez_corrente,
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

    -- Flags
    equity < 0 as negative_equity,
    'fre_sem_ajuste_pos_evento' as shares_quality,
    quarters_available,
    coalesce(
        lower(strip_accents(co.sector)) like '%banco%'
        or lower(strip_accents(co.sector)) like '%financ%'
        or lower(strip_accents(co.sector)) like '%segurad%'
        or lower(strip_accents(co.sector)) like '%previd%'
        or lower(strip_accents(co.sector)) like '%capitaliz%',
        false
    ) as is_financial
from priced
left join co on co.cnpj = priced.cnpj
