-- Eventos societários por TICKER (contrato: GET /v1/stocks/{ticker}/events).
-- Resolvemos ao ticker vigente pelo ISIN (a classe está embutida nele). factor =
-- share_ratio já NORMALIZADO no staging (split 1:2 → 2.0; grupamento 100:1 → 0.01;
-- bonificação 10% → 1.1). ex_date = próximo pregão após last_cum_date.
with events as (
    select * from {{ ref('stg_b3__events') }}
    where share_ratio is not null and last_cum_date is not null
),

-- um ticker por ISIN: pregão mais recente vence
ticker_by_isin as (
    select isin, ticker
    from {{ ref('int_b3__ticker_class') }}
    where isin is not null
    qualify row_number() over (partition by isin order by last_traded desc) = 1
),

trading_days as (
    select distinct date as d from {{ ref('stg_b3__cotahist') }}
),

joined as (
    select
        ti.ticker,
        case e.event_type
            when 'DESDOBRAMENTO' then 'split'
            when 'GRUPAMENTO' then 'reverse_split'
            when 'BONIFICACAO' then 'bonification'
        end as type,
        e.approval_date as approved_date,
        e.last_cum_date,
        round(e.share_ratio, 8) as factor,
        case e.event_type
            when 'DESDOBRAMENTO' then 'Desdobramento ' || round(e.factor_raw, 2) || '%'
            when 'GRUPAMENTO' then 'Grupamento (razão ' || round(e.share_ratio, 4) || ')'
            when 'BONIFICACAO' then 'Bonificação ' || round(e.factor_raw, 2) || '%'
        end as detail
    from events e
    join ticker_by_isin ti on ti.isin = e.isin
),

priced as (
    select
        ticker,
        type,
        approved_date,
        (select min(td.d) from trading_days td where td.d > j.last_cum_date) as ex_date,
        factor,
        detail
    from joined j
)

select ticker, type, approved_date, ex_date, factor, detail
from priced
where type is not null and ex_date is not null
order by ticker, ex_date
