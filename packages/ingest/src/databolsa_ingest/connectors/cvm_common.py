"""Helpers compartilhados pelos conectores de dados abertos da CVM."""

from __future__ import annotations

import io

import polars as pl

CVM_ENCODING = "latin-1"  # GOTCHA: CVM publica em ISO-8859-1, não UTF-8

DEFAULT_OVERRIDES: dict[str, pl.DataType] = {
    "CNPJ_CIA": pl.Utf8,
    "CNPJ_Companhia": pl.Utf8,
    "CNPJ_Fundo": pl.Utf8,
    "CNPJ_Fundo_Classe": pl.Utf8,
    "CD_CVM": pl.Int64,
    "Codigo_CVM": pl.Int64,
    "VERSAO": pl.Int64,
    "Versao": pl.Int64,
    "CD_CONTA": pl.Utf8,  # "3.01" seria inferido como float
    "VL_CONTA": pl.Float64,
    "ESCALA_MOEDA": pl.Utf8,
}


def read_cvm_csv(
    raw: bytes,
    schema_overrides: dict | None = None,
    infer_schema_length: int | None = 10_000,
) -> pl.DataFrame:
    """Lê um CSV da CVM: Latin-1, separador ';', aspas não escapadas.

    Use infer_schema_length=None (varre o arquivo todo) em arquivos pequenos com
    colunas numéricas mistas int/float — evita erro de inferência tardia.
    """
    text = raw.decode(CVM_ENCODING)
    overrides = dict(DEFAULT_OVERRIDES)
    # Todo CNPJ_*/Versao do header vira Utf8/Int64 — CNPJ inferido como int perde
    # zeros à esquerda e causa schema drift entre anos (achado da revisão adversarial)
    header = text.split("\n", 1)[0].strip()
    for col in header.split(";"):
        if col.startswith("CNPJ_") or col.startswith("CNPJ "):
            overrides.setdefault(col, pl.Utf8)
    if schema_overrides:
        overrides.update(schema_overrides)
    return pl.read_csv(
        io.BytesIO(text.encode("utf-8")),
        separator=";",
        quote_char=None,  # CVM não escapa aspas dentro dos campos
        schema_overrides=overrides,
        infer_schema_length=infer_schema_length,
        try_parse_dates=True,
    )
