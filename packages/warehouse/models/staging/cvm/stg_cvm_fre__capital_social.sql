-- Nº de ações (FRE). Só 'Capital Integralizado' (Autorizado/Subscrito inflam).
select
    "CNPJ_Companhia" as cnpj,
    cast("Data_Referencia" as date) as ref_date,
    "Versao" as version,
    cast("Data_Autorizacao_Aprovacao" as date) as approval_date,
    "Quantidade_Acoes_Ordinarias" as on_shares,
    "Quantidade_Acoes_Preferenciais" as pn_shares,
    "Quantidade_Total_Acoes" as total_shares
from {{ source('raw_cvm', 'fre_capital_social') }}
where "Tipo_Capital" = 'Capital Integralizado'
    and "Quantidade_Total_Acoes" > 0
