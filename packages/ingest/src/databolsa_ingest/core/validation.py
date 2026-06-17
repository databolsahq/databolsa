from __future__ import annotations

from dataclasses import asdict, dataclass, field


@dataclass
class ValidationCheck:
    name: str
    passed: bool
    detail: str = ""


@dataclass
class ValidationReport:
    checks: list[ValidationCheck] = field(default_factory=list)

    def add(self, name: str, passed: bool, detail: str = "") -> None:
        self.checks.append(ValidationCheck(name=name, passed=bool(passed), detail=detail))

    def skip(self, name: str, reason: str) -> None:
        """Registra um check que não pôde rodar (ex.: fonte externa indisponível) sem reprovar."""
        self.checks.append(ValidationCheck(name=name, passed=True, detail=f"SKIPPED: {reason}"))

    @property
    def passed(self) -> bool:
        return all(c.passed for c in self.checks)

    @property
    def failures(self) -> list[ValidationCheck]:
        return [c for c in self.checks if not c.passed]

    def to_dict(self) -> dict:
        return {"passed": self.passed, "checks": [asdict(c) for c in self.checks]}
