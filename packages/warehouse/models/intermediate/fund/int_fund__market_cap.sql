-- Market cap por (cnpj, data de avaliação): Σ classes (ON × preço ON + PN ×
-- preço PN), classe PN representada pelo ticker mais líquido (volume total
-- histórico — simplificação documentada). Datas de avaliação = ref_dates dos
-- balanços + último pregão disponível.
with eval_dates as (
    select distinct cnpj, ref_date as eval_date from {{ ref('int_fund__ttm') }}
    union
    select distinct t.cnpj, (select max(date) from {{ ref('int_fund__prices') }}) as eval_date
    from {{ ref('int_fund__ttm') }} as t
),

-- ticker mais líquido por (cnpj, class_group). Liquidez RECENTE (90 dias) vence:
-- numa renomeação (EMBR3→EMBJ3, ELET3→AXIA3) o ticker MORTO acumula volume
-- histórico mas zera nos últimos 90 dias, então o ticker VIVO assume e a empresa
-- segue sendo precificada nas datas atuais. Sem recência (empresa de fato
-- deslistada) cai no desempate por volume histórico — preserva o comportamento antigo.
last_price_date as (
    select max(date) as d from {{ ref('int_fund__prices') }}
),

liquidity as (
    select
        m.cnpj,
        m.class_group,
        m.ticker,
        sum(p.volume_brl) as total_volume,
        coalesce(sum(p.volume_brl) filter (
            where p.date >= (select d from last_price_date) - interval 90 day
        ), 0) as recent_volume
    from {{ ref('int_fund__ticker_map') }} as m
    inner join {{ ref('int_fund__prices') }} as p on m.ticker = p.ticker
    where m.class_group in ('ON', 'PN')
    group by 1, 2, 3
),

main_ticker as (
    select * from liquidity
    qualify row_number() over (
        partition by cnpj, class_group
        order by recent_volume desc, total_volume desc
    ) = 1
),

-- preço asof (≤ 10 dias corridos da data de avaliação)
priced as (
    select
        e.cnpj,
        e.eval_date,
        m.class_group,
        m.ticker,
        m.total_volume,
        p.close,
        p.date as price_date
    from eval_dates as e
    inner join main_ticker as m on e.cnpj = m.cnpj
    asof join {{ ref('int_fund__prices') }} as p
        on m.ticker = p.ticker and e.eval_date >= p.date
    where p.date >= e.eval_date - interval 10 days
),

with_shares as (
    select
        p.*,
        s.on_shares,
        s.pn_shares,
        s.total_shares
    from priced as p
    asof join {{ ref('int_fund__shares') }} as s
        on p.cnpj = s.cnpj and p.eval_date >= s.approval_date
)

select
    cnpj,
    eval_date,
    sum(case when class_group = 'ON' then close * on_shares
             when class_group = 'PN' then close * pn_shares end) as market_cap,
    -- se só uma classe negocia mas existem as duas, completa com o preço da que negocia
    max(total_shares) as total_shares,
    max(on_shares) as on_shares,
    max(pn_shares) as pn_shares,
    count(distinct class_group) as classes_priced,
    max(case when class_group = 'PN' then 1 else 0 end) = 1 as has_pn_priced,
    arg_max(ticker, total_volume) as main_ticker,
    arg_max(close, total_volume) as main_price,
    max(price_date) as price_date
from with_shares
group by 1, 2
