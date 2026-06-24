-- Insumos da cadeia VIGENTE (1 linha por série viva, cotação mais recente) para o
-- pricer AMERICANO em Python (int_options__chain_american). Espelha a seleção de
-- séries vivas de mart_options__chain e anexa r/q/IV-europeu do int_options__greeks.
-- Só séries com IV europeu válido entram (onde o BS convergiu = conjunto relevante).
with enriched as (
    select * from {{ ref('int_options__enriched') }} where volume_brl > 0
),

last_price_date as (
    select max(date) as d from {{ ref('mart_prices__adjusted') }}
),

live as (
    select * from (
        select *, row_number() over (partition by option_ticker order by date desc) as rn
        from enriched
        where expiry >= (select d from last_price_date)
    ) as t
    where rn = 1
)

select
    l.option_ticker,
    l.option_type,
    l.underlying_spot::double as s,
    l.strike::double as k,
    l.days_to_expiry::double / 365.0 as t,
    g.r,
    g.q,
    l.last::double as price,
    g.iv as iv_euro
from live as l
join {{ ref('int_options__greeks') }} as g using (option_ticker, date)
where g.iv is not null
