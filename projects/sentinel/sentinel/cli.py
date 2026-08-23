"""Command-line interface.

    python -m sentinel.cli headers --file samples/headers.json
    python -m sentinel.cli headers --url https://example.com
    python -m sentinel.cli secrets ./src
    python -m sentinel.cli password 'correct horse battery staple'
    python -m sentinel.cli demo --html report.html
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from urllib.request import Request, urlopen

from . import headers as headers_check
from . import passwords, secrets
from .report import to_html, to_text

SAMPLES = Path(__file__).resolve().parent.parent / "samples"


def _fetch_headers(url: str) -> dict[str, str]:
    """Fetch response headers only. Read nothing else from the target."""
    request = Request(url, method="HEAD", headers={"User-Agent": "sentinel/1.0"})
    with urlopen(request, timeout=10) as response:  # noqa: S310 - user-supplied URL is the point
        return dict(response.headers.items())


def cmd_headers(args: argparse.Namespace) -> int:
    if args.url:
        if not args.url.startswith(("http://", "https://")):
            print("error: url must start with http:// or https://", file=sys.stderr)
            return 2
        try:
            raw = _fetch_headers(args.url)
        except Exception as error:  # network problems are expected, not exceptional
            print(f"error: could not fetch {args.url}: {error}", file=sys.stderr)
            return 1
        target = args.url
    else:
        path = Path(args.file)
        try:
            raw = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as error:
            print(f"error: could not read {path}: {error}", file=sys.stderr)
            return 1
        target = str(path)

    report = headers_check.analyze(raw, target=target)
    print(to_text(report))
    return 0 if report.passed else 1


def cmd_secrets(args: argparse.Namespace) -> int:
    try:
        report = secrets.scan_path(args.path)
    except FileNotFoundError as error:
        print(f"error: {error}", file=sys.stderr)
        return 1
    print(to_text(report))
    print(f"\nScanned {report.checks_run} files.")
    return 0 if report.passed else 1


def cmd_password(args: argparse.Namespace) -> int:
    result = passwords.analyze(args.password)
    filled = "█" * (result.score + 1)
    empty = "░" * (4 - result.score)
    print(f"Strength: {result.label}  [{filled}{empty}]  {result.entropy_bits} bits")
    for warning in result.warnings:
        print(f"  ⚠  {warning}")
    for suggestion in result.suggestions:
        print(f"  →  {suggestion}")
    return 0 if result.acceptable else 1


def cmd_demo(args: argparse.Namespace) -> int:
    """Audit the bundled deliberately-insecure samples."""
    raw = json.loads((SAMPLES / "headers.json").read_text(encoding="utf-8"))
    reports = [
        headers_check.analyze(raw, target="https://demo.example.com"),
        secrets.scan_path(SAMPLES / "app"),
    ]
    if args.html:
        Path(args.html).write_text(to_html(reports), encoding="utf-8")
        print(f"Wrote {args.html}")
    else:
        for report in reports:
            print(to_text(report))
            print()
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="sentinel", description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)

    headers_parser = sub.add_parser("headers", help="audit HTTP security headers")
    source = headers_parser.add_mutually_exclusive_group(required=True)
    source.add_argument("--url", help="fetch headers from a live URL (HEAD request)")
    source.add_argument("--file", help="read headers from a JSON file")
    headers_parser.set_defaults(func=cmd_headers)

    secrets_parser = sub.add_parser("secrets", help="scan a path for committed credentials")
    secrets_parser.add_argument("path")
    secrets_parser.set_defaults(func=cmd_secrets)

    password_parser = sub.add_parser("password", help="score a password's strength")
    password_parser.add_argument("password")
    password_parser.set_defaults(func=cmd_password)

    demo_parser = sub.add_parser("demo", help="audit the bundled insecure samples")
    demo_parser.add_argument("--html", help="write an HTML report to this path")
    demo_parser.set_defaults(func=cmd_demo)

    args = parser.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
