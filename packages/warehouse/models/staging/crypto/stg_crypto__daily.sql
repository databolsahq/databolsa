-- Velas diárias Binance em BRL. open_time é UTC naive (limitação conhecida):
-- timezones não normalizadas entre fontes).
select
    cast(open_time as date) as date,
    symbol,
    open,
    high,
    low,
    close,
    volume,
    quote_volume,
    trades
from {{ source('raw_crypto', 'crypto_daily') }}
