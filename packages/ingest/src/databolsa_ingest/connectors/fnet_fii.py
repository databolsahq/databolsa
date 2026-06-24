"""Distribuições de FII (rendimentos/amortizações) via B3 FNET — fonte de fato do
provento PAGO por cota, com data-com e data de pagamento reais.

Por que existe: o DY 12m vinha do informe MENSAL da CVM (Rendimentos_Distribuir =
saldo a distribuir), proxy que ZERA em fundos que distribuem ~100%/mês (CPTS11,
KNCR11…) — eles somem do DY (CPTS11 aparecia com ~2% em vez de ~14%). O FNET publica
o "Informe de Rendimentos" estruturado (Aviso aos Cotistas — categoria 14), com o
provento de fato.

Endpoint público (sem auth):
  - listagem JSON: /publico/pesquisarGerenciadorDocumentosDados?cnpjFundo=&idCategoriaDocumento=14&tipoFundo=1
    (DataTables: {recordsTotal, data:[{id, dataReferencia, dataEntrega, tipoDocumento,
    versao, situacaoDocumento, ...}]}); teto de 200 itens por página (s/l = skip/limit).
  - documento: /publico/downloadDocumento?id=<id>&cvm=true → XML em BASE64.

DUAS gerações de schema XML (parser cobre ambas):
  - atual (~2023+): InformeRendimentos/Provento{CodNegociacao,CodISIN}/Rendimento{
    DataBase, ValorProvento, DataPagamento, PeriodoReferencia, RendimentoIsentoIR} —
    um Provento por classe (CPTS11/13/15…).
  - antigo (≤2022): ticker em DadosGerais/CodNegociacaoCota; InformeRendimentos/
    Rendimento{ValorProventoCota, …}; isento = true/false.
"""

from __future__ import annotations

import base64
import sys
import threading
import time
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor
from datetime import date, timedelta

import polars as pl

from ..core import Connector, DatasetSpec, RawPayload, SourceNotAvailable
from ..core.connector import ExtractionResult
from ..core.validation import ValidationReport

# categoria 14 = "Aviso aos Cotistas - Estruturado"; o tipoDocumento dos informes de
# rendimento é "Rendimentos e Amortizações" — filtramos por ele p/ ignorar outros
# avisos estruturados que caiam na mesma categoria.
CATEGORIA_RENDIMENTOS = 14
TIPO_FUNDO_FII = 1
LISTING_PAGE = 200  # teto do FNET ("O limite de itens para pesquisas é 200!")

ROW_SCHEMA = {
    "doc_id": pl.Int64,
    "cnpj": pl.Utf8,
    "ticker": pl.Utf8,
    "isin": pl.Utf8,
    "kind": pl.Utf8,  # rendimento | amortizacao
    "data_aprovacao": pl.Utf8,
    "ex_date": pl.Utf8,  # DataBase = data-com
    "payment_date": pl.Utf8,
    "value_per_share": pl.Float64,
    "periodo_referencia": pl.Utf8,
    "tax_free": pl.Boolean,
    "versao": pl.Int64,
    "data_entrega": pl.Utf8,
    "data_referencia": pl.Utf8,
}


def _num(value: str | None) -> float | None:
    if value is None or str(value).strip() == "":
        return None
    try:
        # FNET grava com ponto decimal; tolera vírgula por segurança.
        return float(str(value).strip().replace(",", "."))
    except ValueError:
        return None


def _isento(value: str | None) -> bool | None:
    if value is None:
        return None
    v = str(value).strip().lower()
    if v in ("sim", "true", "1", "s"):
        return True
    if v in ("não", "nao", "false", "0", "n"):
        return False
    return None


def _year_of(data_referencia: str | None) -> str | None:
    """'15/06/2026' -> '2026'."""
    if not data_referencia:
        return None
    parts = data_referencia.split("/")
    return parts[-1] if parts and len(parts[-1]) == 4 else None


