-- Perfil do FII por ticker (GET /v1/fiis/{ticker}). name/manager vêm do cadastro
-- RCVM175 (registro); segment do informe mensal CVM mapeado ao enum do contrato;
-- is_paper = fundo de papel (TVM).
with m as (
    select
        t.ticker,
        arg_max(s.cnpj, s.reference_date) as cnpj,
        arg_max(s.name, s.reference_date) filter (where s.name is not null) as name,
        -- Segmento CVM MODAL (mais frequente no histórico), robusto à corrupção do
        -- Segmento_Atuacao a partir de 2025-08 (ex.: HGLG11 foi marcado Multicategoria
        -- e MXRF11 Logística — ambos errados). Antes era arg_max(mais recente), que
        -- propagava o valor corrompido. Modal volta ao valor estável (HGLG→Logística).
        mode(s.segment_raw) as segment_raw,
        arg_max(s.mandate, s.reference_date) filter (where s.mandate is not null) as mandate,
        arg_max(s.administrator, s.reference_date) filter (where s.administrator is not null) as administrator
    from {{ ref('stg_cvm__fii_mensal') }} s
    join {{ ref('int_fii__ticker') }} t on t.isin = s.isin
    where s.net_asset_value is not null
    group by t.ticker
),

-- Cadastro RCVM175 (dataset=registro): fonte autoritativa do NOME LEGAL e do
-- GESTOR atuais. O informe mensal parou de preencher Nome_Fundo nas linhas-ISIN
-- após 2020-12, então o `name` do informe congela num nome antigo (ex.: HGLG11
-- vira "CSHG Logística" em vez do atual "Pátria Log") e `manager` nunca existiu
-- no informe. O registro é snapshotado diariamente; pegamos o snapshot mais
-- recente por CNPJ.
reg as (
    select
        regexp_replace("CNPJ_Fundo", '[^0-9]', '', 'g') as cnpj,
        "Denominacao_Social" as name,
        nullif(trim("Gestor"), '') as manager
    from {{ source('raw_cvm', 'fii_registro') }}
    where "CNPJ_Fundo" is not null
    qualify row_number() over (
        partition by regexp_replace("CNPJ_Fundo", '[^0-9]', '', 'g')
        order by "snapshot_date" desc
    ) = 1
)

select
    m.ticker,
    m.cnpj,
    -- nome legal vigente do registro; cai para o informe se o fundo não estiver
    -- no snapshot de cadastro.
    coalesce(reg.name, m.name) as name,
    -- Segmento servido = PREFERE ANBIMA, cai para o CVM modal. Hoje a Classificacao_Anbima
    -- do registro CVM é 100% vazia (sem fonte), então segment_anbima é nulo e servimos o
    -- CVM. Quando uma fonte ANBIMA for ingerida, troca-se o null abaixo pela coluna e o
    -- coalesce passa a preferi-la — sem mexer no resto.
    -- NOTA: um classificador tijolo/papel pela carteira do informe foi avaliado e
    -- DESCARTADO — o informe não captura CRI de forma confiável (MXRF tem ~69% do
    -- investido invisível) e imóveis via SPE não aparecem em Direitos_Bens_Imoveis, então
    -- nenhum corte separa papel de tijolo sem errar dezenas de fundos. Precisa ANBIMA/B3.
    coalesce(
        cast(null as varchar),  -- segment_anbima (placeholder; sem fonte ANBIMA hoje)
        case
            when m.segment_raw = 'Logística' then 'logistica'
            when m.segment_raw in ('Lajes Corporativas', 'Escritórios') then 'lajes_corporativas'
            when m.segment_raw = 'Shoppings' then 'shoppings'
            when m.segment_raw = 'Títulos e Val. Mob.' then 'papel'
            when m.segment_raw in ('Híbrido', 'Multicategoria') then 'hibrido'
            when m.segment_raw in ('Residencial', 'Varejo', 'Educacional', 'Hospital', 'Hotel') then 'renda_urbana'
            else 'outro'
        end
    ) as segment,
    m.administrator,
    reg.manager,
    (m.segment_raw = 'Títulos e Val. Mob.' or m.mandate = 'Títulos e Valores Mobiliários') as is_paper
from m
left join reg on reg.cnpj = m.cnpj
