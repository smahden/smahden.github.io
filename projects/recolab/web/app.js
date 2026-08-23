/* RecoLab demo — the same vector math as the Python package, in the browser. */
(function () {
  "use strict";

  const $ = (sel) => document.querySelector(sel);
  const state = { items: [], selected: new Set(), category: "all", query: "" };

  /* ---------- vector math (mirrors recolab.similarity / recolab.text) ---------- */

  function dot(a, b) {
    // Iterate the smaller vector, look up in the larger — same trick as the Python side.
    let [small, large] = Object.keys(a).length > Object.keys(b).length ? [b, a] : [a, b];
    let total = 0;
    for (const term in small) {
      const other = large[term];
      if (other !== undefined) total += small[term] * other;
    }
    return total;
  }

  function norm(vector) {
    let total = 0;
    for (const term in vector) total += vector[term] * vector[term];
    return Math.sqrt(total);
  }

  function cosine(a, b) {
    const na = norm(a);
    const nb = norm(b);
    if (na === 0 || nb === 0) return 0;
    return dot(a, b) / (na * nb);
  }

  function meanVector(vectors) {
    const total = {};
    for (const vector of vectors) {
      for (const term in vector) total[term] = (total[term] || 0) + vector[term];
    }
    const magnitude = norm(total);
    if (magnitude === 0) return {};
    const result = {};
    for (const term in total) result[term] = total[term] / magnitude;
    return result;
  }

  /** Terms contributing most to a match — what the two vectors share. */
  function overlapTerms(a, b, limit = 4) {
    const shared = [];
    for (const term in a) {
      if (b[term] !== undefined) shared.push([term, a[term] * b[term]]);
    }
    shared.sort((x, y) => y[1] - x[1]);
    return shared.slice(0, limit).map(([term]) => term);
  }

  /* ---------- rendering ---------- */

  function renderFilters() {
    const categories = ["all", ...new Set(state.items.map((item) => item.category))];
    const container = $("#filters");
    container.innerHTML = "";
    for (const category of categories) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = category === "all" ? "All topics" : category.replace(/-/g, " ");
      button.setAttribute("aria-pressed", String(state.category === category));
      button.addEventListener("click", () => {
        state.category = category;
        renderFilters();
        renderCatalog();
      });
      container.appendChild(button);
    }
  }

  function visibleItems() {
    const query = state.query.trim().toLowerCase();
    return state.items.filter((item) => {
      if (state.category !== "all" && item.category !== state.category) return false;
      if (!query) return true;
      const haystack = `${item.title} ${item.tags.join(" ")} ${item.description}`.toLowerCase();
      return haystack.includes(query);
    });
  }

  function renderCatalog() {
    const list = $("#catalog");
    list.innerHTML = "";
    const items = visibleItems();
    $("#catalog-empty").hidden = items.length > 0;

    for (const item of items) {
      const li = document.createElement("li");
      const button = document.createElement("button");
      button.type = "button";
      button.setAttribute("aria-pressed", String(state.selected.has(item.id)));

      const check = document.createElement("span");
      check.className = "check";
      check.setAttribute("aria-hidden", "true");
      check.textContent = "✓";

      const meta = document.createElement("span");
      meta.className = "meta";
      const title = document.createElement("span");
      title.className = "title";
      title.textContent = item.title;
      const category = document.createElement("span");
      category.className = "cat";
      category.textContent = item.category;
      meta.append(title, category);

      button.append(check, meta);
      button.addEventListener("click", () => toggle(item.id));
      li.appendChild(button);
      list.appendChild(li);
    }
  }

  function toggle(id) {
    if (state.selected.has(id)) state.selected.delete(id);
    else state.selected.add(id);
    renderCatalog();
    renderResults();
  }

  function renderResults() {
    const list = $("#results");
    const count = state.selected.size;
    $("#stat-selected").textContent = String(count);
    $("#clear").hidden = count === 0;
    list.innerHTML = "";

    if (count === 0) {
      $("#results-empty").hidden = false;
      $("#method-hint").textContent = "select an item to begin";
      return;
    }
    $("#results-empty").hidden = true;
    $("#method-hint").textContent =
      count === 1 ? "nearest neighbours · cosine similarity" : `taste profile · centroid of ${count} vectors`;

    const byId = new Map(state.items.map((item) => [item.id, item]));
    const liked = [...state.selected].map((id) => byId.get(id).vector);
    const query = count === 1 ? liked[0] : meanVector(liked);

    const ranked = state.items
      .filter((item) => !state.selected.has(item.id))
      .map((item) => ({ item, score: cosine(query, item.vector) }))
      // Ties break on id so the list never reshuffles between renders.
      .sort((a, b) => b.score - a.score || a.item.id.localeCompare(b.item.id))
      .filter((entry) => entry.score > 0)
      .slice(0, 6);

    if (!ranked.length) {
      $("#results-empty").hidden = false;
      $("#results-empty").textContent = "Nothing in the catalog overlaps with that selection.";
      return;
    }

    for (const { item, score } of ranked) {
      const li = document.createElement("li");
      li.className = "result";

      const top = document.createElement("div");
      top.className = "result-top";
      const title = document.createElement("span");
      title.className = "result-title";
      title.textContent = item.title;
      const value = document.createElement("span");
      value.className = "result-score";
      value.textContent = score.toFixed(3);
      top.append(title, value);

      const category = document.createElement("span");
      category.className = "result-cat";
      category.textContent = item.category;

      const bar = document.createElement("div");
      bar.className = "bar";
      const fill = document.createElement("span");
      // Scale against the top hit so the strongest match fills the bar.
      fill.style.width = `${Math.max(4, (score / ranked[0].score) * 100)}%`;
      bar.appendChild(fill);

      const terms = document.createElement("ul");
      terms.className = "terms";
      for (const term of overlapTerms(query, item.vector)) {
        const chip = document.createElement("li");
        chip.textContent = term;
        terms.appendChild(chip);
      }

      li.append(top, category, bar, terms);
      list.appendChild(li);
    }
  }

  /* ---------- boot ---------- */

  $("#search").addEventListener("input", (event) => {
    state.query = event.target.value;
    renderCatalog();
  });

  $("#clear").addEventListener("click", () => {
    state.selected.clear();
    renderCatalog();
    renderResults();
  });

  fetch("data.json")
    .then((response) => {
      if (!response.ok) throw new Error(`Could not load data.json (${response.status})`);
      return response.json();
    })
    .then((data) => {
      state.items = data.items;
      $("#stat-items").textContent = String(data.items.length);
      $("#stat-vocab").textContent = String(data.vocabulary_size);
      renderFilters();
      renderCatalog();
      renderResults();
    })
    .catch((error) => {
      $("#catalog-empty").hidden = false;
      $("#catalog-empty").textContent = `${error.message}. Run: python -m recolab.export`;
    });
})();
