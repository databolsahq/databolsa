from __future__ import annotations

import hashlib
import json
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import TYPE_CHECKING

import polars as pl

if TYPE_CHECKING:
    from .connector import DatasetSpec, RawPayload
    from .validation import ValidationReport

MANIFEST_NAME = "_manifest.json"
# Negative cache: por quanto tempo confiar num "sem dados" quando o dataset é
# imutável (max_age=None) e não há miss_ttl explícito. Sempre limitado no tempo.
MISS_TTL_DEFAULT = timedelta(days=30)


class RawZoneWriter:
    """Escreve dataframes na raw zone com partições Hive-style e manifestos idempotentes.

    Layout: <data_root>/raw/<source>/<k>=<v>/.../data.parquet + _manifest.json por dataset.
    A escrita é atômica (tmp + rename) e sempre sobrescreve a partição — nunca appenda.
    """

    def __init__(self, data_root: Path | str):
        self.raw_root = Path(data_root) / "raw"

    def partition_dir(self, source: str, spec: "DatasetSpec") -> Path:
        d = self.raw_root / source
        for key, value in spec.partition.items():
            d = d / f"{key}={value}"
        return d

    def manifest_path(self, source: str, spec: "DatasetSpec") -> Path:
        return self.partition_dir(source, spec) / MANIFEST_NAME

    def read_manifest(self, source: str, spec: "DatasetSpec") -> dict | None:
        path = self.manifest_path(source, spec)
        if not path.exists():
            return None
        return json.loads(path.read_text(encoding="utf-8"))

    def is_current(self, source: str, spec: "DatasetSpec") -> bool:
        manifest = self.read_manifest(source, spec)
        if manifest is None:
            return False
        if manifest.get("missing"):
            # negative cache: pula a re-sondagem de um "sem dados" dentro do TTL.
            # Sempre limitado no tempo — um falso-vazio transitório se auto-cura.
            fetched_at = datetime.fromisoformat(manifest["fetched_at"])
            ttl = timedelta(seconds=manifest.get("miss_ttl_seconds", 0))
            return datetime.now(timezone.utc) - fetched_at < ttl
        base = self.partition_dir(source, spec)
        # manifesto sem os parquets no disco = partição corrompida, re-extrair
        if any(not (base / rel).exists() for rel in manifest.get("files", {})):
            return False
        if spec.max_age is None:  # dataset imutável (ex.: COTAHIST de anos passados)
            return True
        fetched_at = datetime.fromisoformat(manifest["fetched_at"])
        return datetime.now(timezone.utc) - fetched_at < spec.max_age

    def write(
        self,
        source: str,
        spec: "DatasetSpec",
        frames: dict[str, pl.DataFrame],
        payload: "RawPayload",
        report: "ValidationReport",
    ) -> list[Path]:
        base = self.partition_dir(source, spec)
        paths: list[Path] = []
        files: dict[str, int] = {}
        # Remove parquets órfãos de extrações anteriores (frame que deixou de
        # existir ficaria fora do manifesto mas seria lido por globs)
        expected = {
            str(((base / sub / "data.parquet") if sub else (base / "data.parquet")).relative_to(base))
            for sub in frames
        }
        if base.exists():
            for old in base.rglob("data.parquet"):
                if str(old.relative_to(base)) not in expected:
                    old.unlink()
        for sub, df in frames.items():
            target = (base / sub / "data.parquet") if sub else (base / "data.parquet")
            target.parent.mkdir(parents=True, exist_ok=True)
            tmp = target.parent / (target.name + ".tmp")
            df.write_parquet(tmp)
            os.replace(tmp, target)
            paths.append(target)
            files[str(target.relative_to(base))] = df.height

        manifest = {
            "source": source,
            "dataset": spec.name,
            "url": payload.url,
            "fetched_at": payload.fetched_at.isoformat(),
            "rows": sum(df.height for df in frames.values()),
            "files": files,
            "sha256": hashlib.sha256(payload.content).hexdigest() if payload.content else None,
            "validation": report.to_dict(),
        }
        manifest_tmp = base / (MANIFEST_NAME + ".tmp")
        manifest_tmp.write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8")
        os.replace(manifest_tmp, self.manifest_path(source, spec))
        return paths

    def write_missing(self, source: str, spec: "DatasetSpec", *, url: str | None, detail: str) -> None:
        """Negative cache: grava um marcador de ausência (sem parquet) quando a
        fonte respondeu "sem dados" (SourceNotAvailable). is_current() pula a
        re-sondagem enquanto dentro do miss_ttl efetivo — nunca permanente, então
        um falso-vazio transitório se cura sozinho. NÃO chamar quando há dado real
        no disco (ver guarda em Connector.run)."""
        effective = spec.miss_ttl or spec.max_age or MISS_TTL_DEFAULT
        base = self.partition_dir(source, spec)
        base.mkdir(parents=True, exist_ok=True)
        manifest = {
            "source": source,
            "dataset": spec.name,
            "missing": True,
            "url": url,
            "detail": detail,
            "fetched_at": datetime.now(timezone.utc).isoformat(),
            "miss_ttl_seconds": int(effective.total_seconds()),
        }
        manifest_tmp = base / (MANIFEST_NAME + ".tmp")
        manifest_tmp.write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8")
        os.replace(manifest_tmp, self.manifest_path(source, spec))

    def update_validation(self, source: str, spec: "DatasetSpec", report: "ValidationReport") -> bool:
        """Reescreve só o bloco `validation` de um manifesto existente — sem refazer
        fetch nem parquets. Serve para reavaliar dado já em disco depois de mudar
        uma regra de validação (o `validate --write`), em vez de re-baixar tudo só
        para atualizar um veredito. Ignora datasets ausentes/sem manifesto."""
        manifest = self.read_manifest(source, spec)
        if manifest is None or manifest.get("missing"):
            return False
        manifest["validation"] = report.to_dict()
        base = self.partition_dir(source, spec)
        manifest_tmp = base / (MANIFEST_NAME + ".tmp")
        manifest_tmp.write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8")
        os.replace(manifest_tmp, self.manifest_path(source, spec))
        return True

    def read_frames(self, source: str, spec: "DatasetSpec") -> dict[str, pl.DataFrame]:
        """Relê os parquets de um dataset já extraído, com as mesmas chaves usadas em write()."""
        base = self.partition_dir(source, spec)
        frames: dict[str, pl.DataFrame] = {}
        if not base.exists():
            return frames
        manifest = self.read_manifest(source, spec) or {}
        for rel in manifest.get("files", {}):
            path = base / rel
            if path.exists():
                key = str(Path(rel).parent)
                frames["" if key == "." else key] = pl.read_parquet(path)
        return frames
