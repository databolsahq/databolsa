-- Histórico EOD de opções, grão = (option_ticker, date). Apenas sessões em que a
-- série EFETIVAMENTE negociou (volume_brl > 0): séries fantasma (milhares, sem
-- negócio) não viram "cotação". Preço NÃO ajustado por eventos (igual à convenção
-- das ações; o strike também é nominal).
select
    option_ticker,
    underlying_ticker,
    underlying_root,
    option_type,
    strike,
    expiry,
    date,
    open,
    high,
    low,
    last,
    volume_brl,
    trades,
    quantity,
    underlying_spot,
    days_to_expiry,
    moneyness,
    intrinsic,
    time_value,
    g.iv,
    g.delta,
    g.gamma,
    g.vega,
    g.theta
from {{ ref('int_options__enriched') }} as e
left join {{ ref('int_options__greeks') }} as g using (option_ticker, date)
where volume_brl > 0
