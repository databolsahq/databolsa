-- Proventos em dinheiro por TICKER (contrato: GET /v1/stocks/{ticker}/dividends).
-- As fontes B3 chegam por (issuer, classe) — resolvemos ao ticker vigente daquela
-- (raiz, classe) via int_b3__ticker_class. ex_date = primeiro pregão SEM direito
-- = próximo pregão B3 após last_cum_date (lastDatePrior = último dia COM direito).
-- JCP: valor reportado é BRUTO; net = 85% (15% IRRF na fonte p/ PF). Dividendos
-- são isentos p/ PF → net = bruto.
with divs as (
    select * from {{ ref('stg_b3__cash_dividends') }}
    where last_cum_date is not null and value_per_share is not null
),

-- um ticker por (raiz, classe): pregão mais recente vence
ticker_class as (
    select root, class_group, ticker
    from {{ ref('int_b3__ticker_class') }}
    qualify row_number() over (partition by root, class_group order by last_traded desc) = 1
),

trading_days as (
    select distinct date as d from {{ ref('stg_b3__cotahist') }}
),

joined as (
    select
        tc.ticker,
        case when d.dividend_type = 'JCP' then 'JCP' else 'DIVIDENDO' end as type,
        d.last_cum_date,
        d.payment_date,
        round(d.value_per_share, 6) as value_per_share_gross,
        round(
            case when d.dividend_type = 'JCP' then d.value_per_share * 0.85 else d.value_per_share end,
            6
        ) as value_per_share_net
    from divs d
    join ticker_class tc
        on tc.root = d.issuer and tc.class_group = d.share_class
),

priced as (
    select
        j.ticker,
        j.type,
        -- próximo pregão estritamente após o último dia COM direito
        (select min(td.d) from trading_days td where td.d > j.last_cum_date) as ex_date,
        j.payment_date,
        j.value_per_share_gross,
        j.value_per_share_net
    from joined j
)

select ticker, type, ex_date, payment_date, value_per_share_gross, value_per_share_net
from priced
-- proventos sem pregão futuro conhecido (data-com no futuro) ficam de fora do v1
where ex_date is not null
order by ticker, ex_date
