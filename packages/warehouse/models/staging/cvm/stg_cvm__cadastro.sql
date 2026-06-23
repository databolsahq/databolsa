-- Cadastro CVM de companhias abertas (setor, situação).
select
    "CNPJ_CIA" as cnpj,
    "CD_CVM" as cd_cvm,
    "DENOM_SOCIAL" as company_name,
    "SETOR_ATIV" as sector,
    "SIT" as status,
    "SIT_EMISSOR" as issuer_status,
    "CONTROLE_ACIONARIO" as ownership_control
from {{ source('raw_cvm', 'dfp_itr_cad') }}
