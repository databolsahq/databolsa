-- Proventos por ação acumulados 12m por (cnpj, classe, data de avaliação).
-- JCP entra BRUTO (docs/indicators.md). Janela por last_cum_date.
--
-- AJUSTE A EVENTOS: o preço usado no DY é AS-TRADED na data de avaliação (pós-split),
-- mas o provento foi pago em cotas PRÉ-split. Sem ajuste, um provento antes de um
-- desdobramento (CEB: DESDOBRAMENTO 5:1 em out/2021, R$55/cota antiga) dividido pelo
-- preço pós-split (R$15) estoura o DY (615%). Reescalamos cada provento pelo MESMO
-- price_multiplier que ajusta os preços (int_prices__event_factors), trazendo-o à base
-- de cotas da data de avaliação. NÃO limita o DY: retorno de capital real sobrevive.
--
-- CLASSE RESOLVIDA: PNA/PNB só viram baldes próprios quando a empresa NEGOCIA os
-- tickers 5/6 (ex.: CEBR5 e CEBR6, CPLE5/6). Aí o DY de cada um usa só o SEU provento.
-- Quando só o PN-4 negocia (caso comum), proventos PNA/PNB colapsam em PN (a fonte
-- registra PNA mas a ação negociada é PN). Decisão por empresa, via tickers do FCA.
with divs_base as (
    select
        issuer,
        share_class,
        last_cum_date,
        dividend_type,
        value_per_share
    from {{ ref('stg_b3__cash_dividends') }}
    where last_cum_date is not null and value_per_share is not null
        -- Descarta proventos corrompidos p/ DY usando o preço da PRÓPRIA ação no ex:
        --   (a) provento > preço no ex = impossível (24 eventos: MMAQ R$15,41 c/ cota R$2);
        --   (b) sem preço no ex + valor absurdo por ação (>R$50) = classe de alto valor
        --       de face NÃO-negociada vazando no ticker (HBTS PNB R$929, OPDC R$126k).
        and not (close_before_ex > 0 and value_per_share > close_before_ex)
        and not (coalesce(close_before_ex, 0) <= 0 and value_per_share > 50)
),

-- Fatores de split/grupamento/bonificação deduplicados à raiz do emissor (o mesmo
-- evento aparece por classe com ratio idêntico; price_multiplier = 1/share_ratio).
events as (
    select distinct
        left(ticker, 4) as issuer,
        last_cum_date as ev_date,
        price_multiplier
    from {{ ref('int_prices__event_factors') }}
),

-- Fator acumulado de cada provento: Π dos multiplicadores de eventos com data-com
-- DEPOIS do provento (traz a cota da época do provento à base "mais recente").
divs as (
    select
        d.issuer,
        d.share_class,
        d.last_cum_date,
        d.dividend_type,
        d.value_per_share,
        -- UNIT NÃO herda eventos de ON/PN: num grupamento de classe a unit é
        -- rebalanceada e o preço da unit fica CONTÍNUO (SANB3 0,15→8,16 no grup. 55:1
        -- de 2014; SANB11 15,30→16,10 sem salto). int_prices__event_factors também não
        -- mapeia UNIT → preço da unit não-ajustado; espelhamos isso aqui (cf=1).
        -- >= : evento na MESMA data-com do provento já o afeta (ex no pregão seguinte),
        -- então o provento entra na base pós-evento (ex.: bonificação GSHP 2019-03-26).
        case when d.share_class = 'UNIT' then 1.0 else coalesce(
            (select exp(sum(ln(ev.price_multiplier)))
             from events ev
             where ev.issuer = d.issuer and ev.ev_date >= d.last_cum_date),
            1.0
        ) end as cf_div
    from divs_base d
),

eval_dates as (
    select distinct cnpj, eval_date from {{ ref('int_fund__market_cap') }}
),

-- liga issuer (raiz B3 de 4 letras) ao cnpj via ticker do FCA
issuer_map as (
    select distinct cnpj, left(ticker, 4) as issuer
    from {{ ref('int_fund__ticker_map') }}
),

-- A empresa negocia PNA (ticker 5) e/ou PNB (ticker 6)? Decide se separamos os baldes.
company_pref as (
    select
        cnpj,
        bool_or(regexp_extract(ticker, '(\d+)$', 1) = '5') as has_pna,
        bool_or(regexp_extract(ticker, '(\d+)$', 1) = '6') as has_pnb
    from {{ ref('int_fund__ticker_map') }}
    group by cnpj
),

-- Fator acumulado da própria data de avaliação (mesma lógica): divide-se por ele
-- p/ levar o provento da base "mais recente" à base de cotas DA data de avaliação.
eval_factor as (
    select
        e.cnpj,
        e.eval_date,
        im.issuer,
        -- >= idem: um evento NA data de avaliação tem ex no pregão seguinte, então
        -- ainda NÃO está no preço as-traded da data — cancela-se com cf_div e não ajusta.
        coalesce(
            (select exp(sum(ln(ev.price_multiplier)))
             from events ev
             where ev.issuer = im.issuer and ev.ev_date >= e.eval_date),
            1.0
        ) as cf_eval
    from eval_dates as e
    inner join issuer_map as im on e.cnpj = im.cnpj
),

adjusted as (
    select
        ef.cnpj,
        ef.eval_date,
        case
            when d.share_class = 'ON' then 'ON'
            when d.share_class = 'UNIT' then 'UNIT'
            when d.share_class = 'PNA' and cp.has_pna then 'PNA'
            when d.share_class = 'PNB' and cp.has_pnb then 'PNB'
            else 'PN'
        end as class_group,
        d.dividend_type,
        -- traz o provento à base de cotas da data de avaliação; UNIT não ajusta (cf=1).
        d.value_per_share * d.cf_div
            / (case when d.share_class = 'UNIT' then 1.0 else ef.cf_eval end) as adj_vps
    from eval_factor as ef
    inner join divs as d
        on d.issuer = ef.issuer
        and d.last_cum_date > ef.eval_date - interval 12 months
        and d.last_cum_date <= ef.eval_date
    left join company_pref as cp on cp.cnpj = ef.cnpj
)

select
    cnpj,
    eval_date,
    class_group,
    sum(adj_vps) as dps_12m,
    sum(case when dividend_type = 'JCP' then adj_vps else 0 end) as jcp_ps_12m,
    sum(case when dividend_type != 'JCP' then adj_vps else 0 end) as div_ps_12m
from adjusted
group by 1, 2, 3
