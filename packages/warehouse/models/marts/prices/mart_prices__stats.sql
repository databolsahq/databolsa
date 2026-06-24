-- Estatísticas de mercado por ticker (snapshot mais recente) derivadas da série de
-- preços ajustados + IBOV. Alimenta o grupo "Performance e risco" da UI.
--   retorno_12m    = retorno dos últimos ~252 pregões (close ajustado), em %
--   volatilidade   = desvio-padrão dos retornos diários log × √252, anualizado, em %
--   beta           = cov(retorno ativo, retorno IBOV) / var(IBOV), janela 252 pregões
--   volume_medio_2m= volume financeiro médio (R$) dos últimos ~42 pregões
-- Convenção: % já multiplicado por 100 (a API anexa estes indicadores sem reescalar).
with base as (
    select ticker, date, close_adj, coalesce(volume_brl, 0) as vol
    from {{ ref('mart_prices__adjusted') }}
    where close_adj is not null and close_adj > 0
),

with_ret as (
    select
        ticker,
        date,
        close_adj,
        vol,
        ln(close_adj / lag(close_adj) over (partition by ticker order by date)) as ret,
        row_number() over (partition by ticker order by date desc) as rn
    from base
),

ibov as (
    select date, ln(close / lag(close) over (order by date)) as mret
    from {{ ref('mart_indices__quotes') }}
    where code = 'IBOV' and close > 0
),

stats as (
    select
        ticker,
        max(date) filter (where rn = 1) as reference_date,
        round(stddev_samp(ret) filter (where rn <= 252) * sqrt(252) * 100, 4) as volatilidade,
        round(avg(vol) filter (where rn <= 42), 2) as volume_medio_2m,
        max(close_adj) filter (where rn = 1) as last_close,
        max(close_adj) filter (where rn = 253) as year_close
    from with_ret
    group by ticker
),

beta as (
    select
        w.ticker,
        round(covar_samp(w.ret, i.mret) / nullif(var_samp(i.mret), 0), 4) as beta
    from with_ret w
    join ibov i on i.date = w.date
    where w.rn <= 252 and w.ret is not null
    group by w.ticker
)

select
    s.ticker,
    s.reference_date,
    case when s.year_close > 0 then round((s.last_close / s.year_close - 1) * 100, 4) end as retorno_12m,
    s.volatilidade,
    b.beta,
    s.volume_medio_2m
from stats s
left join beta b on b.ticker = s.ticker
where s.reference_date is not null
