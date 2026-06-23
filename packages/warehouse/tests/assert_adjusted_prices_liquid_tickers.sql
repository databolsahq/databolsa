-- Gate da matemática de ajuste: em eventos REAIS verificados manualmente
-- (PETR4 1:2 abr/2008, VALE3 1:2 ago/2007, MGLU3 grupamento 10:1 mai/2024),
-- o preço ajustado tem que ser contínuo (±15% entre o último dia-com e o 1º
-- dia ex). NOTA: o gate de "nenhum papel suspect" NÃO é aplicável hoje — o
-- supplement da B3 tem eventos faltando (PETR 2005, VALE 2004/2006, BBDC
-- 2004–2007, WEGE 2015, MGLU 2017/2019) e ao menos um espúrio (ITUB
-- "grupamento" 2011); preços ajustados seguem em preparação
-- até o CVM EVENTOS entrar como fonte cruzada.
with verified_events as (
    select 'PETR4' as ticker, date '2008-04-25' as last_cum_date
    union all select 'VALE3', date '2007-08-31'
    union all select 'MGLU3', date '2024-05-24'
),

px as (
    select ticker, date, close_adj
    from {{ ref('mart_prices__adjusted') }}
    where ticker in (select ticker from verified_events)
),

pairs as (
    select
        v.ticker,
        v.last_cum_date,
        (select p.close_adj from px as p
         where p.ticker = v.ticker and p.date <= v.last_cum_date
         order by p.date desc limit 1) as close_before,
        (select p.close_adj from px as p
         where p.ticker = v.ticker and p.date > v.last_cum_date
         order by p.date asc limit 1) as close_after
    from verified_events as v
)

select *
from pairs
where close_before is null
    or close_after is null
    or abs(close_after / close_before - 1.0) > 0.15
