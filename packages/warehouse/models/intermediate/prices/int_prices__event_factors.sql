-- Fator de ajuste ACUMULADO por (ticker, data): produto de 1/share_ratio de
-- todos os eventos com data-com >= data do preço (aplicação backward —
-- docs/indicators.md). Ticker derivado do ISIN
-- (raiz + sufixo da classe); eventos de tickers renomeados se aplicam à cadeia
-- inteira via chain_id quando o FCA conhece o ticker.
with events as (
    select
        issuer || case share_class
            when 'ON' then '3'
            when 'PN' then '4'
            when 'PNA' then '5'
            when 'PNB' then '6'
        end as ticker,
        last_cum_date,
        event_type,
        share_ratio
    from {{ ref('stg_b3__events') }}
    where share_ratio is not null and share_ratio > 0
),

-- propaga eventos para tickers anteriores da mesma cadeia (ex.: evento pós-
-- rename vale para o histórico do ticker antigo)
chained as (
    select
        coalesce(c_old.ticker, e.ticker) as ticker,
        e.last_cum_date,
        e.event_type,
        e.share_ratio
    from events as e
    left join {{ ref('int_prices__ticker_chain') }} as c_new on e.ticker = c_new.ticker
    left join {{ ref('int_prices__ticker_chain') }} as c_old
        on c_new.chain_id = c_old.chain_id
)

select distinct
    ticker,
    last_cum_date,
    event_type,
    share_ratio,
    1.0 / share_ratio as price_multiplier
from chained
