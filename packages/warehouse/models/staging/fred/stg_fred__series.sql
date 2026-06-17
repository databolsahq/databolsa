select
    data as date,
    series_id,
    series_name,
    valor as value,
    unit
from {{ source('raw_fred', 'fred') }}
where valor is not null
