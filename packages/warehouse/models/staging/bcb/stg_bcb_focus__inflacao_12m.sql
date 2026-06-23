-- Expectativas Focus de inflação 12 meses à frente (IPCA, IGP-M).
-- smoothed='S' é a série suavizada — a usada no juro real ex-ante (docs/machine.md).
select
    "Data" as survey_date,
    lower(strip_accents(replace("Indicador", ' ', '_'))) as indicator,
    "Suavizada" as smoothed,
    "Media" as mean,
    "Mediana" as median,
    "DesvioPadrao" as std_dev,
    "numeroRespondentes" as respondents
from {{ source('raw_bcb', 'focus_inflacao_12m') }}
where "baseCalculo" = 0
