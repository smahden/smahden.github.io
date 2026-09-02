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
    // Ease the colour change instead of snapping between palettes.
    document.body.classList.add("theme-transition");
    setTimeout(() => document.body.classList.remove("theme-transition"), 500);
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
  // Live setting: the toggle can flip it at any time, so read it per call
  // rather than capturing a boolean at load.
  const motionOn = () => root.getAttribute("data-motion") !== "off";
  const finePointer = () => window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  let typing = false;

  function startTyping() {
    if (!typedEl || typing) return;
    typing = true;
    let wordIndex = 0;
    let charIndex = words[0].length;
    let deleting = true;

    function tick() {
      if (!motionOn()) {
        // Settle on a whole word instead of freezing mid-deletion.
        typedEl.textContent = words[wordIndex];
        typing = false;
        return;
      }
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

  if (motionOn()) startTyping();

  /* ---------- Motion toggle ---------- */
  const motionToggle = document.getElementById("motion-toggle");

  if (motionToggle) {
    motionToggle.setAttribute("aria-pressed", String(motionOn()));
    motionToggle.addEventListener("click", function () {
      const next = motionOn() ? "off" : "on";
      root.setAttribute("data-motion", next);
      motionToggle.setAttribute("aria-pressed", String(next === "on"));
      try {
        localStorage.setItem("motion", next);
      } catch {
        /* storage blocked; the choice still applies to this page view */
      }
      if (next === "on") startTyping();
    });
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
        if (match) {
          if (fromUser && motionOn()) {
            // Restart the entrance animation, staggered by position.
            card.classList.remove("is-entering");
            void card.offsetWidth; // reflow, so the animation replays
            card.style.animationDelay = `${Math.min(shown, 8) * 45}ms`;
            card.classList.add("is-entering");
          }
          shown++;
        }
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

  // Direction variants so different sections enter differently.
  document.querySelectorAll(".about-text").forEach((el) => el.classList.add("reveal", "reveal-left"));
  document.querySelectorAll(".about-facts").forEach((el) => el.classList.add("reveal", "reveal-right"));
  document.querySelectorAll(".project-card, .cert-card").forEach((el) => el.classList.add("reveal-scale"));

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

  /* ---------- Frame-smoothed pointer motion ----------
     Pointer events fire faster than the screen refreshes, and writing the raw
     value each time makes the movement twitch. Each effect stores a target and
     one animation loop eases the rendered value toward it, so motion glides.  */

  const lerp = (from, to, amount) => from + (to - from) * amount;

  function smoothPointer(element, options) {
    const target = { x: 0, y: 0 };
    const current = { x: 0, y: 0 };
    const apply = options.apply;
    const ease = options.ease || 0.12;
    let running = false;

    function frame() {
      current.x = lerp(current.x, target.x, ease);
      current.y = lerp(current.y, target.y, ease);
      apply(current.x, current.y);

      // Stop the loop once it has effectively settled, to save battery.
      if (Math.abs(current.x - target.x) > 0.0005 || Math.abs(current.y - target.y) > 0.0005) {
        requestAnimationFrame(frame);
      } else {
        apply(target.x, target.y);
        running = false;
      }
    }

    function start() {
      if (running) return;
      running = true;
      requestAnimationFrame(frame);
    }

    element.addEventListener("pointermove", function (event) {
      if (!motionOn() || !finePointer()) return;
      const rect = element.getBoundingClientRect();
      target.x = (event.clientX - rect.left) / rect.width - 0.5;
      target.y = (event.clientY - rect.top) / rect.height - 0.5;
      if (options.onMove) options.onMove(target.x + 0.5, target.y + 0.5);
      start();
    });

    element.addEventListener("pointerleave", function () {
      target.x = 0;
      target.y = 0;
      if (options.onLeave) options.onLeave();
      start();
    });
  }

  /* Hero aurora and code window lean toward the pointer. */
  const hero = document.querySelector(".hero");
  if (hero) {
    smoothPointer(hero, {
      ease: 0.09,
      apply(x, y) {
        hero.style.setProperty("--mx", x.toFixed(4));
        hero.style.setProperty("--my", y.toFixed(4));
      },
    });
  }

  /* Project cards tilt, and light up where the cursor is. */
  document.querySelectorAll(".project-card").forEach(function (card) {
    smoothPointer(card, {
      ease: 0.16,
      apply(x, y) {
        card.style.setProperty("--ry", `${(x * 18).toFixed(2)}deg`);
        card.style.setProperty("--rx", `${(-y * 18).toFixed(2)}deg`);
      },
      onMove(px, py) {
        card.classList.add("is-tilting");
        card.style.setProperty("--px", `${(px * 100).toFixed(1)}%`);
        card.style.setProperty("--py", `${(py * 100).toFixed(1)}%`);
      },
      onLeave() {
        card.classList.remove("is-tilting");
      },
    });
  });

  /* Buttons drift a few pixels toward the cursor. */
  document.querySelectorAll(".btn").forEach(function (button) {
    smoothPointer(button, {
      ease: 0.2,
      apply(x, y) {
        button.style.setProperty("--pull-x", (x * 12).toFixed(2));
        button.style.setProperty("--pull-y", (y * 10).toFixed(2));
      },
    });
  });

  /* ---------- Eased anchor scrolling ---------- */
  const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  function scrollToY(destination, duration) {
    const startY = window.scrollY;
    const distance = destination - startY;
    if (Math.abs(distance) < 2) return;
    const startTime = performance.now();

    (function step(now) {
      const t = Math.min(1, (now - startTime) / duration);
      // `instant` keeps the browser from also animating each step.
      window.scrollTo({ top: startY + distance * easeInOutCubic(t), behavior: "instant" });
      if (t < 1) requestAnimationFrame(step);
    })(startTime);
  }

  document.addEventListener("click", function (event) {
    const link = event.target.closest('a[href^="#"]');
    if (!link || link.classList.contains("skip-link")) return;

    const id = link.getAttribute("href");
    if (id === "#" || id.length < 2) return;
    const destination = document.querySelector(id);
    if (!destination) return;

    event.preventDefault();
    const navHeight = document.querySelector(".nav").offsetHeight;
    const top = destination.getBoundingClientRect().top + window.scrollY - navHeight - 14;

    if (motionOn()) scrollToY(top, 750);
    else window.scrollTo({ top, behavior: "instant" });

    // Keep the keyboard in step with the eye.
    destination.setAttribute("tabindex", "-1");
    destination.focus({ preventScroll: true });
    history.replaceState(null, "", id);
  });

  /* ---------- Click ripple ---------- */
  document.addEventListener("pointerdown", function (event) {
    if (!motionOn()) return;
    const control = event.target.closest(".btn, .filter, .back-to-top");
    if (!control) return;

    const rect = control.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const ripple = document.createElement("span");
    ripple.className = "ripple";
    ripple.style.width = ripple.style.height = `${size}px`;
    ripple.style.left = `${event.clientX - rect.left - size / 2}px`;
    ripple.style.top = `${event.clientY - rect.top - size / 2}px`;
    control.appendChild(ripple);
    ripple.addEventListener("animationend", () => ripple.remove());
  });

  /* ---------- Nav hides going down, returns going up ---------- */
  const nav = document.querySelector(".nav");
  let lastY = window.scrollY;

  /* ---------- Timeline draws itself once in view ---------- */
  const timeline = document.querySelector(".timeline");
  if (timeline) {
    new IntersectionObserver(
      function (entries, self) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-drawn");
          self.unobserve(entry.target);
        });
      },
      { threshold: 0.05 }
    ).observe(timeline);
  }

  /* ---------- Scroll-driven chrome ---------- */
  const progressBar = document.getElementById("scroll-progress-bar");
  const backToTop = document.getElementById("back-to-top");
  let ticking = false;

  function onScroll() {
    const scrollable = document.documentElement.scrollHeight - window.innerHeight;
    const y = window.scrollY;
    const ratio = scrollable > 0 ? Math.min(1, Math.max(0, y / scrollable)) : 0;

    if (progressBar) progressBar.style.transform = `scaleX(${ratio})`;

    if (backToTop) {
      const show = y > window.innerHeight * 0.6;
      backToTop.hidden = !show;
      backToTop.classList.toggle("is-visible", show);
      backToTop.style.setProperty("--scroll-progress", ratio);
    }

    if (nav) {
      nav.classList.toggle("is-scrolled", y > 20);
      // Hide only when moving down, past the hero, and not mid-menu.
      const goingDown = y > lastY + 4;
      const menuOpen = navLinks.classList.contains("open");
      if (y > window.innerHeight * 0.8 && !menuOpen) {
        nav.classList.toggle("is-hidden", goingDown);
      } else {
        nav.classList.remove("is-hidden");
      }
    }
    lastY = y;
    ticking = false;
  }

  window.addEventListener(
    "scroll",
    function () {
      // rAF-throttled: at most one recalculation per frame.
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
      window.scrollTo({ top: 0, behavior: !motionOn() ? "auto" : "smooth" });
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
          const done = () => entry.target.closest(".stat").classList.add("is-done");

          if (!motionOn() || target === 0) {
            entry.target.textContent = String(target);
            done();
            return;
          }

          const duration = 1100;
          const start = performance.now();
          (function step(now) {
            const t = Math.min(1, (now - start) / duration);
            // Ease-out cubic, so the number decelerates into place.
            entry.target.textContent = String(Math.round(target * (1 - Math.pow(1 - t, 3))));
            if (t < 1) requestAnimationFrame(step);
            else done();
          })(start);
        });
      },
      { threshold: 0.5 }
    );
    statValues.forEach(function (el) {
      if (motionOn() && Number(el.dataset.count) > 0) el.textContent = "0";
      countObserver.observe(el);
    });
  }

})();
