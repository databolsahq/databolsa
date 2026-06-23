-- Indicadores imobiliários por ticker, do informe TRIMESTRAL CVM (só fundos de
-- tijolo). vacancia_fisica = média da vacância dos imóveis no último trimestre
-- (a CVM grava fração → ×100). cap_rate = aluguel 12m ÷ valor dos imóveis
-- (Direitos_Bens_Imoveis do informe mensal), anualizado e em %. qtd imóveis / ABL
-- / preço m² / aluguel m² vêm das linhas de imóvel (Nome_Imovel/Area).
-- (FFO Yield NÃO vem daqui — o DRE trimestral é esparso/subtotalizado; é
--  calculado em mart_fii__indicators a partir do Rendimentos_Distribuir mensal.)
with trim_base as (
    select
        coalesce(
            nullif(regexp_replace(coalesce("CNPJ_Fundo_Classe", "CNPJ_Fundo"), '[^0-9]', '', 'g'), ''),
            regexp_replace("CNPJ_Fundo", '[^0-9]', '', 'g')
        ) as ukey,
        cast("Data_Referencia" as date) as ref_date,
        "Codigo_ISIN" as isin,
        "Nome_Imovel" as imovel,
        try_cast("Area" as double) as area,
        try_cast("Percentual_Vacancia" as double) as vacancy,
        try_cast("Receita_Aluguel_Investimento_Contabil" as double) as rental
    from {{ source('raw_cvm', 'fii_inf_trimestral') }}
    where coalesce("CNPJ_Fundo_Classe", "CNPJ_Fundo") is not null and "Data_Referencia" is not null
),

-- Imóveis (linhas com Nome_Imovel; Nome_Fundo vem nulo nessas linhas, a chave é o
-- CNPJ). Dedupe por imóvel/trimestre antes de agregar (a CVM repete o mesmo imóvel
-- em sub-linhas). qtd e área somada do trimestre mais recente com imóveis.
prop_dedup as (
    select ukey, ref_date, imovel, max(area) as area
    from trim_base
    where imovel is not null and trim(imovel) <> ''
    group by 1, 2, 3
),

properties as (
    select ukey, ref_date, count(*) as qtd_imoveis, sum(area) as area_total
    from prop_dedup
    group by 1, 2
    qualify row_number() over (partition by ukey order by ref_date desc) = 1
),

isin_map as (
    select ukey, any_value(isin) as isin from trim_base where isin is not null group by ukey
),

-- agregados por trimestre (vacância média entre imóveis; aluguel somado)
quarterly as (
    select ukey, ref_date, avg(vacancy) as vac_avg, sum(rental) as rental_q
    from trim_base
    group by ukey, ref_date
),

latest_vac as (
    select ukey, ref_date, vac_avg
    from quarterly
    where vac_avg is not null
    qualify row_number() over (partition by ukey order by ref_date desc) = 1
),

rental_12m as (
    select ukey, sum(rental_q) as rental_12m
    from (
        select ukey, rental_q, row_number() over (partition by ukey order by ref_date desc) as rn
        from quarterly
    )
    where rn <= 4
    group by ukey
),

-- valor dos imóveis: último informe mensal com Direitos_Bens_Imoveis
property as (
    select isin, property_value
    from {{ ref('stg_cvm__fii_mensal') }}
    where property_value is not null and property_value > 0
    qualify row_number() over (partition by isin order by reference_date desc) = 1
)

select
    t.ticker,
    lv.ref_date as reference_date,
    round(lv.vac_avg * 100, 4) as vacancia_fisica,
    case
        when p.property_value > 0 and r.rental_12m is not null
        then round(r.rental_12m / p.property_value * 100, 4)
    end as cap_rate,
    prp.qtd_imoveis,
    prp.area_total as area_m2,
    -- Preço do m² = valor dos imóveis ÷ ABL. Aluguel por m² = aluguel 12m ÷ 12 ÷
    -- ABL (mensal), convenção do Fundamentus.
    case when prp.area_total > 0 and p.property_value > 0
        then round(p.property_value / prp.area_total, 2) end as preco_m2,
    case when prp.area_total > 0 and r.rental_12m is not null
        then round(r.rental_12m / 12.0 / prp.area_total, 2) end as aluguel_m2
from latest_vac lv
join isin_map im on im.ukey = lv.ukey
join {{ ref('int_fii__ticker') }} t on t.isin = im.isin
left join rental_12m r on r.ukey = lv.ukey
left join property p on p.isin = im.isin
left join properties prp on prp.ukey = lv.ukey
-- 1 linha por ticker: desde 2024 um fundo tem CNPJ de classe distinto do CNPJ do
-- fundo, gerando 2 ukeys que mapeiam ao mesmo isin/ticker. Fica com o mais recente.
qualify row_number() over (partition by t.ticker order by lv.ref_date desc) = 1
