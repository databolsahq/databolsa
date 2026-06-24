import io
import zipfile

from databolsa_ingest.connectors.cvm_ipe import CvmIpeConnector
from databolsa_ingest.core import DatasetSpec, RawPayload

HEADER = (
    "CNPJ_Companhia;Nome_Companhia;Codigo_CVM;Data_Referencia;Categoria;Tipo;Especie;"
    "Assunto;Data_Entrega;Tipo_Apresentacao;Protocolo_Entrega;Versao;Link_Download"
)
ROWS = [
    "33.000.167/0001-01;PETRÓLEO BRASILEIRO S.A.;9512;2025-08-25;Fato Relevante;;;Produção do pré-sal;2025-08-25;AP;123456;1;https://www.rad.cvm.gov.br/ENET/frmDownloadDocumento.aspx?numProtocolo=123456",
    "33.000.167/0001-01;PETRÓLEO BRASILEIRO S.A.;9512;2025-05-12;Dados Econômico-Financeiros;Press-release;;Release 1T25;2025-05-12;AP;123457;1;https://www.rad.cvm.gov.br/ENET/frmDownloadDocumento.aspx?numProtocolo=123457",
]


def test_parse_index(writer, http):
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr("ipe_cia_aberta_2025.csv", "\n".join([HEADER, *ROWS]).encode("latin-1"))

    connector = CvmIpeConnector({"base_url": "http://x/", "years": [2025]}, writer, http)
    spec = DatasetSpec(name="ipe_2025", partition={"year": "2025"}, params={"kind": "index", "year": 2025})
    frames = connector.parse(RawPayload(url="u", content=buf.getvalue()), spec)

    df = frames[""]
    assert df.height == 2
    assert df.get_column("Codigo_CVM").to_list() == [9512, 9512]
    assert df.get_column("Categoria")[0] == "Fato Relevante"
    assert df.get_column("Link_Download").str.contains("rad.cvm.gov.br").all()
