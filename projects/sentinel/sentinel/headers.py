"""HTTP security header analysis.

Checks the response headers of a site against the defensive headers that
modern browsers honour, and flags both missing headers and present-but-weak
values (the more common real-world failure).
"""

from __future__ import annotations

import re
from typing import Mapping

from .findings import Finding, Report, Severity

# Headers that quietly advertise your stack to anyone scanning for known CVEs.
DISCLOSURE_HEADERS = ("server", "x-powered-by", "x-aspnet-version", "x-generator")

MIN_HSTS_MAX_AGE = 15_552_000  # six months, the value Chrome's preload list requires


def _normalize(headers: Mapping[str, str]) -> dict[str, str]:
    """HTTP header names are case-insensitive; compare them in one case."""
    return {name.lower().strip(): value.strip() for name, value in headers.items()}


def _check_csp(value: str | None, report: Report) -> None:
    if value is None:
        report.add(
            Finding(
                id="csp-missing",
                severity=Severity.HIGH,
                title="Content-Security-Policy is missing",
                detail=(
                    "Without a CSP the browser will execute any script the page "
                    "references, which is what turns an HTML injection bug into "
                    "stored cross-site scripting."
                ),
                remediation="Start with `default-src 'self'` and loosen only where needed.",
            )
        )
        return

    policy = value.lower()
    if "unsafe-inline" in policy:
        report.add(
            Finding(
                id="csp-unsafe-inline",
                severity=Severity.MEDIUM,
                title="Content-Security-Policy allows 'unsafe-inline'",
                detail=(
                    "'unsafe-inline' permits inline <script> and event-handler "
                    "attributes, which is exactly the payload most XSS relies on."
                ),
                remediation="Move inline scripts to files, or use a per-response nonce or hash.",
            )
        )
    if "unsafe-eval" in policy:
        report.add(
            Finding(
                id="csp-unsafe-eval",
                severity=Severity.MEDIUM,
                title="Content-Security-Policy allows 'unsafe-eval'",
                detail="'unsafe-eval' re-enables eval() and Function(), widening the XSS surface.",
                remediation="Remove 'unsafe-eval' and any library that requires it.",
            )
        )
    if re.search(r"(default|script)-src[^;]*\*", policy):
        report.add(
            Finding(
                id="csp-wildcard",
                severity=Severity.MEDIUM,
                title="Content-Security-Policy uses a wildcard source",
                detail="A wildcard in default-src or script-src permits scripts from any host.",
                remediation="List the specific origins you actually load code from.",
            )
        )


def _check_hsts(value: str | None, report: Report) -> None:
    if value is None:
        report.add(
            Finding(
                id="hsts-missing",
                severity=Severity.HIGH,
                title="Strict-Transport-Security is missing",
                detail=(
                    "Without HSTS, a first request over plain HTTP can be intercepted "
                    "and downgraded before the redirect to HTTPS ever happens."
                ),
                remediation="Send `Strict-Transport-Security: max-age=31536000; includeSubDomains`.",
            )
        )
        return

    match = re.search(r"max-age\s*=\s*(\d+)", value, re.IGNORECASE)
    if not match:
        report.add(
            Finding(
                id="hsts-no-max-age",
                severity=Severity.MEDIUM,
                title="Strict-Transport-Security has no max-age",
                detail="Without max-age the header is ignored by browsers.",
                remediation="Add `max-age=31536000`.",
            )
        )
    elif int(match.group(1)) < MIN_HSTS_MAX_AGE:
        report.add(
            Finding(
                id="hsts-short-max-age",
                severity=Severity.LOW,
                title="Strict-Transport-Security max-age is short",
                detail=(
                    f"max-age is {match.group(1)}s; browsers stop enforcing HTTPS once it "
                    f"expires, and preload requires at least {MIN_HSTS_MAX_AGE}s."
                ),
                remediation=f"Raise max-age to {MIN_HSTS_MAX_AGE} or more.",
            )
        )


def _check_frame_options(headers: dict[str, str], report: Report) -> None:
    csp = headers.get("content-security-policy", "").lower()
    # A CSP frame-ancestors directive supersedes X-Frame-Options entirely.
    if "frame-ancestors" in csp:
        return

    value = headers.get("x-frame-options")
    if value is None:
        report.add(
            Finding(
                id="frame-options-missing",
                severity=Severity.MEDIUM,
                title="No clickjacking protection",
                detail=(
                    "Neither X-Frame-Options nor a CSP frame-ancestors directive is set, "
                    "so the page can be framed by any site and used for clickjacking."
                ),
                remediation="Send `X-Frame-Options: DENY` or `CSP: frame-ancestors 'none'`.",
            )
        )
    elif value.strip().lower() == "allowall":
        report.add(
            Finding(
                id="frame-options-allowall",
                severity=Severity.MEDIUM,
                title="X-Frame-Options is set to ALLOWALL",
                detail="ALLOWALL is not a valid directive and provides no protection.",
                remediation="Use DENY or SAMEORIGIN.",
            )
        )


def analyze(headers: Mapping[str, str], target: str = "response") -> Report:
    """Analyze a mapping of response headers and return a graded report."""
    normalized = _normalize(headers)
    report = Report(target=target, kind="HTTP security headers", checks_run=8)

    _check_csp(normalized.get("content-security-policy"), report)
    _check_hsts(normalized.get("strict-transport-security"), report)
    _check_frame_options(normalized, report)

    if normalized.get("x-content-type-options", "").lower() != "nosniff":
        report.add(
            Finding(
                id="content-type-options",
                severity=Severity.LOW,
                title="X-Content-Type-Options is not 'nosniff'",
                detail=(
                    "Browsers may MIME-sniff a response and execute an uploaded file as "
                    "script even though it was served as text."
                ),
                remediation="Send `X-Content-Type-Options: nosniff`.",
            )
        )

    if "referrer-policy" not in normalized:
        report.add(
            Finding(
                id="referrer-policy-missing",
                severity=Severity.LOW,
                title="Referrer-Policy is missing",
                detail=(
                    "Full URLs, including any tokens in the query string, leak to "
                    "third-party sites in the Referer header."
                ),
                remediation="Send `Referrer-Policy: strict-origin-when-cross-origin`.",
            )
        )

    if "permissions-policy" not in normalized:
        report.add(
            Finding(
                id="permissions-policy-missing",
                severity=Severity.INFO,
                title="Permissions-Policy is not set",
                detail="Camera, microphone, and geolocation stay available to embedded frames.",
                remediation="Send `Permissions-Policy: camera=(), microphone=(), geolocation=()`.",
            )
        )

    for header in DISCLOSURE_HEADERS:
        if header in normalized:
            report.add(
                Finding(
                    id=f"disclosure-{header}",
                    severity=Severity.LOW,
                    title=f"{header} header discloses server software",
                    detail=(
                        f"`{header}: {normalized[header]}` tells an attacker exactly which "
                        "version to look up known vulnerabilities for."
                    ),
                    remediation=f"Suppress the {header} header at the proxy or app server.",
                    location=header,
                )
            )

    cors = normalized.get("access-control-allow-origin")
    if cors == "*" and normalized.get("access-control-allow-credentials", "").lower() == "true":
        report.add(
            Finding(
                id="cors-wildcard-credentials",
                severity=Severity.CRITICAL,
                title="CORS allows any origin with credentials",
                detail=(
                    "Access-Control-Allow-Origin: * combined with allow-credentials lets any "
                    "site read authenticated responses on behalf of a logged-in user."
                ),
                remediation="Echo back a specific allowed origin instead of a wildcard.",
            )
        )

    return report
