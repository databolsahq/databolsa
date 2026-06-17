-- Opções enriquecidas com o subjacente à vista: resolve o ticker de referência
-- por raiz (a ação mais líquida nos últimos 90 dias — opção de PETR liquida em
-- PETR4, não PETR3), junta o spot NÃO ajustado (strike é nominal/as-listed, então
-- moneyness usa close_raw) e deriva moneyness, dias até o vencimento, valor
-- intrínseco e valor no tempo. IV/Greeks ficam para um modelo seguinte (sem
-- numpy/scipy no ambiente; Black-Scholes em SQL com erf vem depois).
with opt as (
    select * from {{ ref('stg_b3__options') }}
),

last_price_date as (
    select max(date) as d from {{ ref('mart_prices__adjusted') }}
),

-- ticker de referência por raiz = ação à vista mais líquida (90d) da mesma raiz
underlying as (
    select root, ticker from (
        select
            regexp_replace(ticker, '[0-9]{1,2}$', '') as root,
            ticker,
            sum(volume_brl) as vol
        from {{ ref('mart_prices__adjusted') }}
        where codbdi in ('02', '12', '14')
          and date >= (select d from last_price_date) - interval 90 day
        group by 1, 2
        qualify row_number() over (
            partition by regexp_replace(ticker, '[0-9]{1,2}$', '') order by vol desc
        ) = 1
    )
),

spot as (
    select ticker, date, close_raw from {{ ref('mart_prices__adjusted') }}
)

select
    o.option_ticker,
    o.underlying_root,
    u.ticker as underlying_ticker,
    o.option_type,
    o.strike,
    o.expiry,
    o.date,
    o.open,
    o.high,
    o.low,
    o.last,
    o.volume_brl,
    o.trades,
    o.quantity,
    o.isin,
    s.close_raw as underlying_spot,
    date_diff('day', o.date, o.expiry) as days_to_expiry,
    case when s.close_raw is not null and o.strike > 0
        then s.close_raw / o.strike end as moneyness,
    case o.option_type
        when 'call' then greatest(coalesce(s.close_raw, 0) - o.strike, 0)
        else greatest(o.strike - coalesce(s.close_raw, 0), 0)
    end as intrinsic,
    o.last - case o.option_type
        when 'call' then greatest(coalesce(s.close_raw, 0) - o.strike, 0)
        else greatest(o.strike - coalesce(s.close_raw, 0), 0)
    end as time_value
from opt as o
left join underlying as u on u.root = o.underlying_root
left join spot as s on s.ticker = u.ticker and s.date = o.date
