/* DevMetrics — GitHub repository analytics with hand-rolled SVG charts. */
(function () {
  "use strict";

  const API = "https://api.github.com";
  const SVG_NS = "http://www.w3.org/2000/svg";
  const PALETTE = ["#5eead4", "#818cf8", "#f472b6", "#fbbf24", "#34d399", "#60a5fa", "#f87171", "#a78bfa"];

  const $ = (sel) => document.querySelector(sel);
  const statusEl = $("#status");

  /* ---------- fetching ---------- */

  async function gh(path) {
    const res = await fetch(`${API}${path}`, {
      headers: { Accept: "application/vnd.github+json" },
    });
    if (res.status === 404) throw new Error("Repository not found (is it public?)");
    if (res.status === 403 || res.status === 429) {
      throw new Error("GitHub API rate limit reached — try again in a few minutes");
    }
    // Stats endpoints return 202 while GitHub computes them in the background.
    if (res.status === 202) return { computing: true };
    if (!res.ok) throw new Error(`GitHub API error (${res.status})`);
    return res.json();
  }

  async function ghStatsWithRetry(path, attempts = 4) {
    for (let i = 0; i < attempts; i++) {
      const data = await gh(path);
      if (!data.computing) return data;
      setStatus(`GitHub is computing statistics… retrying (${i + 1}/${attempts})`);
      await new Promise((r) => setTimeout(r, 2500));
    }
    return null; // stats still cooking — render what we can
  }

  /* ---------- SVG helpers ---------- */

  function svgEl(tag, attrs) {
    const el = document.createElementNS(SVG_NS, tag);
    for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value);
    return el;
  }

  function clear(container) {
    container.innerHTML = "";
  }

  function emptyMessage(container, text) {
    clear(container);
    const p = document.createElement("p");
    p.className = "empty";
    p.textContent = text;
    container.appendChild(p);
  }

  /* ---------- charts ---------- */

  /** Weekly commit bar chart with month labels and a hover tooltip. */
  function renderCommitChart(container, weeks) {
    clear(container);
    if (!weeks || !weeks.length || weeks.every((w) => w.total === 0)) {
      return emptyMessage(container, "No commit activity available for this repository.");
    }

    const W = 1000, H = 220, pad = { top: 12, right: 8, bottom: 26, left: 34 };
    const innerW = W - pad.left - pad.right;
    const innerH = H - pad.top - pad.bottom;
    const max = Math.max(...weeks.map((w) => w.total));
    const barW = innerW / weeks.length;

    const svg = svgEl("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": "Commits per week" });

    // y-axis gridlines at 0, ½max, max
    for (const frac of [0, 0.5, 1]) {
      const y = pad.top + innerH - innerH * frac;
      svg.appendChild(svgEl("line", {
        x1: pad.left, y1: y, x2: W - pad.right, y2: y,
        stroke: "#263352", "stroke-width": 1,
      }));
      const label = svgEl("text", {
        x: pad.left - 8, y: y + 4, "text-anchor": "end",
        fill: "#8493b5", "font-size": 11,
      });
      label.textContent = Math.round(max * frac);
      svg.appendChild(label);
    }

    const monthFmt = new Intl.DateTimeFormat("en", { month: "short" });
    let lastMonth = null;

    weeks.forEach((week, i) => {
      const h = max ? (week.total / max) * innerH : 0;
      const x = pad.left + i * barW;
      const bar = svgEl("rect", {
        x: x + 1, y: pad.top + innerH - h,
        width: Math.max(barW - 2, 1), height: Math.max(h, week.total ? 2 : 0),
        rx: 1.5, fill: "#5eead4", opacity: 0.9,
      });
      const date = new Date(week.week * 1000);
      const title = svgEl("title", {});
      title.textContent = `Week of ${date.toLocaleDateString()}: ${week.total} commits`;
      bar.appendChild(title);
      svg.appendChild(bar);

      // month tick when the month changes
      const month = date.getMonth();
      if (month !== lastMonth && i % 2 === 0) {
        lastMonth = month;
        const tick = svgEl("text", {
          x: x + barW / 2, y: H - 8, "text-anchor": "middle",
          fill: "#8493b5", "font-size": 11,
        });
        tick.textContent = monthFmt.format(date);
        svg.appendChild(tick);
      }
    });

    container.appendChild(svg);
  }

  /** Donut chart of language share with a legend. */
  function renderLanguageChart(container, languages) {
    clear(container);
    const entries = Object.entries(languages || {});
    if (!entries.length) return emptyMessage(container, "No language data.");

    const total = entries.reduce((sum, [, bytes]) => sum + bytes, 0);
    const top = entries.slice(0, 7);
    const restBytes = entries.slice(7).reduce((sum, [, b]) => sum + b, 0);
    if (restBytes > 0) top.push(["Other", restBytes]);

    const size = 180, cx = size / 2, cy = size / 2, r = 70, thickness = 26;
    const svg = svgEl("svg", {
      viewBox: `0 0 ${size} ${size}`, role: "img", "aria-label": "Language breakdown",
      style: "max-width:200px;margin-inline:auto",
    });

    let angle = -Math.PI / 2;
    top.forEach(([name, bytes], i) => {
      const frac = bytes / total;
      const sweep = frac * Math.PI * 2;
      const x1 = cx + r * Math.cos(angle);
      const y1 = cy + r * Math.sin(angle);
      angle += sweep;
      const x2 = cx + r * Math.cos(angle);
      const y2 = cy + r * Math.sin(angle);
      const largeArc = sweep > Math.PI ? 1 : 0;

      // Full-circle single language: arc path degenerates, draw a circle.
      const path = frac > 0.999
        ? svgEl("circle", { cx, cy, r, fill: "none", stroke: PALETTE[i % PALETTE.length], "stroke-width": thickness })
        : svgEl("path", {
            d: `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`,
            fill: "none", stroke: PALETTE[i % PALETTE.length],
            "stroke-width": thickness,
          });
      const title = svgEl("title", {});
      title.textContent = `${name}: ${(frac * 100).toFixed(1)}%`;
      path.appendChild(title);
      svg.appendChild(path);
    });

    container.appendChild(svg);

    const legend = document.createElement("div");
    legend.className = "legend";
    top.forEach(([name, bytes], i) => {
      const item = document.createElement("span");
      const swatch = document.createElement("i");
      swatch.style.background = PALETTE[i % PALETTE.length];
      item.append(swatch, `${name} ${((bytes / total) * 100).toFixed(1)}%`);
      legend.appendChild(item);
    });
    container.appendChild(legend);
  }

  /** Horizontal bars for the top contributors. */
  function renderContributorChart(container, contributors) {
    clear(container);
    if (!contributors || !contributors.length) {
      return emptyMessage(container, "No contributor data.");
    }

    const top = contributors.slice(0, 8);
    const max = Math.max(...top.map((c) => c.contributions));
    const rowH = 30, labelW = 130, W = 420, H = top.length * rowH;
    const barMax = W - labelW - 60;

    const svg = svgEl("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": "Top contributors" });

    top.forEach((c, i) => {
      const y = i * rowH;
      const name = svgEl("text", {
        x: labelW - 10, y: y + rowH / 2 + 4, "text-anchor": "end",
        fill: "#d4dcf0", "font-size": 12,
      });
      name.textContent = c.login.length > 16 ? `${c.login.slice(0, 15)}…` : c.login;
      svg.appendChild(name);

      const w = (c.contributions / max) * barMax;
      svg.appendChild(svgEl("rect", {
        x: labelW, y: y + 6, width: Math.max(w, 2), height: rowH - 12,
        rx: 4, fill: "#818cf8",
      }));

      const count = svgEl("text", {
        x: labelW + w + 8, y: y + rowH / 2 + 4,
        fill: "#8493b5", "font-size": 12,
      });
      count.textContent = c.contributions.toLocaleString();
      svg.appendChild(count);
    });

    container.appendChild(svg);
  }

  /* ---------- dashboard ---------- */

  function setStatus(message, isError = false) {
    statusEl.hidden = !message;
    statusEl.textContent = message || "";
    statusEl.classList.toggle("error", isError);
  }

  const numberFmt = new Intl.NumberFormat("en", { notation: "compact" });

  async function analyze(fullName) {
    const [owner, repo] = fullName.split("/");
    const base = `/repos/${owner}/${repo}`;

    setStatus("Fetching repository…");
    const info = await gh(base);

    $("#repo-name").innerHTML = "";
    const link = document.createElement("a");
    link.href = info.html_url;
    link.target = "_blank";
    link.rel = "noopener";
    link.textContent = info.full_name;
    $("#repo-name").appendChild(link);
    $("#repo-desc").textContent = info.description || "No description.";
    $("#stat-stars").textContent = numberFmt.format(info.stargazers_count);
    $("#stat-forks").textContent = numberFmt.format(info.forks_count);
    $("#stat-issues").textContent = numberFmt.format(info.open_issues_count);
    $("#stat-pushed").textContent = new Date(info.pushed_at).toLocaleDateString();
    $("#dashboard").hidden = false;

    setStatus("Fetching languages and contributors…");
    const [languages, contributors] = await Promise.all([
      gh(`${base}/languages`).catch(() => null),
      gh(`${base}/contributors?per_page=8`).catch(() => null),
    ]);
    renderLanguageChart($("#chart-languages"), languages);
    renderContributorChart(
      $("#chart-contributors"),
      Array.isArray(contributors) ? contributors : null
    );

    setStatus("Fetching commit activity…");
    const activity = await ghStatsWithRetry(`${base}/stats/commit_activity`).catch(() => null);
    if (activity) {
      renderCommitChart($("#chart-commits"), activity);
      setStatus("");
    } else {
      emptyMessage(
        $("#chart-commits"),
        "GitHub is still computing commit statistics — try again shortly."
      );
      setStatus("");
    }
  }

  $("#repo-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const value = $("#repo-input").value.trim();
    const button = e.target.querySelector("button");
    button.disabled = true;
    try {
      await analyze(value);
      const params = new URLSearchParams({ repo: value });
      history.replaceState(null, "", `?${params}`);
    } catch (err) {
      $("#dashboard").hidden = true;
      setStatus(err.message, true);
    } finally {
      button.disabled = false;
    }
  });

  // Deep-linking: ?repo=owner/name
  const initial = new URLSearchParams(location.search).get("repo");
  if (initial && /^[\w.-]+\/[\w.-]+$/.test(initial)) {
    $("#repo-input").value = initial;
    $("#repo-form").requestSubmit();
  }
})();
