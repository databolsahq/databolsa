-- Distribuições mensais de rendimento por ticker (GET /v1/fiis/{ticker}/distributions).
-- value_per_share = rendimentos a distribuir ÷ cotas emitidas (informe mensal CVM);
-- ex_date = último dia do mês de referência (data-com convencional do FII); isento
-- de IR para PF. payment_date não consta do informe → null.
select
    t.ticker,
    (date_trunc('month', s.reference_date) + interval 1 month - interval 1 day)::date as ex_date,
    cast(null as date) as payment_date,
    round(s.rendimentos_distribuir / nullif(s.shares_issued, 0), 6) as value_per_share,
    true as tax_free
from {{ ref('stg_cvm__fii_mensal') }} s
join {{ ref('int_fii__ticker') }} t on t.isin = s.isin
where s.rendimentos_distribuir is not null
    and s.shares_issued is not null
    and s.rendimentos_distribuir > 0
order by t.ticker, ex_date desc
