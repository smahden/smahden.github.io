import pytest

from sentinel.findings import Finding, Severity
from sentinel.headers import analyze

STRONG = {
    "Content-Security-Policy": "default-src 'self'; frame-ancestors 'none'",
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=()",
    "X-Frame-Options": "DENY",
}


def ids(report):
    return {finding.id for finding in report.findings}


class TestStrongConfiguration:
    def test_hardened_headers_score_an_a(self):
        report = analyze(STRONG)
        assert report.findings == []
        assert report.grade == "A"
        assert report.score == 100
        assert report.passed

    def test_header_names_are_case_insensitive(self):
        lowered = {name.lower(): value for name, value in STRONG.items()}
        assert analyze(lowered).findings == []

    def test_values_are_whitespace_tolerant(self):
        padded = {name: f"  {value}  " for name, value in STRONG.items()}
        assert analyze(padded).findings == []


class TestMissingHeaders:
    def test_empty_response_flags_everything(self):
        report = analyze({})
        assert "csp-missing" in ids(report)
        assert "hsts-missing" in ids(report)
        assert "frame-options-missing" in ids(report)
        assert "content-type-options" in ids(report)
        assert "referrer-policy-missing" in ids(report)
        assert report.grade == "F"
        assert not report.passed

    def test_missing_csp_is_high_severity(self):
        report = analyze({})
        csp = next(f for f in report.findings if f.id == "csp-missing")
        assert csp.severity is Severity.HIGH
        assert csp.remediation


class TestWeakValues:
    def test_unsafe_inline_is_flagged(self):
        report = analyze({**STRONG, "Content-Security-Policy": "default-src 'self' 'unsafe-inline'"})
        assert "csp-unsafe-inline" in ids(report)

    def test_unsafe_eval_is_flagged(self):
        report = analyze({**STRONG, "Content-Security-Policy": "script-src 'unsafe-eval'"})
        assert "csp-unsafe-eval" in ids(report)

    def test_wildcard_script_src_is_flagged(self):
        report = analyze({**STRONG, "Content-Security-Policy": "script-src *"})
        assert "csp-wildcard" in ids(report)

    def test_short_hsts_max_age_is_low_not_high(self):
        report = analyze({**STRONG, "Strict-Transport-Security": "max-age=3600"})
        finding = next(f for f in report.findings if f.id == "hsts-short-max-age")
        assert finding.severity is Severity.LOW

    def test_hsts_without_max_age(self):
        report = analyze({**STRONG, "Strict-Transport-Security": "includeSubDomains"})
        assert "hsts-no-max-age" in ids(report)

    def test_six_month_hsts_is_accepted(self):
        report = analyze({**STRONG, "Strict-Transport-Security": "max-age=15552000"})
        assert not any(f.id.startswith("hsts") for f in report.findings)

    def test_sniffing_protection_must_be_nosniff(self):
        report = analyze({**STRONG, "X-Content-Type-Options": "none"})
        assert "content-type-options" in ids(report)


class TestFrameProtection:
    def test_csp_frame_ancestors_replaces_x_frame_options(self):
        headers = {**STRONG, "Content-Security-Policy": "default-src 'self'; frame-ancestors 'none'"}
        del headers["X-Frame-Options"]
        assert "frame-options-missing" not in ids(analyze(headers))

    def test_missing_both_is_flagged(self):
        headers = {**STRONG, "Content-Security-Policy": "default-src 'self'"}
        del headers["X-Frame-Options"]
        assert "frame-options-missing" in ids(analyze(headers))

    def test_allowall_provides_no_protection(self):
        headers = {**STRONG, "Content-Security-Policy": "default-src 'self'", "X-Frame-Options": "ALLOWALL"}
        assert "frame-options-allowall" in ids(analyze(headers))


class TestDisclosureAndCors:
    def test_server_header_is_flagged(self):
        report = analyze({**STRONG, "Server": "nginx/1.18.0"})
        assert "disclosure-server" in ids(report)

    def test_x_powered_by_is_flagged(self):
        assert "disclosure-x-powered-by" in ids(analyze({**STRONG, "X-Powered-By": "Express"}))

    def test_wildcard_cors_with_credentials_is_critical(self):
        report = analyze(
            {
                **STRONG,
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Credentials": "true",
            }
        )
        finding = next(f for f in report.findings if f.id == "cors-wildcard-credentials")
        assert finding.severity is Severity.CRITICAL
        assert report.grade in {"D", "F"}

    def test_wildcard_cors_without_credentials_is_allowed(self):
        report = analyze({**STRONG, "Access-Control-Allow-Origin": "*"})
        assert "cors-wildcard-credentials" not in ids(report)


class TestGrading:
    @pytest.mark.parametrize(
        "headers,expected",
        [
            (STRONG, "A"),
            ({**STRONG, "Server": "nginx"}, "A"),  # one low finding: 96
            ({**STRONG, "Content-Security-Policy": "default-src 'self' 'unsafe-inline'"}, "A"),
            ({}, "F"),
        ],
    )
    def test_grades(self, headers, expected):
        assert analyze(headers).grade == expected

    def test_score_never_goes_negative(self):
        # Deductions here total well past 100; the score must floor at zero.
        report = analyze({})
        for index in range(3):
            report.add(
                Finding(
                    id=f"synthetic-{index}",
                    severity=Severity.CRITICAL,
                    title="synthetic critical",
                    detail="added to push deductions past 100",
                )
            )
        assert report.score == 0
        assert report.grade == "F"

    def test_findings_sort_critical_first(self):
        report = analyze(
            {"Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true"}
        )
        severities = [f.severity for f in report.sorted_findings()]
        assert severities[0] is Severity.CRITICAL
        assert severities == sorted(severities, key=lambda s: s.rank)
