-- Expectativas Focus mensais (IPCA, Câmbio). DataReferencia = 'MM/YYYY'.
select
    "Data" as survey_date,
    lower(strip_accents(replace("Indicador", ' ', '_'))) as indicator,
    cast(strptime("DataReferencia", '%m/%Y') as date) as reference_month,
    "Media" as mean,
    "Mediana" as median,
    "DesvioPadrao" as std_dev,
    "numeroRespondentes" as respondents
from {{ source('raw_bcb', 'focus_mensais') }}
where "baseCalculo" = 0
