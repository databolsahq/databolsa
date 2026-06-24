-- Cadeia de opções vigente: uma linha por série AINDA VIVA (vencimento >= último
-- pregão), com a cotação negociada mais recente. É o snapshot que o consumidor usa
-- para montar a chain por subjacente/vencimento/strike. Séries expiradas ou que
-- nunca negociaram ficam de fora.
with enriched as (
    select * from {{ ref('int_options__enriched') }}
    where volume_brl > 0
),

last_price_date as (
    select max(date) as d from {{ ref('mart_prices__adjusted') }}
)

select
    t.option_ticker,
    t.underlying_ticker,
    t.underlying_root,
    t.option_type,
    t.strike,
    t.expiry,
    t.date,
    t.last,
    t.volume_brl,
    t.trades,
    t.underlying_spot,
    t.days_to_expiry,
    t.moneyness,
    t.intrinsic,
    t.time_value,
    g.iv,
    g.delta,
    g.gamma,
    g.vega,
    g.theta,
    -- IV/Greeks AMERICANOS (binomial CRR, modelo Python) — fecham o viés de
    -- exercício antecipado das puts; null onde o europeu não convergiu.
    a.iv_amer,
    a.delta_amer,
    a.gamma_amer,
    a.vega_amer,
    a.theta_amer,
    a.early_ex_premium
from (
    select *,
        row_number() over (partition by option_ticker order by date desc) as rn
    from enriched
    where expiry >= (select d from last_price_date)
) as t
left join {{ ref('int_options__greeks') }} as g
    on g.option_ticker = t.option_ticker and g.date = t.date
left join {{ ref('int_options__chain_american') }} as a
    on a.option_ticker = t.option_ticker
where rn = 1
