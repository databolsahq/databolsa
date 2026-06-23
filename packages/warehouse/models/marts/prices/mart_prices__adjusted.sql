-- OHLCV ajustado por eventos societários (desdobramento/grupamento/bonificação;
-- proventos NÃO descontados — adjust_type='events_only', convenção documentada).
-- adjust_quality:
--   full      = sem quebras inexplicadas
--   suspect_unrecorded_event = queda >40% em D sem evento/provento conhecido
--               (mitigação p/ delistadas sem fonte de eventos)
--   no_event_source = ticker sem NENHUM evento/provento conhecido na B3
--               (tipicamente delistada antiga: ajuste não confiável)
with prices as (
    select date, ticker, codbdi, open, high, low, close, volume_brl, quantity, isin
    from {{ ref('stg_b3__cotahist') }}
    -- 02 ações, 12 FII, 14 ETF, 34/35 BDR (não-patrocinado/patrocinado).
    -- BDR não tem fonte de eventos aberta (emissor estrangeiro, fora da CVM) →
    -- cai em adjust_quality='no_event_source' (k.ticker null), sem corromper nada.
    where codbdi in ('02', '12', '14', '34', '35')
),

factors as (
    select * from {{ ref('int_prices__event_factors') }}
),

-- Fator de PROVENTO p/ retorno total (close_tr): cada data-com derruba o preço no
-- ex; reinvestir o provento BRUTO neutraliza essa queda. Multiplicador =
-- 1 − provento/fechamento_na_data_com (em (0,1)). Duas fontes, unidas em div_factors:
--   • ações ON/PN/PNA/PNB (3/4/5/6) via stg_b3__cash_dividends;
--   • FIIs via mart_fii__distributions (rendimento mensal do informe CVM).
div_per_cum_date as (
    select
        issuer || case share_class
            when 'ON' then '3' when 'PN' then '4' when 'PNA' then '5' when 'PNB' then '6'
        end as ticker,
        last_cum_date,
        sum(value_per_share) as div_per_share  -- DIVIDENDO + JCP na mesma data-com
    from {{ ref('stg_b3__cash_dividends') }}
    where last_cum_date is not null and value_per_share > 0
    group by 1, 2
),

eq_div_factors as (
    select
        d.ticker,
        d.last_cum_date,
        1.0 - d.div_per_share / p.close as price_multiplier
    from div_per_cum_date as d
    -- fechamento bruto na própria data-com (a queda é sobre o preço negociado)
    join prices as p on p.ticker = d.ticker and p.date = d.last_cum_date
    where d.ticker is not null and p.close > 0 and d.div_per_share < p.close
),

-- FII: rendimento mensal por cota. ex_date é a data-com convencional (último dia do
-- mês de referência) e pode não ser pregão → usa o fechamento do último pregão <= ex_date.
fii_div_factors as (
    select
        f.ticker,
        f.ex_date as last_cum_date,
        1.0 - f.value_per_share / (
            select px.close
            from prices as px
            where px.ticker = f.ticker and px.date <= f.ex_date and px.close > 0
            order by px.date desc
            limit 1
        ) as price_multiplier
    from {{ ref('mart_fii__distributions') }} as f
    where f.value_per_share > 0
),

div_factors as (
    select ticker, last_cum_date, price_multiplier from eq_div_factors
    union all
    select ticker, last_cum_date, price_multiplier
    from fii_div_factors
    -- guarda os casos sem pregão <= ex_date (multiplier null) ou rendimento >= cota
    where price_multiplier is not null and price_multiplier > 0 and price_multiplier <= 1
),

-- fator acumulado vigente para cada preço: produto dos multiplicadores de
-- eventos (adj_factor) e, separadamente, de proventos (div_factor) com
-- data-com >= data do preço
cum as (
    select
        p.*,
        coalesce((
            select product(f.price_multiplier)
            from factors as f
            where f.ticker = p.ticker and f.last_cum_date >= p.date
        ), 1.0) as adj_factor,
        coalesce((
            select product(df.price_multiplier)
            from div_factors as df
            where df.ticker = p.ticker and df.last_cum_date >= p.date
        ), 1.0) as div_factor
    from prices as p
),

known_tickers as (
    select distinct ticker from factors
    union
    select distinct issuer || case share_class
        when 'ON' then '3' when 'PN' then '4' when 'PNA' then '5' when 'PNB' then '6'
        else '0' end as ticker
    from {{ ref('stg_b3__cash_dividends') }}
),

divs as (
    select
        issuer || case share_class
            when 'ON' then '3' when 'PN' then '4' when 'PNA' then '5' when 'PNB' then '6'
            else '0' end as ticker,
        last_cum_date
    from {{ ref('stg_b3__cash_dividends') }}
    where last_cum_date is not null
),

adjusted as (
    select
        c.*,
        c.close * c.adj_factor as close_adj,
        lag(c.close * c.adj_factor) over (partition by c.ticker order by c.date) as prev_close_adj,
        lag(c.date) over (partition by c.ticker order by c.date) as prev_date
    from cum as c
),

breaks as (
    select
        a.ticker,
        count(*) as unexplained_breaks
    from adjusted as a
    left join factors as f
        on a.ticker = f.ticker
        and f.last_cum_date >= a.prev_date and f.last_cum_date < a.date
    left join divs as d
        on a.ticker = d.ticker
        and d.last_cum_date >= a.prev_date and d.last_cum_date < a.date
    where a.close_adj / nullif(a.prev_close_adj, 0) - 1.0 < -0.40
        and a.date - a.prev_date <= 7      -- gap longo de negociação não conta
        and f.ticker is null and d.ticker is null
    group by 1
)

select
    a.date,
    a.ticker,
    a.codbdi,
    a.isin,
    a.open * a.adj_factor as open_adj,
    a.high * a.adj_factor as high_adj,
    a.low * a.adj_factor as low_adj,
    a.close_adj,
    -- retorno total: close ajustado por eventos E por proventos reinvestidos (bruto)
    a.close_adj * a.div_factor as close_tr,
    a.close as close_raw,
    a.adj_factor,
    a.volume_brl,
    a.quantity,
    'events_only' as adjust_type,
    case
        when k.ticker is null then 'no_event_source'
        when b.ticker is not null then 'suspect_unrecorded_event'
        else 'full'
    end as adjust_quality
from adjusted as a
left join breaks as b on a.ticker = b.ticker
left join known_tickers as k on a.ticker = k.ticker
