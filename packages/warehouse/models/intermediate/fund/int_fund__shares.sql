-- Nº de ações vigente por CNPJ ao longo do tempo (FRE capital integralizado):
-- série de eventos por approval_date, último registro (ano/versão) vence.
-- ⚠️ Eventos societários após o último FRE do ano não estão refletidos até a
-- fase de preços ajustados entregar fatores (flag shares_quality no mart).
select
    cnpj,
    approval_date,
    on_shares,
    pn_shares,
    total_shares
from {{ ref('stg_cvm_fre__capital_social') }}
qualify row_number() over (
    partition by cnpj, approval_date
    order by ref_date desc, version desc
) = 1
