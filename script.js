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
