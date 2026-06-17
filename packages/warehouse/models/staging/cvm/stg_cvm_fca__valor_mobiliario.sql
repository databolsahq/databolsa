-- Mapa ticker ↔ CNPJ ↔ classe ↔ segmento (FCA, 2010+; Codigo_Negociacao só
-- existe 2019+ — validador do ingest documenta). Só ações/units em Bolsa.
select
    "CNPJ_Companhia" as cnpj,
    cast("Data_Referencia" as date) as ref_date,
    "Versao" as version,
    "Nome_Empresarial" as company_name,
    case "Valor_Mobiliario"
        when 'Ações Ordinárias' then 'ON'
        when 'Ações Preferenciais' then coalesce(nullif("Sigla_Classe_Acao_Preferencial", ''), 'PN')
        when 'Units' then 'UNIT'
    end as share_class,
    nullif(trim("Codigo_Negociacao"), '') as ticker,
    "Mercado" as market,
    "Segmento" as segment,
    cast("Data_Inicio_Negociacao" as date) as trading_start,
    cast("Data_Fim_Negociacao" as date) as trading_end
from {{ source('raw_cvm', 'fca_valor_mobiliario') }}
where "Valor_Mobiliario" in ('Ações Ordinárias', 'Ações Preferenciais', 'Units')
    and "Mercado" = 'Bolsa'
