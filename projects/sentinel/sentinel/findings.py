"""Shared finding model and grading."""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum


class Severity(str, Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    INFO = "info"

    @property
    def weight(self) -> int:
        """Points deducted from a 100-point score for one finding."""
        return {
            Severity.CRITICAL: 40,
            Severity.HIGH: 20,
            Severity.MEDIUM: 10,
            Severity.LOW: 4,
            Severity.INFO: 0,
        }[self]

    @property
    def rank(self) -> int:
        """Sort order — critical first."""
        order = [
            Severity.CRITICAL,
            Severity.HIGH,
            Severity.MEDIUM,
            Severity.LOW,
            Severity.INFO,
        ]
        return order.index(self)


@dataclass(frozen=True)
class Finding:
    id: str
    severity: Severity
    title: str
    detail: str
    remediation: str = ""
    location: str = ""


@dataclass
class Report:
    target: str
    kind: str
    findings: list[Finding] = field(default_factory=list)
    checks_run: int = 0

    def add(self, finding: Finding) -> None:
        self.findings.append(finding)

    def sorted_findings(self) -> list[Finding]:
        return sorted(self.findings, key=lambda f: (f.severity.rank, f.id))

    def counts(self) -> dict[Severity, int]:
        return {
            severity: sum(1 for f in self.findings if f.severity is severity)
            for severity in Severity
        }

    @property
    def score(self) -> int:
        """100 minus weighted deductions, floored at zero."""
        deduction = sum(finding.severity.weight for finding in self.findings)
        return max(0, 100 - deduction)

    @property
    def grade(self) -> str:
        score = self.score
        for threshold, letter in ((90, "A"), (80, "B"), (70, "C"), (60, "D")):
            if score >= threshold:
                return letter
        return "F"

    @property
    def passed(self) -> bool:
        """True when nothing above LOW severity was found."""
        return not any(
            finding.severity in (Severity.CRITICAL, Severity.HIGH, Severity.MEDIUM)
            for finding in self.findings
        )
