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

    // `fromUser` guards the URL rewrite: on first load the address bar must
    // stay clean so visitors (and anyone reloading a shared link) land on the
    // top of the page rather than being jumped down to the Projects section.
    function applyFilter(filter, fromUser = false) {
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

      if (!fromUser) return;
      const params = new URLSearchParams(window.location.search);
      if (filter === "all") params.delete("focus");
      else params.set("focus", filter);
      const query = params.toString();
      history.replaceState(null, "", `${window.location.pathname}${query ? "?" + query : ""}#projects`);
    }

    filterBar.addEventListener("click", (event) => {
      const button = event.target.closest(".filter");
      if (button) applyFilter(button.dataset.filter, true);
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
          // Stagger items that share a row so a grid fades in as a wave
          // rather than all at once.
          const siblings = [...entry.target.parentElement.children].filter((el) =>
            el.classList.contains("reveal")
          );
          const index = Math.max(0, siblings.indexOf(entry.target));
          entry.target.style.setProperty("--reveal-delay", `${Math.min(index, 6) * 70}ms`);
          entry.target.classList.add("visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12 }
  );
  revealTargets.forEach(function (el) { observer.observe(el); });

  /* ---------- Scroll progress bar ---------- */
  const progressBar = document.getElementById("scroll-progress-bar");
  const backToTop = document.getElementById("back-to-top");
  let ticking = false;

  function onScroll() {
    const scrollable = document.documentElement.scrollHeight - window.innerHeight;
    const ratio = scrollable > 0 ? window.scrollY / scrollable : 0;
    if (progressBar) progressBar.style.transform = `scaleX(${Math.min(1, Math.max(0, ratio))})`;

    if (backToTop) {
      const show = window.scrollY > window.innerHeight * 0.6;
      backToTop.hidden = !show;
      backToTop.classList.toggle("is-visible", show);
    }
    ticking = false;
  }

  window.addEventListener(
    "scroll",
    function () {
      // rAF-throttled: the handler runs at most once per frame.
      if (!ticking) {
        ticking = true;
        window.requestAnimationFrame(onScroll);
      }
    },
    { passive: true }
  );
  onScroll();

  if (backToTop) {
    backToTop.addEventListener("click", function () {
      window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
      document.querySelector(".logo").focus({ preventScroll: true });
    });
  }

  /* ---------- Nav scrollspy ---------- */
  const navAnchors = [...document.querySelectorAll(".nav-links a[href^='#']")];
  const watched = navAnchors
    .map((anchor) => document.querySelector(anchor.getAttribute("href")))
    .filter(Boolean);

  if (watched.length) {
    const spy = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          navAnchors.forEach(function (anchor) {
            const active = anchor.getAttribute("href") === `#${entry.target.id}`;
            anchor.classList.toggle("is-current", active);
            if (active) anchor.setAttribute("aria-current", "true");
            else anchor.removeAttribute("aria-current");
          });
        });
      },
      // Trigger when a section crosses the upper third of the viewport.
      { rootMargin: "-20% 0px -70% 0px" }
    );
    watched.forEach(function (section) { spy.observe(section); });
  }

  /* ---------- Count-up stats ---------- */
  const statValues = [...document.querySelectorAll(".stat-value[data-count]")];

  if (statValues.length) {
    const countObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          countObserver.unobserve(entry.target);

          const target = Number(entry.target.dataset.count);
          if (reduceMotion || target === 0) {
            entry.target.textContent = String(target);
            return;
          }

          const duration = 1100;
          const start = performance.now();
          (function step(now) {
            const t = Math.min(1, (now - start) / duration);
            // Ease-out cubic so the number decelerates into place.
            const eased = 1 - Math.pow(1 - t, 3);
            entry.target.textContent = String(Math.round(target * eased));
            if (t < 1) requestAnimationFrame(step);
          })(start);
        });
      },
      { threshold: 0.5 }
    );
    statValues.forEach(function (el) {
      if (!reduceMotion && Number(el.dataset.count) > 0) el.textContent = "0";
      countObserver.observe(el);
    });
  }

  /* ---------- Pointer-tracked card tilt ---------- */
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  if (finePointer && !reduceMotion) {
    document.querySelectorAll(".project-card").forEach(function (card) {
      card.addEventListener("pointermove", function (event) {
        const rect = card.getBoundingClientRect();
        const x = (event.clientX - rect.left) / rect.width - 0.5;
        const y = (event.clientY - rect.top) / rect.height - 0.5;
        card.classList.add("is-tilting");
        card.style.setProperty("--ry", `${x * 6}deg`);
        card.style.setProperty("--rx", `${-y * 6}deg`);
      });
      card.addEventListener("pointerleave", function () {
        card.classList.remove("is-tilting");
        card.style.setProperty("--ry", "0deg");
        card.style.setProperty("--rx", "0deg");
      });
    });
  }
})();
