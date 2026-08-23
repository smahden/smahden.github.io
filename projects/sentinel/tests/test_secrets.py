"""Secret-scanner tests.

Vendor-format credentials are assembled from fragments at runtime rather than
written as literals, so this repository never actually contains a string that a
platform secret scanner would flag. The scanner under test sees the joined
value exactly as it would in a real file.
"""

import pytest

from sentinel.findings import Severity
from sentinel.secrets import redact, scan_path, scan_text, shannon_entropy

AWS_KEY = "AKIA" + "IOSFODNN7EXAMPLE"
GITHUB_TOKEN = "ghp_" + "A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8"
SLACK_TOKEN = "xoxb-" + "123456789012-abcdefghijklmnop"
PRIVATE_KEY = "-----BEGIN RSA " + "PRIVATE KEY-----"


def ids(findings):
    return {finding.id for finding in findings}


class TestPatterns:
    def test_aws_access_key(self):
        findings = scan_text(f'key = "{AWS_KEY}"')
        assert "aws-access-key" in ids(findings)
        assert findings[0].severity is Severity.CRITICAL

    def test_private_key_block(self):
        assert "private-key" in ids(scan_text(PRIVATE_KEY))

    def test_github_token(self):
        assert "github-token" in ids(scan_text(f"TOKEN={GITHUB_TOKEN}"))

    def test_slack_token(self):
        assert "slack-token" in ids(scan_text(f'slack = "{SLACK_TOKEN}"'))

    def test_generic_api_key_assignment(self):
        assert "generic-secret" in ids(scan_text('api_key = "9f2c41ab77de4c0e8b31a6d5"'))

    @pytest.mark.parametrize("name", ["API_KEY", "secret", "PASSWORD", "access-key", "token"])
    def test_generic_pattern_covers_common_names(self, name):
        assert scan_text(f'{name} = "8f4b2c9d1e7a3f6b5c0d"')

    @pytest.mark.parametrize(
        "name", ["SECRET_KEY", "REGISTRY_PASSWORD", "DB_PASSWORD", "registryToken", "stripe_api_key"]
    )
    def test_generic_pattern_covers_affixed_names(self, name):
        # Real code rarely names a variable exactly "password".
        assert scan_text(f'{name} = "8f4b2c9d1e7a3f6b5c0d"')

    def test_one_value_is_reported_once_under_the_specific_rule(self):
        token = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fwpM"
        findings = scan_text(f'SERVICE_TOKEN = "{token}"')
        assert len(findings) == 1
        assert findings[0].id == "jwt"

    def test_connection_string_password(self):
        text = "DATABASE_URL = 'postgresql://user:hunter2secret@db.internal:5432/app'"
        assert "connection-string" in ids(scan_text(text))

    def test_jwt(self):
        token = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fwpM"
        assert "jwt" in ids(scan_text(f"auth = {token}"))


class TestFalsePositives:
    @pytest.mark.parametrize(
        "value",
        ["<your-api-key>", "${SECRET_TOKEN}", "changeme", "placeholder", "xxxxxxxx", "REDACTED"],
    )
    def test_placeholders_are_ignored(self, value):
        assert scan_text(f'api_key = "{value}"') == []

    def test_low_entropy_words_are_ignored(self):
        assert scan_text('password = "aaaaaaaaaa"') == []

    def test_clean_source_produces_nothing(self):
        source = 'import os\napi_key = os.environ["API_KEY"]\n'
        assert scan_text(source) == []

    def test_minified_lines_are_skipped(self):
        assert scan_text("x" * 2100 + f' api_key = "{AWS_KEY}"') == []


class TestRedaction:
    def test_long_values_keep_only_the_edges(self):
        result = redact(AWS_KEY)
        assert result.startswith("AKIA")
        assert "*" in result
        assert AWS_KEY not in result

    def test_short_values_are_almost_entirely_masked(self):
        assert redact("abc123") == "a*****"

    def test_empty_value(self):
        assert redact("") == ""

    def test_findings_never_contain_the_raw_secret(self):
        findings = scan_text(f'aws = "{AWS_KEY}"\ntoken = "{GITHUB_TOKEN}"')
        assert findings
        for finding in findings:
            assert AWS_KEY not in finding.detail
            assert GITHUB_TOKEN not in finding.detail


class TestEntropy:
    def test_random_strings_score_higher_than_repeated_ones(self):
        assert shannon_entropy("a1B2c3D4e5F6") > shannon_entropy("aaaaaaaaaaaa")

    def test_empty_string(self):
        assert shannon_entropy("") == 0.0


class TestScanPath:
    def test_reports_file_and_line(self, tmp_path):
        target = tmp_path / "settings.py"
        target.write_text(f'DEBUG = True\napi_key = "9f2c41ab77de4c0e8b31"\n')
        report = scan_path(tmp_path)
        assert report.findings[0].location == "settings.py:2"

    def test_skips_dependency_directories(self, tmp_path):
        vendored = tmp_path / "node_modules" / "pkg"
        vendored.mkdir(parents=True)
        (vendored / "index.js").write_text(f'const k = "{AWS_KEY}";')
        assert scan_path(tmp_path).findings == []

    def test_skips_binary_and_media_files(self, tmp_path):
        (tmp_path / "logo.png").write_bytes(b"\x89PNG\r\n\x1a\n" + AWS_KEY.encode())
        assert scan_path(tmp_path).findings == []

    def test_counts_files_scanned(self, tmp_path):
        (tmp_path / "a.py").write_text("clean = 1")
        (tmp_path / "b.py").write_text("also_clean = 2")
        assert scan_path(tmp_path).checks_run == 2

    def test_missing_path_raises(self, tmp_path):
        with pytest.raises(FileNotFoundError):
            scan_path(tmp_path / "nope")

    def test_scanning_a_single_file_works(self, tmp_path):
        target = tmp_path / "one.env"
        target.write_text(f'SECRET_TOKEN = "{SLACK_TOKEN}"')
        assert scan_path(target).findings

    def test_bundled_samples_are_flagged(self):
        from pathlib import Path

        samples = Path(__file__).resolve().parent.parent / "samples" / "app"
        report = scan_path(samples)
        found = ids(report.findings)
        assert "generic-secret" in found
        assert "connection-string" in found
        assert not report.passed
