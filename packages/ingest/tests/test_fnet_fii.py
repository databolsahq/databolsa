from databolsa_ingest.connectors.fnet_fii import FnetFiiConnector, _isento, _num, _year_of
from databolsa_ingest.core import DatasetSpec, RawPayload

# schema atual (~2023+): ticker/isin por <Provento>, valor em <ValorProvento>,
# rendimento e amortização lado a lado, isento = "Sim"/"Não".
XML_NEW = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<DadosEconomicoFinanceiros>
  <DadosGerais><CNPJFundo>18979895000113</CNPJFundo></DadosGerais>
  <InformeRendimentos>
    <Provento>
      <CodISIN>BRCPTSCTF004</CodISIN>
      <CodNegociacao>CPTS11</CodNegociacao>
      <Rendimento>
        <DataBase>2026-06-15</DataBase>
        <ValorProvento>0.09</ValorProvento>
        <DataPagamento>2026-06-22</DataPagamento>
        <PeriodoReferencia>Maio-2026</PeriodoReferencia>
        <RendimentoIsentoIR>Sim</RendimentoIsentoIR>
      </Rendimento>
      <Amortizacao>
        <DataBase>2026-06-15</DataBase>
        <ValorProvento>0.50</ValorProvento>
        <DataPagamento>2026-06-22</DataPagamento>
      </Amortizacao>
    </Provento>
  </InformeRendimentos>
</DadosEconomicoFinanceiros>"""

# schema antigo (≤2022): ticker em DadosGerais/CodNegociacaoCota, valor em
# <ValorProventoCota>, rendimento direto sob InformeRendimentos, isento = true/false.
XML_OLD = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<DadosEconomicoFinanceiros>
  <DadosGerais>
    <CNPJFundo>18979895000113</CNPJFundo>
    <CodISINCota>BRCPTSCTF004</CodISINCota>
    <CodNegociacaoCota>CPTS11</CodNegociacaoCota>
  </DadosGerais>
  <InformeRendimentos>
    <Rendimento>
      <DataBase>2022-09-13</DataBase>
      <DataPagamento>2022-09-20</DataPagamento>
      <ValorProventoCota>1.10</ValorProventoCota>
      <PeriodoReferencia>Agosto</PeriodoReferencia>
      <RendimentoIsentoIR>true</RendimentoIsentoIR>
    </Rendimento>
    <Amortizacao tipo=""/>
  </InformeRendimentos>
</DadosEconomicoFinanceiros>"""


def _payload(*docs):
    return RawPayload(
        url="u",
        json={
            "cnpj": "18979895000113",
            "year": "2026",
            "docs": [{"meta": {"id": i, "versao": 1, "dataEntrega": "15/06/2026 17:10",
                               "dataReferencia": "15/06/2026"}, "xml": x}
                     for i, x in enumerate(docs, start=1)],
        },
    )


def _conn(writer, http):
    return FnetFiiConnector({"base_url": "http://x/publico"}, writer, http)


def test_helpers():
    assert _num("0.09") == 0.09
    assert _num("1,10") == 1.10  # tolera vírgula
    assert _num("") is None and _num(None) is None
    assert _isento("Sim") is True and _isento("true") is True
    assert _isento("Não") is False and _isento("false") is False
    assert _year_of("15/06/2026") == "2026" and _year_of(None) is None


def test_parse_new_schema(writer, http):
    spec = DatasetSpec(name="t", params={"cnpj": "18979895000113", "year": "2026"})
    df = _conn(writer, http).parse(_payload(XML_NEW), spec)[""]
    rend = df.filter(df["kind"] == "rendimento")
    amort = df.filter(df["kind"] == "amortizacao")
    assert rend.height == 1 and amort.height == 1
    row = rend.row(0, named=True)
    assert row["ticker"] == "CPTS11"
    assert row["value_per_share"] == 0.09
    assert row["ex_date"] == "2026-06-15"
    assert row["payment_date"] == "2026-06-22"
    assert row["tax_free"] is True


def test_parse_old_schema(writer, http):
    spec = DatasetSpec(name="t", params={"cnpj": "18979895000113", "year": "2022"})
    df = _conn(writer, http).parse(_payload(XML_OLD), spec)[""]
    rend = df.filter(df["kind"] == "rendimento")
    assert rend.height == 1
    row = rend.row(0, named=True)
    assert row["ticker"] == "CPTS11"  # vem de DadosGerais/CodNegociacaoCota
    assert row["value_per_share"] == 1.10  # vem de ValorProventoCota
    assert row["tax_free"] is True


def test_validate_passes_on_rendimentos(writer, http):
    spec = DatasetSpec(name="t", params={"cnpj": "18979895000113", "year": "2026"})
    conn = _conn(writer, http)
    frames = conn.parse(_payload(XML_NEW, XML_OLD), spec)
    report = conn.validate(frames, spec)
    assert report.passed
    checks = {c.name: c for c in report.checks}
    assert checks["non_empty"].passed
    assert checks["values_nonneg"].passed


def test_validate_tolerates_zero_and_amortization_only(writer, http):
    # ano só com amortização + um rendimento de valor zero (filing declarado sem valor):
    # não deve REPROVAR a partição (zero é descartado no staging; amort é dado válido).
    xml_zero = XML_NEW.replace("<ValorProvento>0.09</ValorProvento>", "<ValorProvento>0</ValorProvento>")
    spec = DatasetSpec(name="t", params={"cnpj": "18979895000113", "year": "2026"})
    conn = _conn(writer, http)
    report = conn.validate(conn.parse(_payload(xml_zero), spec), spec)
    assert report.passed  # zero tolerado, amortização presente
