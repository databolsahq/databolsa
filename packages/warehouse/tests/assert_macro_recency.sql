-- Frescor: indicadores vivos não podem estar velhos (espelha o validador de
-- frescor do ingest). EMBI/carry (fonte morta) e ibovespa_hist (SGS 7
-- descontinuada) são exceções documentadas.
--
-- Cadência importa: juro_real_ex_ante e custo_rolagem_ntnb_10y são ~diários (45d).
-- ipca_12m é MENSAL e datado pelo mês de REFERÊNCIA — com o IPCA saindo ~10 dias
-- após o mês fechar, o último ponto fica naturalmente ~40-45d velho e cruza 45d
-- na janela antes da próxima divulgação. Damos 75d a ele (pega atraso real de 2+
-- meses sem alarme falso mensal).
with latest as (
    select indicator_id, max(date) as last_date
    from {{ ref('mart_macro__indicators') }}
    group by 1
)

select *
from latest
where (indicator_id in ('juro_real_ex_ante', 'custo_rolagem_ntnb_10y')
        and last_date < current_date - interval 45 days)
   or (indicator_id = 'ipca_12m'
        and last_date < current_date - interval 75 days)
