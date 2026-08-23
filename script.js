/* Mahden Saleh — Portfolio interactions (dependency-free) */
(function () {
  "use strict";

  /* ---------- Theme toggle (persisted, respects system preference) ---------- */
  const root = document.documentElement;
  const themeToggle = document.getElementById("theme-toggle");

  const storedTheme = localStorage.getItem("theme");
  if (storedTheme === "light" || (!storedTheme && window.matchMedia("(prefers-color-scheme: light)").matches)) {
    root.setAttribute("data-theme", "light");
  }

  themeToggle.addEventListener("click", function () {
    const isLight = root.getAttribute("data-theme") === "light";
    if (isLight) {
      root.removeAttribute("data-theme");
      localStorage.setItem("theme", "dark");
    } else {
      root.setAttribute("data-theme", "light");
      localStorage.setItem("theme", "light");
    }
  });

  /* ---------- Mobile menu ---------- */
  const menuToggle = document.getElementById("menu-toggle");
  const navLinks = document.querySelector(".nav-links");

  menuToggle.addEventListener("click", function () {
    const open = navLinks.classList.toggle("open");
    menuToggle.setAttribute("aria-expanded", String(open));
    menuToggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  });

  navLinks.addEventListener("click", function (e) {
    if (e.target.tagName === "A") {
      navLinks.classList.remove("open");
      menuToggle.setAttribute("aria-expanded", "false");
    }
  });

  /* ---------- Typed rotating words in hero ---------- */
  const typedEl = document.getElementById("typed");
  const words = ["ships.", "scales.", "lasts.", "people love."];
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (typedEl && !reduceMotion) {
    let wordIndex = 0;
    let charIndex = words[0].length;
    let deleting = true;

    function tick() {
      const word = words[wordIndex];
      if (deleting) {
        charIndex--;
        typedEl.textContent = word.slice(0, charIndex);
        if (charIndex === 0) {
          deleting = false;
          wordIndex = (wordIndex + 1) % words.length;
        }
        setTimeout(tick, 45);
      } else {
        charIndex++;
        typedEl.textContent = words[wordIndex].slice(0, charIndex);
        if (charIndex === words[wordIndex].length) {
          deleting = true;
          setTimeout(tick, 2200);
          return;
        }
        setTimeout(tick, 85);
      }
    }
    setTimeout(tick, 2200);
  }

  /* ---------- Project filtering by discipline ---------- */
  const filterBar = document.getElementById("project-filters");

  if (filterBar) {
    const cards = [...document.querySelectorAll("#projects-grid .project-card")];
    const buttons = [...filterBar.querySelectorAll(".filter")];
    const status = document.getElementById("filter-status");

    // A card can belong to more than one discipline (TaskFlow is both software
    // engineering and back end), so categories are space-separated.
    const categoriesOf = (card) => (card.dataset.category || "").split(/\s+/);

    // Count from the DOM rather than hardcoding numbers that can drift.
    buttons.forEach((button) => {
      const filter = button.dataset.filter;
      // Capture the label before the count badge becomes part of textContent.
      button.dataset.label = button.textContent.trim();
      const count =
        filter === "all"
          ? cards.length
          : cards.filter((card) => categoriesOf(card).includes(filter)).length;
      const badge = document.createElement("span");
      badge.className = "count";
      badge.textContent = ` ${count}`;
      button.appendChild(badge);
    });

    function applyFilter(filter) {
      let shown = 0;
      cards.forEach((card) => {
        const match = filter === "all" || categoriesOf(card).includes(filter);
        card.classList.toggle("is-hidden", !match);
        if (match) shown++;
      });
      buttons.forEach((button) => {
        button.setAttribute("aria-pressed", String(button.dataset.filter === filter));
      });
      const label =
        filter === "all"
          ? `Showing all ${shown} projects`
          : `Showing ${shown} ${shown === 1 ? "project" : "projects"} in ${
              filterBar.querySelector(`[data-filter="${filter}"]`).dataset.label
            }`;
      status.textContent = label;

      const params = new URLSearchParams(window.location.search);
      if (filter === "all") params.delete("focus");
      else params.set("focus", filter);
      const query = params.toString();
      history.replaceState(null, "", `${window.location.pathname}${query ? "?" + query : ""}#projects`);
    }

    filterBar.addEventListener("click", (event) => {
      const button = event.target.closest(".filter");
      if (button) applyFilter(button.dataset.filter);
    });

    // Deep link: ?focus=security opens the site pre-filtered, which makes it
    // easy to send a recruiter straight to the relevant work.
    const requested = new URLSearchParams(window.location.search).get("focus");
    const valid = buttons.some((button) => button.dataset.filter === requested);
    applyFilter(valid ? requested : "all");
  }

  /* ---------- Reveal sections on scroll ---------- */
  const revealTargets = document.querySelectorAll(
    ".section-title, .about-grid, .skill-card, .project-card, .timeline-item, .cert-card, .contact-lede"
  );
  revealTargets.forEach(function (el) { el.classList.add("reveal"); });

  const observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12 }
  );
  revealTargets.forEach(function (el) { observer.observe(el); });
})();
