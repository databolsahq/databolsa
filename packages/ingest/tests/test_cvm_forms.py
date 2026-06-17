import io
import zipfile

from databolsa_ingest.connectors.cvm_forms import CvmFcaConnector, CvmFreConnector
from databolsa_ingest.core import DatasetSpec, RawPayload

FCA_VM_HEADER = (
    "CNPJ_Companhia;Data_Referencia;Versao;ID_Documento;Nome_Empresarial;Valor_Mobiliario;"
    "Sigla_Classe_Acao_Preferencial;Classe_Acao_Preferencial;Codigo_Negociacao;Composicao_BDR_Unit;"
    "Mercado;Sigla_Entidade_Administradora;Entidade_Administradora;Data_Inicio_Negociacao;"
    "Data_Fim_Negociacao;Segmento;Data_Inicio_Listagem;Data_Fim_Listagem"
)
FCA_VM_ROW = (
    "00.000.000/0001-91;2025-01-01;1;146477;BCO BRASIL S.A.;Ações Ordinárias;;;BBAS3;;"
    "Bolsa;B3;B3 S.A.;2006-05-31;;Novo Mercado;1977-07-20;"
)

FRE_CS_HEADER = (
    "CNPJ_Companhia;Data_Referencia;Versao;ID_Documento;Nome_Companhia;ID_Capital_Social;"
    "Tipo_Capital;Data_Autorizacao_Aprovacao;Valor_Capital;Prazo_Integralizacao;"
    "Quantidade_Acoes_Ordinarias;Quantidade_Acoes_Preferenciais;Quantidade_Total_Acoes"
)
FRE_CS_ROW = (
    "33.000.167/0001-01;2025-12-31;3;157774;PETRÓLEO BRASILEIRO S.A.;351443;Capital Emitido;"
    "2023-04-27;205431960490.52;;7442231382;5446501379;12888732761"
)


def _zip(member: str, header: str, rows: list[str]) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr(member, "\n".join([header, *rows]).encode("latin-1"))
    return buf.getvalue()


def test_fca_parse_and_bbas3_mapping(writer, http):
    connector = CvmFcaConnector(
        {"base_url": "http://x/", "years": [2025], "tables": ["valor_mobiliario"]}, writer, http
    )
    spec = DatasetSpec(name="fca_2025", partition={"year": "2025"}, params={"year": 2025})
    payload = RawPayload(url="u", content=_zip("fca_cia_aberta_valor_mobiliario_2025.csv", FCA_VM_HEADER, [FCA_VM_ROW]))
    frames = connector.parse(payload, spec)

    vm = frames["table=valor_mobiliario"]
    assert vm.get_column("Codigo_Negociacao")[0] == "BBAS3"
    assert vm.get_column("Segmento")[0] == "Novo Mercado"

    checks = {c.name: c for c in connector.validate(frames, spec).checks}
    assert checks["bbas3_maps_to_banco_do_brasil"].passed


def test_fre_parse_and_petrobras_shares(writer, http):
    connector = CvmFreConnector(
        {"base_url": "http://x/", "years": [2025], "tables": ["capital_social"]}, writer, http
    )
    spec = DatasetSpec(name="fre_2025", partition={"year": "2025"}, params={"year": 2025})
    payload = RawPayload(url="u", content=_zip("fre_cia_aberta_capital_social_2025.csv", FRE_CS_HEADER, [FRE_CS_ROW]))
    frames = connector.parse(payload, spec)

    cs = frames["table=capital_social"]
    assert cs.get_column("Quantidade_Acoes_Ordinarias")[0] == 7442231382

    checks = {c.name: c for c in connector.validate(frames, spec).checks}
    assert checks["petrobras_share_count"].passed
