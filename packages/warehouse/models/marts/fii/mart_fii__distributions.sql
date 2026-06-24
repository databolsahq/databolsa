-- Distribuições (rendimentos) por cota de FII (GET /v1/fiis/{ticker}/distributions).
--
-- Fonte primária: Informe de Rendimentos estruturado da B3 FNET — o provento PAGO por
-- cota, com data-com (ex_date) e data de pagamento REAIS. Substitui o proxy do informe
-- mensal CVM (Rendimentos_Distribuir = SALDO a distribuir), que zera em fundos que pagam
-- ~100%/mês (CPTS11, KNCR11…) e os fazia sumir do DY (CPTS11 caía p/ ~2% em vez de ~14%).
--
-- Fallback CVM: para tickers que o FNET ainda não cobriu (backfill incremental do
-- conector fnet_fii roda no cron diário), mantém o cálculo antigo — evita regredir o
-- universo inteiro a null enquanto o FNET não chega. Quando o FNET passa a cobrir um
-- ticker, ele assume e o fallback é excluído (sem dupla contagem).
with fnet as (
    select ticker, ex_date, payment_date, value_per_share, tax_free
    from {{ ref('stg_fnet__fii_rendimentos') }}
),

fnet_tickers as (select distinct ticker from fnet),

cvm_fallback as (
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
        and t.ticker not in (select ticker from fnet_tickers)
)

select ticker, ex_date, payment_date, value_per_share, tax_free from fnet
union all
select ticker, ex_date, payment_date, value_per_share, tax_free from cvm_fallback
order by ticker, ex_date desc
