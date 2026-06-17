-- Mediana Focus do IPCA 12 meses à frente, série SUAVIZADA (a do juro real
-- ex-ante — docs/machine.md), em decimal.
select
    survey_date,
    median / 100.0 as ipca_12m_expected,
    std_dev / 100.0 as ipca_12m_std_dev
from {{ ref('stg_bcb_focus__inflacao_12m') }}
where indicator = 'ipca' and smoothed = 'S'
