-- Índice IPE/CVM: METADADOS de documentos protocolados (fatos relevantes, atas,
-- comunicados, releases) — NÃO o conteúdo dos PDFs.
--
-- As colunas NATIVAS da CVM são o índice IPE. As normalizadas minúsculas
-- (cvm_code/categoria/tipo/...) só existiam nos parquets dos documentos AMOSTRADOS
-- (cvm_ipe.sample_companies), desligados no V1 (pilar LLM/RAG adiado). Como o DuckDB
-- faz o bind de TODA coluna referenciada, o coalesce com as normalizadas quebrava o
-- modelo quando elas não existem em arquivo nenhum ("column cvm_code not found").
-- Lemos só as nativas. Se o pilar de docs/RAG voltar, re-introduzir o coalesce.
select
    try_cast("Codigo_CVM" as bigint) as cvm_code,
    "Categoria" as category,
    "Tipo" as type,
    "Assunto" as subject,
    try_cast("Data_Referencia" as date) as reference_date,
    try_cast("Data_Entrega" as date) as filed_at,
    "Protocolo_Entrega" as protocol,
    "Link_Download" as download_url
from {{ source('raw_cvm', 'ipe') }}
where try_cast("Codigo_CVM" as bigint) is not null
    and "Categoria" is not null
