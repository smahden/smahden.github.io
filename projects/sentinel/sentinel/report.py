"""Render reports as plain text for a terminal or self-contained HTML."""

from __future__ import annotations

import html
from datetime import datetime, timezone
from typing import Sequence

from .findings import Report, Severity

GRADE_COLORS = {"A": "#34d399", "B": "#a3e635", "C": "#fbbf24", "D": "#fb923c", "F": "#f87171"}
SEVERITY_COLORS = {
    Severity.CRITICAL: "#f87171",
    Severity.HIGH: "#fb923c",
    Severity.MEDIUM: "#fbbf24",
    Severity.LOW: "#60a5fa",
    Severity.INFO: "#94a3b8",
}


def to_text(report: Report) -> str:
    lines = [
        f"{report.kind} — {report.target}",
        f"Grade {report.grade}  ({report.score}/100)   findings: {len(report.findings)}",
        "-" * 64,
    ]
    if not report.findings:
        lines.append("No issues found.")
    for finding in report.sorted_findings():
        location = f" [{finding.location}]" if finding.location else ""
        lines.append(f"{finding.severity.value.upper():<8} {finding.title}{location}")
        lines.append(f"         {finding.detail}")
        if finding.remediation:
            lines.append(f"         fix: {finding.remediation}")
    return "\n".join(lines)


def _summary_row(report: Report) -> str:
    cells = []
    for severity, count in report.counts().items():
        if count == 0:
            continue
        cells.append(
            f'<span class="pill" style="--c:{SEVERITY_COLORS[severity]}">'
            f"{count} {html.escape(severity.value)}</span>"
        )
    return "".join(cells) or '<span class="pill" style="--c:#34d399">no issues</span>'


def _report_section(report: Report) -> str:
    rows = []
    for finding in report.sorted_findings():
        color = SEVERITY_COLORS[finding.severity]
        location = (
            f'<code class="loc">{html.escape(finding.location)}</code>'
            if finding.location
            else ""
        )
        remediation = (
            f'<p class="fix"><strong>Fix:</strong> {html.escape(finding.remediation)}</p>'
            if finding.remediation
            else ""
        )
        rows.append(
            f"""
        <li class="finding">
          <div class="finding-head">
            <span class="sev" style="--c:{color}">{html.escape(finding.severity.value)}</span>
            <h3>{html.escape(finding.title)}</h3>
            {location}
          </div>
          <p>{html.escape(finding.detail)}</p>
          {remediation}
        </li>"""
        )

    body = "".join(rows) or '<li class="finding clean">Nothing flagged in this check.</li>'
    grade_color = GRADE_COLORS[report.grade]
    return f"""
    <section class="card">
      <header class="card-head">
        <div>
          <p class="kind">{html.escape(report.kind)}</p>
          <h2>{html.escape(report.target)}</h2>
          <div class="pills">{_summary_row(report)}</div>
        </div>
        <div class="grade" style="--c:{grade_color}">
          <span class="letter">{report.grade}</span>
          <span class="score">{report.score}/100</span>
        </div>
      </header>
      <ul class="findings">{body}</ul>
    </section>"""


def to_html(reports: Sequence[Report], title: str = "Sentinel security report") -> str:
    """Render one or more reports as a single self-contained HTML page."""
    generated = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    sections = "".join(_report_section(report) for report in reports)
    total = sum(len(report.findings) for report in reports)

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>{html.escape(title)}</title>
<style>
  :root {{
    --bg:#0b1120; --card:#141d33; --raised:#1b2745; --border:#26334f;
    --text:#cfd8ee; --strong:#f2f6ff; --muted:#8593b3;
    font-family: system-ui,-apple-system,"Segoe UI",sans-serif;
  }}
  *{{margin:0;padding:0;box-sizing:border-box}}
  body{{background:var(--bg);color:var(--text);line-height:1.6;padding:2.5rem 1.2rem}}
  .wrap{{width:min(920px,100%);margin-inline:auto}}
  .masthead{{text-align:center;margin-bottom:2rem}}
  .masthead h1{{color:var(--strong);font-size:1.7rem}}
  .masthead p{{color:var(--muted);font-size:.88rem;margin-top:.4rem}}
  .card{{background:var(--card);border:1px solid var(--border);border-radius:14px;
        padding:1.5rem;margin-bottom:1.4rem}}
  .card-head{{display:flex;justify-content:space-between;gap:1.4rem;align-items:flex-start;
        padding-bottom:1.1rem;border-bottom:1px solid var(--border);margin-bottom:1.1rem}}
  .kind{{font-size:.7rem;text-transform:uppercase;letter-spacing:.08em;color:var(--muted)}}
  .card-head h2{{color:var(--strong);font-size:1.15rem;word-break:break-all}}
  .pills{{display:flex;flex-wrap:wrap;gap:.4rem;margin-top:.6rem}}
  .pill{{font-size:.72rem;font-weight:700;border-radius:999px;padding:.15rem .6rem;
        color:var(--c);background:color-mix(in srgb,var(--c) 16%,transparent);
        border:1px solid color-mix(in srgb,var(--c) 40%,transparent)}}
  .grade{{text-align:center;flex-shrink:0;border:2px solid var(--c);border-radius:12px;
        padding:.5rem 1rem;min-width:92px}}
  .grade .letter{{display:block;font-size:2.1rem;font-weight:800;color:var(--c);line-height:1}}
  .grade .score{{font-size:.72rem;color:var(--muted);font-variant-numeric:tabular-nums}}
  .findings{{list-style:none;display:grid;gap:.8rem}}
  .finding{{background:var(--raised);border:1px solid var(--border);border-radius:10px;padding:.9rem 1rem}}
  .finding.clean{{color:var(--muted);font-size:.9rem}}
  .finding-head{{display:flex;align-items:center;gap:.6rem;flex-wrap:wrap;margin-bottom:.35rem}}
  .finding-head h3{{color:var(--strong);font-size:.95rem}}
  .sev{{font-size:.66rem;font-weight:800;text-transform:uppercase;letter-spacing:.06em;
        color:var(--c);border:1px solid color-mix(in srgb,var(--c) 45%,transparent);
        background:color-mix(in srgb,var(--c) 14%,transparent);border-radius:999px;padding:.1rem .5rem}}
  .loc{{font-family:ui-monospace,monospace;font-size:.72rem;color:var(--muted)}}
  .finding p{{font-size:.87rem}}
  .fix{{margin-top:.4rem;color:var(--muted)}}
  .fix strong{{color:#5eead4}}
  code{{font-family:ui-monospace,monospace}}
  footer{{text-align:center;color:var(--muted);font-size:.78rem;margin-top:1.5rem}}
</style>
</head>
<body>
  <div class="wrap">
    <header class="masthead">
      <h1>🛡️ Sentinel security report</h1>
      <p>{total} finding{"" if total == 1 else "s"} across {len(reports)} check{"" if len(reports) == 1 else "s"} · generated {html.escape(generated)}</p>
    </header>
    {sections}
    <footer>Generated by Sentinel — defensive security tooling by Mahden Saleh</footer>
  </div>
</body>
</html>
"""
