# Sample fixtures

These files are **deliberately insecure** so `python -m sentinel.cli demo` has
something to find. Every credential in them is fabricated and points at nothing.

- `headers.json` — a weak set of response headers (wildcard CSP with `unsafe-inline`,
  a six-minute HSTS max-age, no frame protection, and CORS wildcard with credentials).
- `app/` — a tiny app tree with credentials hardcoded into source, plus a few
  placeholder values the scanner is expected to stay quiet about.

Vendor-specific patterns (AWS keys, GitHub and Slack tokens, PEM private key
blocks) are exercised in the test suite rather than committed here. The test
fixtures build those strings by concatenating fragments at runtime, so the
literal patterns never appear in a committed file where a repository secret
scanner would flag them — a real repo should not carry realistic-looking
credentials just to demo a scanner.
