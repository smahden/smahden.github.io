/* TaskFlow front end — dependency-free vanilla JS. */
(function () {
  "use strict";

  const $ = (sel) => document.querySelector(sel);

  /* ---------- API client ---------- */

  const api = {
    token: localStorage.getItem("taskflow_token"),

    async request(method, path, body) {
      const res = await fetch(`/api${path}`, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      if (res.status === 401 && this.token) {
        this.setToken(null);
        showAuth();
        throw new Error("Session expired, please log in again");
      }
      if (res.status === 204) return null;
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
      return data;
    },

    setToken(token) {
      this.token = token;
      if (token) localStorage.setItem("taskflow_token", token);
      else localStorage.removeItem("taskflow_token");
    },

    get: (p) => api.request("GET", p),
    post: (p, b) => api.request("POST", p, b),
    patch: (p, b) => api.request("PATCH", p, b),
    delete: (p) => api.request("DELETE", p),
  };

  /* ---------- view switching ---------- */

  const views = { auth: $("#auth-view"), boards: $("#boards-view"), board: $("#board-view") };

  function show(name) {
    Object.entries(views).forEach(([key, el]) => (el.hidden = key !== name));
    $("#user-area").hidden = name === "auth";
  }

  function showAuth() {
    show("auth");
  }

  /* ---------- auth ---------- */

  let registerMode = false;

  $("#auth-switch-btn").addEventListener("click", () => {
    registerMode = !registerMode;
    $("#auth-title").textContent = registerMode ? "Create your account" : "Welcome back";
    $("#name-field").hidden = !registerMode;
    $("#name").required = registerMode;
    $("#auth-submit").textContent = registerMode ? "Sign up" : "Log in";
    $("#auth-switch-text").textContent = registerMode ? "Already have an account?" : "New here?";
    $("#auth-switch-btn").textContent = registerMode ? "Log in instead" : "Create an account";
    $("#auth-error").hidden = true;
  });

  $("#auth-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const errEl = $("#auth-error");
    errEl.hidden = true;
    try {
      const body = { email: $("#email").value, password: $("#password").value };
      if (registerMode) body.name = $("#name").value;
      const data = await api.post(registerMode ? "/auth/register" : "/auth/login", body);
      api.setToken(data.token);
      setUser(data.user);
      await loadBoards();
    } catch (err) {
      errEl.textContent = err.message;
      errEl.hidden = false;
    }
  });

  $("#logout-btn").addEventListener("click", () => {
    api.setToken(null);
    showAuth();
  });

  function setUser(user) {
    $("#user-name").textContent = `Hi, ${user.name}`;
  }

  /* ---------- boards list ---------- */

  async function loadBoards() {
    const { boards } = await api.get("/boards");
    const list = $("#boards-list");
    list.innerHTML = "";
    for (const board of boards) {
      const li = document.createElement("li");
      li.className = "board-tile";

      const link = document.createElement("a");
      link.href = "#";
      link.textContent = board.title;
      link.addEventListener("click", (e) => {
        e.preventDefault();
        openBoard(board.id);
      });

      const meta = document.createElement("span");
      meta.className = "tile-meta";
      meta.textContent = `Created ${board.created_at.slice(0, 10)}`;

      const actions = document.createElement("div");
      actions.className = "tile-actions";
      const del = document.createElement("button");
      del.textContent = "Delete";
      del.addEventListener("click", async () => {
        if (!confirm(`Delete board "${board.title}"?`)) return;
        await api.delete(`/boards/${board.id}`);
        loadBoards();
      });
      actions.appendChild(del);

      li.append(link, meta, actions);
      list.appendChild(li);
    }
    show("boards");
  }

  $("#new-board-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const input = $("#new-board-title");
    await api.post("/boards", { title: input.value });
    input.value = "";
    loadBoards();
  });

  /* ---------- single board ---------- */

  let currentBoardId = null;

  $("#back-btn").addEventListener("click", () => loadBoards());

  $("#new-column-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const input = $("#new-column-title");
    await api.post(`/boards/${currentBoardId}/columns`, { title: input.value });
    input.value = "";
    openBoard(currentBoardId);
  });

  async function openBoard(id) {
    currentBoardId = id;
    const { board } = await api.get(`/boards/${id}`);
    $("#board-title").textContent = board.title;

    const wrap = $("#columns");
    wrap.innerHTML = "";
    for (const column of board.columns) {
      wrap.appendChild(renderColumn(column));
    }
    show("board");
  }

  function renderColumn(column) {
    const el = document.createElement("div");
    el.className = "column";
    el.dataset.columnId = column.id;

    const head = document.createElement("div");
    head.className = "column-head";
    const title = document.createElement("h3");
    title.textContent = column.title;
    const count = document.createElement("span");
    count.className = "count";
    count.textContent = column.cards.length;
    const del = document.createElement("button");
    del.className = "col-delete";
    del.title = "Delete column";
    del.textContent = "✕";
    del.addEventListener("click", async () => {
      if (!confirm(`Delete column "${column.title}" and its cards?`)) return;
      await api.delete(`/columns/${column.id}`);
      openBoard(currentBoardId);
    });
    head.append(title, count, del);

    const cards = document.createElement("div");
    cards.className = "cards";
    for (const card of column.cards) cards.appendChild(renderCard(card));

    // Drop target behavior
    cards.addEventListener("dragover", (e) => {
      e.preventDefault();
      cards.classList.add("drag-over");
    });
    cards.addEventListener("dragleave", () => cards.classList.remove("drag-over"));
    cards.addEventListener("drop", async (e) => {
      e.preventDefault();
      cards.classList.remove("drag-over");
      const cardId = e.dataTransfer.getData("text/plain");
      if (!cardId) return;
      // Insert position: count cards above the drop point.
      const after = [...cards.querySelectorAll(".card:not(.dragging)")].filter(
        (c) => e.clientY > c.getBoundingClientRect().top + c.offsetHeight / 2
      ).length;
      await api.patch(`/cards/${cardId}`, { columnId: column.id, position: after });
      openBoard(currentBoardId);
    });

    const form = document.createElement("form");
    form.className = "add-card-form";
    const input = document.createElement("input");
    input.placeholder = "Add a card…";
    input.required = true;
    const btn = document.createElement("button");
    btn.textContent = "+";
    btn.title = "Add card";
    form.append(input, btn);
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      await api.post(`/columns/${column.id}/cards`, { title: input.value });
      openBoard(currentBoardId);
    });

    el.append(head, cards, form);
    return el;
  }

  function renderCard(card) {
    const el = document.createElement("div");
    el.className = "card";
    el.draggable = true;
    el.dataset.cardId = card.id;

    const del = document.createElement("button");
    del.className = "card-delete";
    del.title = "Delete card";
    del.textContent = "✕";
    del.addEventListener("click", async () => {
      await api.delete(`/cards/${card.id}`);
      openBoard(currentBoardId);
    });

    const title = document.createElement("h4");
    title.textContent = card.title;
    el.append(del, title);

    if (card.description) {
      const desc = document.createElement("p");
      desc.textContent = card.description;
      el.appendChild(desc);
    }

    el.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("text/plain", card.id);
      e.dataTransfer.effectAllowed = "move";
      el.classList.add("dragging");
    });
    el.addEventListener("dragend", () => el.classList.remove("dragging"));

    return el;
  }

  /* ---------- boot ---------- */

  (async function init() {
    if (!api.token) return showAuth();
    try {
      const { user } = await api.get("/auth/me");
      setUser(user);
      await loadBoards();
    } catch {
      showAuth();
    }
  })();
})();
