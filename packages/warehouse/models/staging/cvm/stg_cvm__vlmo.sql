-- VLMO/CVM: movimentações de valores mobiliários de administradores e pessoas
-- ligadas (insider). Cada linha é uma operação; Tipo_Operacao = Crédito (entrada)
-- ou Débito (saída). Filtramos a AÇÕES com operação e volume — exclui saldos,
-- heranças, debêntures, opções e units (foco no fluxo de mercado em ações).
select
    regexp_replace("CNPJ_Companhia", '[^0-9]', '', 'g') as cnpj,
    "Nome_Companhia" as company_name,
    try_cast("Data_Referencia" as date) as reference_date,
    "Tipo_Operacao" as operation,
    "Caracteristica_Valor_Mobiliario" as share_class,
    try_cast("Quantidade" as bigint) as quantity,
    try_cast("Volume" as double) as volume_brl,
    try_cast("Preco_Unitario" as double) as price
from {{ source('raw_cvm', 'vlmo') }}
where "Tipo_Ativo" = 'Ações'
    and "Tipo_Operacao" in ('Crédito', 'Débito')
    and try_cast("Volume" as double) is not null
    and try_cast("Data_Referencia" as date) is not null
