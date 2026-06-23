"""Atas do COPOM (pt-BR) e minutes (EN) — pilar LLM: o texto que move o juro.

Índice via API do site do BCB + download de todos os PDFs das atas.
GOTCHAS (verificados ao vivo 2026-06): a API exige User-Agent de browser E o
parâmetro `filtro=` mesmo vazio (sem ele: HTTP 500)."""

from __future__ import annotations

import re
from datetime import timedelta

import httpx
import polars as pl

from ..core import Connector, DatasetSpec, RawPayload, SourceNotAvailable
from ..core.validation import ValidationReport

INDEX_FIELDS = ("Titulo", "DataReferencia", "Url", "LinkPagina")


class BcbCopomConnector(Connector):
    source = "bcb_copom"

    def datasets(self) -> list[DatasetSpec]:
        return [
            DatasetSpec(
                name="atas_index",
                partition={"dataset": "atas_index"},
                max_age=timedelta(days=7),
                params={"kind": "index", "endpoint": "atascopom"},
            ),
            DatasetSpec(
                name="minutes_index",
                partition={"dataset": "minutes_index"},
                max_age=timedelta(days=7),
                params={"kind": "index", "endpoint": "copomminutes"},
            ),
            DatasetSpec(
                name="atas_pdfs",
                partition={"dataset": "atas_pdfs"},
                max_age=timedelta(days=7),
                params={"kind": "pdfs"},
            ),
        ]

    def _index_rows(self, endpoint: str) -> list[dict]:
        url = f"{self.config['base_url']}{endpoint}/ultimas"
        # GOTCHA: `filtro=` vazio é obrigatório — a API devolve 500 sem ele
        payload = self.http.get_json(url, params={"quantidade": "10000", "filtro": ""})
        rows = (payload or {}).get("conteudo", [])
        if not rows:
            raise SourceNotAvailable(f"{url}: índice vazio")
        return rows

    def fetch(self, spec: DatasetSpec) -> RawPayload:
        if spec.params["kind"] == "index":
            rows = self._index_rows(spec.params["endpoint"])
            return RawPayload(url=spec.params["endpoint"], json=rows)

        # pdfs: baixa toda ata ainda não presente no disco (imutáveis por reunião)
        rows = self._index_rows("atascopom")
        docs_root = self.writer.raw_root / self.source / "docs"
        docs_root.mkdir(parents=True, exist_ok=True)
        records: list[dict] = []
        for row in rows:
            rel_url = row.get("Url") or ""
            if not rel_url:  # reuniões antigas sem PDF publicado no índice
                continue
            pdf_url = self.config["site_base_url"] + rel_url
            meeting = _meeting_number(row.get("Titulo", "")) or _slug(rel_url)
            target = docs_root / f"meeting={meeting}.pdf"
            record = {
                "meeting": str(meeting),
                "titulo": row.get("Titulo"),
                "data_referencia": row.get("DataReferencia"),
                "url": pdf_url,
                "path": str(target),
                "size_bytes": 0,
                "is_pdf": False,
            }
            try:
                if not target.exists():
                    target.write_bytes(self.http.get_bytes(pdf_url))
                data = target.read_bytes()
                record["size_bytes"] = len(data)
                record["is_pdf"] = data.startswith(b"%PDF")
            except httpx.HTTPError:
                pass  # ata indisponível fica registrada com is_pdf=False
            records.append(record)
        return RawPayload(url="bcb.gov.br/content/copom/atascopom (vários)", json=records)

    def parse(self, payload: RawPayload, spec: DatasetSpec) -> dict[str, pl.DataFrame]:
        rows = payload.json or []
        if spec.params["kind"] == "index":
            df = pl.DataFrame(
                {f: [r.get(f) for r in rows] for f in INDEX_FIELDS},
                schema={f: pl.Utf8 for f in INDEX_FIELDS},
            )
            df = df.with_columns(meeting=pl.col("Titulo").map_elements(_meeting_number, return_dtype=pl.Int64))
            return {"": df}
        return {"": pl.DataFrame(rows, infer_schema_length=None)}

    def validate(self, frames: dict[str, pl.DataFrame], spec: DatasetSpec) -> ValidationReport:
        report = ValidationReport()
        df = frames.get("", pl.DataFrame())
        report.add("non_empty", df.height > 0, f"{df.height} rows")
        if df.height == 0:
            return report
        if spec.params["kind"] == "index":
            report.add("history_depth", df.height >= 100, f"{df.height} reuniões no índice")
            n_meetings = df.get_column("meeting").drop_nulls().n_unique()
            report.add("meeting_numbers_parsed", n_meetings >= 100, f"{n_meetings} números distintos")
        else:
            n_pdf = df.filter(pl.col("is_pdf")).height
            report.add("pdfs_valid", n_pdf >= df.height * 0.95, f"{n_pdf}/{df.height} PDFs com magic %PDF")
        return report


def _meeting_number(title: str | None) -> int | None:
    """'278ª Reunião - 28-29 abril, 2026' -> 278"""
    m = re.match(r"\s*(\d+)", title or "")
    return int(m.group(1)) if m else None


def _slug(url: str) -> str:
    return re.sub(r"[^A-Za-z0-9]+", "_", url).strip("_")[-40:]
