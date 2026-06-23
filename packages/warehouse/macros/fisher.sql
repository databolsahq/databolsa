{% macro fisher(nominal, inflation) -%}
    ((1.0 + ({{ nominal }})) / (1.0 + ({{ inflation }})) - 1.0)
{%- endmacro %}
