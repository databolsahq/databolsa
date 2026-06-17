-- Velas diárias de criptoativos em BRL (Binance) — serve GET /v1/crypto/{symbol}/quotes.
-- v1 = intervalo diário (1d); o 1h (intraday) fica fora do serving por ora.
select
    symbol,
    date,
    open,
    high,
    low,
    close,
    volume,
    quote_volume,
    trades
from {{ ref('stg_crypto__daily') }}
where close is not null
order by symbol, date