class FnetFiiConnector(Connector):
    source = "fnet_fii"

    def __init__(self, config, writer, http):
        super().__init__(config, writer, http)
        # listagem por CNPJ é compartilhada pelos specs (cnpj, ano) do mesmo fundo —
        # 1 fetch de listagem por fundo, não 1 por ano.
        self._listing_cache: dict[str, list[dict]] = {}

    # ---- universo -----------------------------------------------------------

    def _cnpjs(self) -> list[str]:
        """CNPJs de FII a consultar. Override explícito via config (scoping/teste);
        senão deriva do informe mensal CVM já extraído (raw zone)."""
        override = self.config.get("cnpjs")
        if override:
            return [self._digits(c) for c in override]
        cnpjs: set[str] = set()
        geral = self.writer.raw_root / "cvm_fii" / "dataset=inf_mensal"
        # schema varia por ano (pós-RCVM175 o CNPJ migra p/ CNPJ_Fundo_Classe); lê cada
        # parquet pelas colunas que ELE tem (scan glob unificado quebra no schema misto).
        for path in sorted(geral.glob("year=*/table=geral/data.parquet")):
            try:
                schema = pl.read_parquet_schema(str(path))
            except Exception:
                continue
            cols = [c for c in ("CNPJ_Fundo_Classe", "CNPJ_Fundo") if c in schema]
            if not cols:
                continue
            df = pl.read_parquet(str(path), columns=cols)
            for col in cols:
                for raw in df.get_column(col).to_list():
                    d = self._digits(raw)
                    if len(d) == 14:
                        cnpjs.add(d)
        return sorted(cnpjs)

    @staticmethod
    def _digits(value: str | None) -> str:
        return "".join(ch for ch in str(value or "") if ch.isdigit())

    def datasets(self) -> list[DatasetSpec]:
        current_year = date.today().year
        start_year = int(self.config.get("start_year", 2017))
        specs: list[DatasetSpec] = []
        for cnpj in self._cnpjs():
            for year in range(start_year, current_year + 1):
                specs.append(
                    DatasetSpec(
                        name=f"{cnpj}_{year}",
                        partition={"cnpj": cnpj, "year": str(year)},
                        # ano corrente muda (novos rendimentos mensais); anos passados
                        # são imutáveis — baixados uma vez. Documentos são identificados
                        # por id; uma re-emissão vira doc novo (nova versão) e entra no
                        # ano corrente.
                        max_age=timedelta(days=1) if year >= current_year else None,
                        # negative cache: fundo sem rendimento naquele ano (fundo novo,
                        # classe que não distribui) — re-sonda no máx. a cada 30d.
                        miss_ttl=timedelta(days=30),
                        params={"cnpj": cnpj, "year": str(year)},
                    )
                )
        return specs

    # ---- run (concorrente) --------------------------------------------------

    def run(self, *, force: bool = False) -> list[ExtractionResult]:
        """Override CONCORRENTE do run() serial da base.

        Diferente das outras fontes (zips em bloco, ou sondagem serial curta), o FNET é
        uma API POR-DOCUMENTO: o backfill frio são ~35k GETs que, seriais, levam ~5h.
        Paralelizando POR FUNDO (fundos são independentes; cada um processa seus anos em
        série, reusando a listagem) cai p/ ~25min — então qualquer cold-start (zona de
        dados nova/perdida) se auto-cura rápido, sem seed manual. Reusa
        fetch/parse/validate/writer e as MESMAS guardas da base (is_current, negative
        cache, staging-promote). Retorna list[ExtractionResult] igual à base (o CLI não
        muda). max_workers via config `workers` (default 12)."""
        specs = self.datasets()
        by_cnpj: dict[str, list[DatasetSpec]] = {}
        for spec in specs:
            by_cnpj.setdefault(spec.params["cnpj"], []).append(spec)
        workers = int(self.config.get("workers", 12))
        total = len(by_cnpj)
        progress = {"done": 0}
        progress_lock = threading.Lock()
        started = time.monotonic()

        def run_fund(group: list[DatasetSpec]) -> list[ExtractionResult]:
            # anos do MESMO fundo em série → 1 listagem por fundo (cache de instância
            # sem corrida: cada fundo vive em uma única thread).
            out = [self._run_spec(spec, force=force) for spec in group]
            with progress_lock:
                progress["done"] += 1
                n = progress["done"]
            if n == 1 or n % 200 == 0 or n == total:
                print(
                    f"  … fnet_fii: {n}/{total} fundos ({time.monotonic() - started:.0f}s)",
                    file=sys.stderr,
                    flush=True,
                )
            return out

        with ThreadPoolExecutor(max_workers=workers) as ex:
            groups = list(ex.map(run_fund, by_cnpj.values()))
        return [r for group in groups for r in group]

    def _run_spec(self, spec: DatasetSpec, *, force: bool) -> ExtractionResult:
        """Lógica por-partição idêntica à base.run(), isolada p/ rodar em thread."""
        if not force and self.writer.is_current(self.source, spec):
            return ExtractionResult(self.source, spec.name, skipped=True)
        try:
            payload = self.fetch(spec)
            frames = self.parse(payload, spec)
            report = self.validate(frames, spec)
            if not report.passed:
                previous = self.writer.read_manifest(self.source, spec)
                if previous and previous.get("validation", {}).get("passed"):
                    fails = "; ".join(f"{c.name}: {c.detail}" for c in report.failures)
                    return ExtractionResult(
                        self.source,
                        spec.name,
                        error=f"validação reprovou ({fails}) — partição anterior aprovada foi mantida",
                    )
            paths = self.writer.write(self.source, spec, frames, payload, report)
        except SourceNotAvailable as exc:
            previous = self.writer.read_manifest(self.source, spec)
            if previous is None or previous.get("missing"):
                self.writer.write_missing(self.source, spec, url=None, detail=str(exc))
            return ExtractionResult(self.source, spec.name, missing=True)
        except Exception as exc:
            return ExtractionResult(self.source, spec.name, error=f"{type(exc).__name__}: {exc}")
        return ExtractionResult(
            self.source,
            spec.name,
            rows=sum(df.height for df in frames.values()),
            paths=paths,
            validation=report,
        )

    # ---- fetch --------------------------------------------------------------

    def _listing(self, cnpj: str) -> list[dict]:
        if cnpj in self._listing_cache:
            return self._listing_cache[cnpj]
        base = self.config["base_url"].rstrip("/")
        throttle = float(self.config.get("throttle_seconds", 0.4))
        rows: list[dict] = []
        skip = 0
        while True:
            params = {
                "d": 0,
                "s": skip,
                "l": LISTING_PAGE,
                "o[0][dataEntrega]": "desc",
                "cnpjFundo": cnpj,
                "idCategoriaDocumento": CATEGORIA_RENDIMENTOS,
                "idTipoDocumento": 0,
                "idEspecieDocumento": 0,
                "tipoFundo": TIPO_FUNDO_FII,
            }
            payload = self.http.get_json(f"{base}/pesquisarGerenciadorDocumentosDados", params=params)
            data = (payload or {}).get("data") or []
            rows.extend(data)
            total = (payload or {}).get("recordsTotal", 0)
            if not data or len(rows) >= total:
                break
            skip += LISTING_PAGE
            time.sleep(throttle)
        # só informes de rendimento ativos (ignora cancelados/inativos)
        rows = [
            r
            for r in rows
            if r.get("situacaoDocumento") == "A"
            and "rendiment" in str(r.get("tipoDocumento", "")).lower()
        ]
        self._listing_cache[cnpj] = rows
        return rows

    def _download_xml(self, doc_id: int) -> str:
        base = self.config["base_url"].rstrip("/")
        raw = self.http.get_bytes(f"{base}/downloadDocumento", params={"id": doc_id, "cvm": "true"})
        text = raw.decode("utf-8", "replace").strip().strip('"')
        return base64.b64decode(text).decode("utf-8", "replace")

    def fetch(self, spec: DatasetSpec) -> RawPayload:
        cnpj = spec.params["cnpj"]
        year = spec.params["year"]
        throttle = float(self.config.get("throttle_seconds", 0.4))
        docs_in_year = [d for d in self._listing(cnpj) if _year_of(d.get("dataReferencia")) == year]
        if not docs_in_year:
            raise SourceNotAvailable(f"sem informe de rendimentos p/ {cnpj} em {year}")
        out: list[dict] = []
        for d in docs_in_year:
            try:
                xml = self._download_xml(int(d["id"]))
            except Exception as exc:  # um doc ruim não derruba o ano inteiro
                out.append({"meta": d, "xml": None, "error": str(exc)})
                continue
            out.append({"meta": d, "xml": xml})
            time.sleep(throttle)
        return RawPayload(
            url=f"{self.config['base_url']}/downloadDocumento?cnpj={cnpj}&year={year}",
            json={"cnpj": cnpj, "year": year, "docs": out},
        )

    # ---- parse --------------------------------------------------------------

    def _parse_doc(self, cnpj: str, meta: dict, xml: str) -> list[dict]:
        try:
            root = ET.fromstring(xml)
        except ET.ParseError:
            return []
        dg = root.find("DadosGerais")
        cnpj_xml = (dg.findtext("CNPJFundo") if dg is not None else None) or cnpj
        ticker_doc = dg.findtext("CodNegociacaoCota") if dg is not None else None  # schema antigo
        isin_doc = dg.findtext("CodISINCota") if dg is not None else None
        rows: list[dict] = []

        def emit(ticker: str | None, isin: str | None, el: ET.Element, kind: str):
            value = _num(el.findtext("ValorProvento") or el.findtext("ValorProventoCota"))
            ex = el.findtext("DataBase")
            if value is None or not ex:
                return
            rows.append(
                {
                    "doc_id": int(meta["id"]),
                    "cnpj": self._digits(cnpj_xml),
                    "ticker": (ticker or "").strip() or None,
                    "isin": (isin or "").strip() or None,
                    "kind": kind,
                    "data_aprovacao": el.findtext("DataAprovacao") or el.findtext("AtoSocietarioAprovacao"),
                    "ex_date": ex,
                    "payment_date": el.findtext("DataPagamento"),
                    "value_per_share": value,
                    "periodo_referencia": el.findtext("PeriodoReferencia"),
                    "tax_free": _isento(el.findtext("RendimentoIsentoIR")),
                    "versao": int(meta.get("versao") or 0),
                    "data_entrega": meta.get("dataEntrega"),
                    "data_referencia": meta.get("dataReferencia"),
                }
            )

        proventos = root.findall(".//Provento")
        if proventos:  # schema atual: ticker/isin por Provento (classe)
            for prov in proventos:
                tk = prov.findtext("CodNegociacao") or ticker_doc
                isin = prov.findtext("CodISIN") or isin_doc
                for el in prov.findall("Rendimento"):
                    emit(tk, isin, el, "rendimento")
                for el in prov.findall("Amortizacao"):
                    emit(tk, isin, el, "amortizacao")
        else:  # schema antigo: rendimentos direto sob InformeRendimentos
            for el in root.findall(".//InformeRendimentos/Rendimento"):
                emit(ticker_doc, isin_doc, el, "rendimento")
            for el in root.findall(".//InformeRendimentos/Amortizacao"):
                emit(ticker_doc, isin_doc, el, "amortizacao")
        return rows

    def parse(self, payload: RawPayload, spec: DatasetSpec) -> dict[str, pl.DataFrame]:
        data = payload.json or {}
        cnpj = data.get("cnpj", spec.params["cnpj"])
        rows: list[dict] = []
        for doc in data.get("docs", []):
            xml = doc.get("xml")
            if xml:
                rows.extend(self._parse_doc(cnpj, doc["meta"], xml))
        df = pl.DataFrame(rows, schema=ROW_SCHEMA, strict=False)
        if df.height:
            df = df.unique()
        return {"": df}

    # ---- validate -----------------------------------------------------------

    def validate(self, frames: dict[str, pl.DataFrame], spec: DatasetSpec) -> ValidationReport:
        # Validação por (cnpj, ano) é fraca por natureza — não há contagem esperada de
        # proventos. Gate só no que indica DADO QUEBRADO: partição vazia ou provento
        # negativo (bug de parse). Provento ZERO é tolerado (filing declarado sem valor,
        # descartado no staging por value>0); ano só com amortização, ou ticker ausente
        # em alguma linha (resolvido no staging), são INFORMATIVOS — não reprovam a fonte
        # (senão a saúde dos dados vira "error" por causa de fundos obscuros).
        report = ValidationReport()
        df = frames.get("", pl.DataFrame())
        report.add("non_empty", df.height > 0, f"{df.height} proventos")
        if df.height == 0:
            return report
        vals = df.get_column("value_per_share").drop_nulls()
        report.add(
            "values_nonneg",
            vals.len() == 0 or (vals >= 0).all(),
            f"min={vals.min()} max={vals.max()}" if vals.len() else "sem valores",
        )
        # informativos (não-gating)
        rend = df.filter(pl.col("kind") == "rendimento")
        report.add("rendimentos", True, f"{rend.height} rend / {df.height - rend.height} amort")
        tickers = sorted({t for t in df.get_column("ticker").drop_nulls().to_list() if t})
        report.add("tickers", True, f"{tickers[:6]}")
        return report
