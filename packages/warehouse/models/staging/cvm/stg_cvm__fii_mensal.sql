-- Informe mensal de FII (CVM). O dataset divide cada fundo-mês em VÁRIAS linhas
-- (uma com ISIN/segmento/admin, outra com os financeiros PL/VP/cotistas) — elas se
-- casam por (CNPJ, mês). Agrupamos por (cnpj, mês) e coalescemos: a parte ISIN dá
-- o ticker e o perfil; a parte financeira dá os números. (FIIs RCVM175 têm meses
-- recentes esparsos — o downstream usa o último mês cheio.)
with base as (
    select
        *,
        -- pós-RCVM175 os financeiros migram p/ o CNPJ da CLASSE; a chave que casa
        -- a linha-ISIN com a linha-financeira é coalesce(classe, fundo).
        coalesce(
            nullif(regexp_replace(coalesce("CNPJ_Fundo_Classe", "CNPJ_Fundo"), '[^0-9]', '', 'g'), ''),
            regexp_replace("CNPJ_Fundo", '[^0-9]', '', 'g')
        ) as ukey,
        regexp_replace(coalesce("CNPJ_Fundo", "CNPJ_Fundo_Classe"), '[^0-9]', '', 'g') as cnpj_display,
        cast("Data_Referencia" as date) as ref_date
    from {{ source('raw_cvm', 'fii_inf_mensal') }}
    where coalesce("CNPJ_Fundo_Classe", "CNPJ_Fundo") is not null and "Data_Referencia" is not null
),

isin_part as (
    select
        ukey,
        ref_date,
        any_value(cnpj_display) as cnpj,
        any_value("Codigo_ISIN") as isin,
        any_value("Nome_Fundo") as name,
        any_value("Segmento_Atuacao") as segment_raw,
        any_value("Mandato") as mandate,
        any_value("Nome_Administrador") as administrator
    from base
    where "Codigo_ISIN" is not null
    group by ukey, ref_date
),

fin_part as (
    select
        ukey,
        ref_date,
        max(try_cast("Patrimonio_Liquido" as double)) as net_asset_value,
        max(try_cast("Valor_Patrimonial_Cotas" as double)) as value_per_share,
        -- a CVM grava o DY do mês como FRAÇÃO (0.0107 = 1,07%); ×100 p/ a convenção
        -- de "percent" do contrato (a UI anexa % sem reescalar).
        100 * max(try_cast("Percentual_Dividend_Yield_Mes" as double)) as dividend_yield_mes,
        max(try_cast("Total_Numero_Cotistas" as bigint)) as shareholders,
        max(coalesce(try_cast("Cotas_Emitidas" as double), try_cast("Quantidade_Cotas_Emitidas" as double))) as shares_issued,
        max(try_cast("Rendimentos_Distribuir" as double)) as rendimentos_distribuir,
        max(try_cast("Direitos_Bens_Imoveis" as double)) as property_value
    from base
    where "Patrimonio_Liquido" is not null or "Rendimentos_Distribuir" is not null
    group by ukey, ref_date
)

select
    i.isin,
    i.cnpj,
    i.ref_date as reference_date,
    i.name,
    f.net_asset_value,
    f.value_per_share,
    f.dividend_yield_mes,
    f.shareholders,
    f.shares_issued,
    f.rendimentos_distribuir,
    f.property_value,
    i.segment_raw,
    i.mandate,
    i.administrator
from isin_part i
join fin_part f using (ukey, ref_date)
