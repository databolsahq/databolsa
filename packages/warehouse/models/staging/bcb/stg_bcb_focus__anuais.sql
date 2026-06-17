-- Expectativas Focus anuais (IPCA, Selic, PIB Total, Câmbio).
-- DataReferencia é o ANO de referência; horizon_years = anos à frente da pesquisa.
select
    "Data" as survey_date,
    lower(strip_accents(replace("Indicador", ' ', '_'))) as indicator,
    cast("DataReferencia" as integer) as reference_year,
    cast("DataReferencia" as integer) - year("Data") as horizon_years,
    "Media" as mean,
    "Mediana" as median,
    "DesvioPadrao" as std_dev,
    "Minimo" as min,
    "Maximo" as max,
    "numeroRespondentes" as respondents
from {{ source('raw_bcb', 'focus_anuais') }}
where "baseCalculo" = 0
