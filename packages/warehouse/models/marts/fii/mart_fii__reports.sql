-- Informes mensais por ticker (GET /v1/fiis/{ticker}/reports): PL, valor
-- patrimonial da cota, DY do mês, nº de cotistas e cotas emitidas.
select
    t.ticker,
    strftime(s.reference_date, '%Y-%m') as reference_month,
    s.net_asset_value,
    s.value_per_share,
    s.dividend_yield_mes as monthly_dividend_yield_pct,
    s.shareholders,
    s.shares_issued
from {{ ref('stg_cvm__fii_mensal') }} s
join {{ ref('int_fii__ticker') }} t on t.isin = s.isin
where s.net_asset_value is not null or s.value_per_share is not null
order by t.ticker, reference_month desc
