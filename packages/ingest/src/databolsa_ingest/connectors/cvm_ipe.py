"""IPE — índice de documentos corporativos protocolados na CVM (fatos relevantes,
comunicados, apresentações a investidores, releases) + download de PDFs de amostra.

Base do pilar AI-friendly: o índice alimenta `GET /companies/{id}/documents` e os
PDFs validam o futuro pipeline de extração de texto (RAG)."""

from __future__ import annotations

import io
import zipfile
from datetime import date, timedelta

import httpx
import polars as pl

from ..core import Connector, DatasetSpec, RawPayload, SourceNotAvailable
from ..core.validation import ValidationReport
from .cvm_common import read_cvm_csv


class CvmIpeConnector(Connector):
    source = "cvm_ipe"
    encoding = "latin-1"

    def datasets(self) -> list[DatasetSpec]:
        current_year = date.today().year
        specs = [
            DatasetSpec(
                name=f"ipe_{year}",
                partition={"year": str(year)},
                max_age=timedelta(days=1) if year >= current_year else timedelta(days=7),
                params={"kind": "index", "year": year},
            )
            for year in self.config.get("years", [])
        ]
        if self.config.get("sample_companies"):
            specs.append(
                DatasetSpec(
                    name="sample_docs",
                    partition={"docs": "sample"},
                    max_age=timedelta(days=7),
                    params={"kind": "docs"},
                )
            )
        return specs

    def fetch(self, spec: DatasetSpec) -> RawPayload:
        if spec.params["kind"] == "index":
            url = f"{self.config['base_url']}ipe_cia_aberta_{spec.params['year']}.zip"
            try:
                return RawPayload(url=url, content=self.http.get_bytes(url))
            except httpx.HTTPStatusError as exc:
                if exc.response.status_code == 404:
                    raise SourceNotAvailable(url) from exc
                raise
        return self._fetch_sample_docs(spec)

    def _fetch_sample_docs(self, spec: DatasetSpec) -> RawPayload:
        """Baixa os N documentos mais recentes das categorias configuradas para as
        companhias da amostra, usando o índice já extraído nesta mesma execução."""
        index = self._load_index()
        if index.is_empty():
            raise SourceNotAvailable("índice IPE vazio — rode os datasets de índice antes")

        categories = self.config.get("doc_categories", [])
        per_company = int(self.config.get("docs_per_company", 20))
        docs_root = self.writer.raw_root / self.source / "docs"
        records: list[dict] = []

        for company in self.config.get("sample_companies", []):
            cvm_code = int(company["cvm_code"])
            candidates = (
                index.filter(
                    (pl.col("Codigo_CVM") == cvm_code) & pl.col("Categoria").is_in(categories)
                )
                .sort("Data_Entrega", descending=True)
                .head(per_company)
            )
            target_dir = docs_root / f"cvm_code={cvm_code}"
            target_dir.mkdir(parents=True, exist_ok=True)
            for row in candidates.iter_rows(named=True):
                protocol = str(row["Protocolo_Entrega"]).strip().replace("/", "_")
                target = target_dir / f"{protocol}.pdf"
                record = {
                    "cvm_code": cvm_code,
                    "company": company.get("name", ""),
                    "protocol": protocol,
                    "categoria": row["Categoria"],
                    "tipo": row.get("Tipo"),
                    "assunto": row.get("Assunto"),
                    "data_entrega": str(row["Data_Entrega"]),
                    "url": row["Link_Download"],
                    "path": str(target),
                    "size_bytes": 0,
                    "is_pdf": False,
                }
                try:
                    if not target.exists():
                        content = self.http.get_bytes(row["Link_Download"])
                        target.write_bytes(content)
                    data = target.read_bytes()
                    record["size_bytes"] = len(data)
                    # GOTCHA: rad.cvm.gov.br responde Content-Type text/html mesmo
                    # servindo PDF — validar pelos magic bytes, não pelo MIME
                    record["is_pdf"] = data.startswith(b"%PDF")
                except httpx.HTTPError:
                    pass  # documento indisponível fica registrado com is_pdf=False
                records.append(record)
        return RawPayload(url="rad.cvm.gov.br (vários)", json=records)

    def _load_index(self) -> pl.DataFrame:
        frames = []
        for year in self.config.get("years", []):
            spec = DatasetSpec(name=f"ipe_{year}", partition={"year": str(year)})
            loaded = self.writer.read_frames(self.source, spec)
            if "" in loaded:
                frames.append(loaded[""])
        return pl.concat(frames, how="diagonal") if frames else pl.DataFrame()

    def parse(self, payload: RawPayload, spec: DatasetSpec) -> dict[str, pl.DataFrame]:
        if spec.params["kind"] == "docs":
            return {"": pl.DataFrame(payload.json or [])}
        with zipfile.ZipFile(io.BytesIO(payload.content)) as zf:
            member = zf.namelist()[0]
            return {"": read_cvm_csv(zf.read(member))}

    def validate(self, frames: dict[str, pl.DataFrame], spec: DatasetSpec) -> ValidationReport:
        report = ValidationReport()
        df = frames.get("", pl.DataFrame())
        report.add("non_empty", df.height > 0, f"{df.height} rows")
        if df.height == 0:
            return report

        if spec.params["kind"] == "index":
            n_categories = df.get_column("Categoria").n_unique()
            report.add("categories_diversity", n_categories > 40, f"{n_categories} categorias")
            current_year = date.today().year
            min_rows = 30_000 if spec.params["year"] < current_year else 5_000
            report.add("index_size", df.height > min_rows, f"{df.height} rows (min {min_rows})")
            has_links = df.get_column("Link_Download").str.contains("rad.cvm.gov.br").all()
            report.add("download_links_present", bool(has_links), "")
        else:
            ok_companies = (
                df.filter(pl.col("is_pdf")).get_column("cvm_code").n_unique()
            )
            total_companies = len(self.config.get("sample_companies", []))
            report.add(
                "pdf_per_sample_company",
                ok_companies == total_companies,
                f"{ok_companies}/{total_companies} companhias com ≥1 PDF válido",
            )
            n_pdf = df.filter(pl.col("is_pdf")).height
            report.add("pdfs_downloaded", n_pdf > 0, f"{n_pdf}/{df.height} documentos com magic %PDF")
        return report
