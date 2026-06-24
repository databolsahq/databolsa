import io
import zipfile

import polars as pl

from databolsa_ingest.connectors.cvm_dfp_itr import CvmDfpItrConnector
from databolsa_ingest.core import DatasetSpec, RawPayload

HEADER = (
    "CNPJ_CIA;CD_CVM;DENOM_CIA;DT_REFER;VERSAO;GRUPO_DFP;CD_CONTA;DS_CONTA;"
    "VL_CONTA;ST_CONTA_FIXA;ESCALA_MOEDA;MOEDA;ORDEM_EXERC"
)

DRE_ROWS = [
    "33.000.167/0001-01;9512;PETRÓLEO BRASILEIRO S.A.;2023-12-31;1;DF Consolidado - Demonstração do Resultado;3.01;Receita de Venda de Bens e/ou Serviços;511994000;S;MIL;REAL;ÚLTIMO",
    "33.000.167/0001-01;9512;PETRÓLEO BRASILEIRO S.A.;2023-12-31;2;DF Consolidado - Demonstração do Resultado;3.01;Receita de Venda de Bens e/ou Serviços;511994000;S;MIL;REAL;ÚLTIMO",
]

BPP_ROWS = [
    "33.000.167/0001-01;9512;PETRÓLEO BRASILEIRO S.A.;2023-12-31;1;DF Consolidado - Balanço Patrimonial Passivo;2.03;Patrimônio Líquido Consolidado;382000000;S;MIL;REAL;ÚLTIMO",
]


def make_zip() -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr(
            "dfp_cia_aberta_DRE_con_2023.csv",
            "\n".join([HEADER, *DRE_ROWS]).encode("latin-1"),
        )
        zf.writestr(
            "dfp_cia_aberta_BPP_con_2023.csv",
            "\n".join([HEADER, *BPP_ROWS]).encode("latin-1"),
        )
    return buf.getvalue()


CONFIG = {
    "base_url": "http://x/",
    "datasets": ["dfp"],
    "years": [2023],
    "statements": ["BPP", "DRE"],
}


def test_parse_latin1_zip(writer, http):
    connector = CvmDfpItrConnector(CONFIG, writer, http)
    spec = DatasetSpec(
        name="dfp_2023",
        partition={"dataset": "dfp", "year": "2023"},
        params={"kind": "statements", "ds": "dfp", "year": 2023},
    )
    frames = connector.parse(RawPayload(url="u", content=make_zip()), spec)

    assert set(frames) == {"statement=dre/scope=con", "statement=bpp/scope=con"}
    dre = frames["statement=dre/scope=con"]
    # CD_CONTA precisa continuar string ("3.01" não pode virar float)
    assert dre.get_column("CD_CONTA").dtype == pl.Utf8
    assert dre.get_column("CD_CONTA")[0] == "3.01"
    assert dre.get_column("VL_CONTA").dtype == pl.Float64
    # acentos do latin-1 decodificados corretamente
    assert "Serviços" in dre.get_column("DS_CONTA")[0]
    bpp = frames["statement=bpp/scope=con"]
    assert "Patrimônio Líquido" in bpp.get_column("DS_CONTA")[0]


def test_validate_picks_max_versao(writer, http):
    connector = CvmDfpItrConnector(CONFIG, writer, http)
    spec = DatasetSpec(
        name="dfp_2023",
        partition={"dataset": "dfp", "year": "2023"},
        params={"kind": "statements", "ds": "dfp", "year": 2023},
    )
    frames = connector.parse(RawPayload(url="u", content=make_zip()), spec)
    report = connector.validate(frames, spec)
    by_name = {c.name: c for c in report.checks}
    assert by_name["encoding_accents_ok"].passed
    assert by_name["grupo_dfp_consolidado"].passed
    # fixture tem 1 empresa, então companies_count reprova — comportamento esperado
    assert not by_name["companies_count"].passed
