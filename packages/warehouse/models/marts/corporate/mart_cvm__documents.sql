-- Documentos CVM/IPE por código CVM (contrato: GET /v1/companies/{cvm_code}/documents).
-- Apenas o ÍNDICE (metadados + link para rad.cvm.gov.br); o conteúdo textual não é
-- servido (has_text=false até o pipeline de extração existir). Dedupe por protocolo.
select
    cvm_code,
    category,
    type,
    subject,
    reference_date,
    filed_at,
    protocol,
    download_url,
    false as has_text
from {{ ref('stg_cvm__ipe') }}
qualify row_number() over (
    partition by coalesce(protocol, cast(cvm_code as varchar) || filed_at || category)
    order by filed_at desc
) = 1
order by cvm_code, filed_at desc
