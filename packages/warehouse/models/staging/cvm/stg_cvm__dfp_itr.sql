-- DFP/ITR: linhas de conta normalizadas. Mantém todas as VERSAO (point-in-time);
-- a seleção max(VERSAO) + preferência consolidado é da camada intermediate.
-- ORDEM_EXERC='PENÚLTIMO' (comparativo do ano anterior) é descartado.
-- VL_CONTA normalizado p/ R$ UNIDADE via ESCALA_MOEDA.
select
    "CNPJ_CIA" as cnpj,
    "CD_CVM" as cd_cvm,
    "DENOM_CIA" as company_name,
    dataset,            -- dfp | itr
    statement,          -- bpa | bpp | dre | dfc_md | dfc_mi | dva | dmpl
    scope,              -- con | ind
    cast("DT_REFER" as date) as ref_date,
    "VERSAO" as version,
    cast("DT_INI_EXERC" as date) as period_start,
    cast("DT_FIM_EXERC" as date) as period_end,
    "CD_CONTA" as account_code,
    "DS_CONTA" as account_name,
    "VL_CONTA" * case "ESCALA_MOEDA" when 'MIL' then 1000.0 else 1.0 end as value_brl,
    "ST_CONTA_FIXA" = 'S' as is_fixed_account
from {{ source('raw_cvm', 'dfp_itr') }}
where "ORDEM_EXERC" = 'ÚLTIMO' and "MOEDA" = 'REAL'
