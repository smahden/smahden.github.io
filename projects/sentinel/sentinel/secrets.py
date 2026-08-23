"""Scan source trees for credentials that should never have been committed.

Findings are always redacted: the point is to tell you *where* a secret is,
not to copy it into another file that then also needs cleaning up.
"""

from __future__ import annotations

import math
import re
from collections import Counter
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Iterator

from .findings import Finding, Report, Severity


@dataclass(frozen=True)
class Pattern:
    id: str
    title: str
    severity: Severity
    regex: re.Pattern[str]
    remediation: str


PATTERNS: tuple[Pattern, ...] = (
    Pattern(
        "aws-access-key",
        "AWS access key id",
        Severity.CRITICAL,
        re.compile(r"\b((?:AKIA|ASIA|AGPA|AIDA)[A-Z0-9]{16})\b"),
        "Revoke the key in IAM, then rotate it and load it from the environment.",
    ),
    Pattern(
        "private-key",
        "Private key block",
        Severity.CRITICAL,
        re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----"),
        "Regenerate the key pair and store the private half outside the repository.",
    ),
    Pattern(
        "github-token",
        "GitHub token",
        Severity.CRITICAL,
        re.compile(r"\b(gh[pousr]_[A-Za-z0-9]{16,})\b"),
        "Revoke the token on GitHub and issue a fresh one with the narrowest scope.",
    ),
    Pattern(
        "slack-token",
        "Slack token",
        Severity.HIGH,
        re.compile(r"\b(xox[abprs]-[A-Za-z0-9-]{10,})\b"),
        "Revoke the token in the Slack app settings.",
    ),
    Pattern(
        "connection-string",
        "Database connection string with password",
        Severity.HIGH,
        re.compile(r"\b(?:postgres|postgresql|mysql|mongodb(?:\+srv)?|redis)://[^:\s]+:([^@\s]{3,})@"),
        "Move the URL into configuration and rotate the database password.",
    ),
    # Listed before the generic rule so the more specific match wins the line.
    Pattern(
        "jwt",
        "JSON Web Token",
        Severity.MEDIUM,
        re.compile(r"\b(eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,})\b"),
        "Treat the token as compromised; shorten token lifetimes if it was long-lived.",
    ),
    Pattern(
        "generic-secret",
        "Hardcoded credential",
        Severity.HIGH,
        # Real code rarely names a variable exactly "password" — it is
        # DB_PASSWORD, SECRET_KEY, registryToken. Allow affixes around the
        # keyword instead of requiring a bare word match.
        re.compile(
            r"""(?ix)
            [\w.-]* (?:api[_-]?key|secret|passwd|password|token|access[_-]?key) [\w.-]*
            \s*[:=]\s*
            ['"]([^'"\s]{8,})['"]
            """
        ),
        "Read the value from an environment variable or a secret manager.",
    ),
)

# Values that look like secrets but are obviously placeholders.
PLACEHOLDERS = re.compile(
    r"(?i)^(?:x{3,}|\*{3,}|\.{3,}|<[^>]+>|\$\{[^}]+\}|changeme|placeholder|example|"
    r"your[_-]?\w*|dummy|sample|test{1,2}|redacted|none|null|todo)$"
)

SKIP_DIRECTORIES = frozenset(
    {
        ".git", "node_modules", ".venv", "venv", "__pycache__", "dist", "build",
        ".next", ".cache", "vendor", "coverage", ".pytest_cache", ".mypy_cache",
    }
)

SKIP_SUFFIXES = frozenset(
    {
        ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".svg", ".pdf", ".zip",
        ".gz", ".tar", ".woff", ".woff2", ".ttf", ".mp4", ".mp3", ".lock",
    }
)

MAX_FILE_BYTES = 1_000_000


def redact(value: str) -> str:
    """Show only enough of a secret to recognize which one it is."""
    if len(value) <= 8:
        return value[0] + "*" * (len(value) - 1) if value else ""
    return f"{value[:4]}{'*' * 8}{value[-4:]}"


def shannon_entropy(value: str) -> float:
    """Bits of entropy per character — high values suggest a random string."""
    if not value:
        return 0.0
    counts = Counter(value)
    length = len(value)
    return -sum(
        (count / length) * math.log2(count / length) for count in counts.values()
    )


def _iter_files(root: Path) -> Iterator[Path]:
    if root.is_file():
        yield root
        return
    for path in sorted(root.rglob("*")):
        if not path.is_file():
            continue
        if any(part in SKIP_DIRECTORIES for part in path.parts):
            continue
        if path.suffix.lower() in SKIP_SUFFIXES:
            continue
        try:
            if path.stat().st_size > MAX_FILE_BYTES:
                continue
        except OSError:
            continue
        yield path


def scan_text(text: str, location: str = "") -> list[Finding]:
    """Scan one blob of text and return redacted findings."""
    findings: list[Finding] = []
    for line_number, line in enumerate(text.splitlines(), start=1):
        if len(line) > 2000:  # minified bundles produce noise, not signal
            continue
        reported: set[str] = set()
        for pattern in PATTERNS:
            for match in pattern.regex.finditer(line):
                # Group 1 is the secret itself where the pattern captures one.
                value = match.group(1) if match.groups() else match.group(0)
                if PLACEHOLDERS.match(value):
                    continue
                if pattern.id == "generic-secret" and shannon_entropy(value) < 2.5:
                    # Low-entropy values here are usually config words, not keys.
                    continue
                if value in reported:
                    # One value, one finding — report it under the most
                    # specific rule that matched, not once per rule.
                    continue
                reported.add(value)
                findings.append(
                    Finding(
                        id=pattern.id,
                        severity=pattern.severity,
                        title=pattern.title,
                        detail=f"Matched `{redact(value)}` in source.",
                        remediation=pattern.remediation,
                        location=f"{location}:{line_number}" if location else f"line {line_number}",
                    )
                )
    return findings


def scan_path(root: str | Path, extra_skip: Iterable[str] = ()) -> Report:
    """Recursively scan a file or directory for committed credentials."""
    root = Path(root)
    if not root.exists():
        raise FileNotFoundError(f"no such path: {root}")

    skip = SKIP_DIRECTORIES | set(extra_skip)
    report = Report(target=str(root), kind="Secret scan")

    for path in _iter_files(root):
        if any(part in skip for part in path.parts):
            continue
        try:
            text = path.read_text(encoding="utf-8")
        except (UnicodeDecodeError, OSError):
            continue  # binary or unreadable — nothing to match against
        report.checks_run += 1
        try:
            location = str(path.relative_to(root))
        except ValueError:
            location = str(path)
        for finding in scan_text(text, location=location):
            report.add(finding)

    return report
