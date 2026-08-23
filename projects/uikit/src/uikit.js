/**
 * UIKit — accessible UI components in plain JavaScript.
 *
 * Every component is keyboard-operable and announces its state to assistive
 * technology. Components auto-initialize from `data-uikit` attributes, or can
 * be constructed directly: `new UIKit.Modal(element)`.
 */
(function (global) {
  "use strict";

  const FOCUSABLE = [
    "a[href]",
    "button:not([disabled])",
    "input:not([disabled]):not([type='hidden'])",
    "select:not([disabled])",
    "textarea:not([disabled])",
    "[tabindex]:not([tabindex='-1'])",
  ].join(",");

  function focusableWithin(root) {
    return [...root.querySelectorAll(FOCUSABLE)].filter(
      (el) => el.offsetWidth > 0 || el.offsetHeight > 0 || el === document.activeElement
    );
  }

  let idCounter = 0;
  const uniqueId = (prefix) => `${prefix}-${++idCounter}`;

  /* ==================================================================== Modal */

  class Modal {
    constructor(dialog) {
      this.dialog = dialog;
      this.previouslyFocused = null;
      this.onKeydown = this.onKeydown.bind(this);

      dialog.setAttribute("role", "dialog");
      dialog.setAttribute("aria-modal", "true");
      dialog.hidden = true;

      dialog.querySelectorAll("[data-uikit-close]").forEach((button) => {
        button.addEventListener("click", () => this.close());
      });
      // Clicking the backdrop (the dialog's own padding area) closes it.
      dialog.addEventListener("mousedown", (event) => {
        if (event.target === dialog) this.close();
      });
    }

    get isOpen() {
      return !this.dialog.hidden;
    }

    open() {
      if (this.isOpen) return;
      this.previouslyFocused = document.activeElement;
      this.dialog.hidden = false;
      document.body.style.overflow = "hidden";
      document.addEventListener("keydown", this.onKeydown, true);

      // Focus the first control, or the dialog itself if it has none.
      const target = focusableWithin(this.dialog)[0] || this.dialog;
      if (target === this.dialog) this.dialog.tabIndex = -1;
      target.focus();
      this.dialog.dispatchEvent(new CustomEvent("uikit:open", { bubbles: true }));
    }

    close() {
      if (!this.isOpen) return;
      this.dialog.hidden = true;
      document.body.style.overflow = "";
      document.removeEventListener("keydown", this.onKeydown, true);
      // Returning focus to the trigger is what makes a modal usable by keyboard.
      if (this.previouslyFocused && this.previouslyFocused.focus) {
        this.previouslyFocused.focus();
      }
      this.dialog.dispatchEvent(new CustomEvent("uikit:close", { bubbles: true }));
    }

    onKeydown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        this.close();
        return;
      }
      if (event.key !== "Tab") return;

      // Focus trap: wrap at both ends so Tab never escapes the dialog.
      const focusable = focusableWithin(this.dialog);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && (active === first || !this.dialog.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }
  }

  /* =================================================================== Tabs */

  class Tabs {
    constructor(root) {
      this.root = root;
      this.list = root.querySelector("[role='tablist']") || root.querySelector(".tabs-list");
      this.tabs = [...root.querySelectorAll("[data-uikit-tab]")];
      this.panels = [...root.querySelectorAll("[data-uikit-panel]")];

      if (this.list) this.list.setAttribute("role", "tablist");
      this.tabs.forEach((tab, index) => {
        const panel = this.panels[index];
        tab.id = tab.id || uniqueId("tab");
        panel.id = panel.id || uniqueId("panel");
        tab.setAttribute("role", "tab");
        tab.setAttribute("aria-controls", panel.id);
        panel.setAttribute("role", "tabpanel");
        panel.setAttribute("aria-labelledby", tab.id);
        panel.tabIndex = 0;

        tab.addEventListener("click", () => this.select(index));
        tab.addEventListener("keydown", (event) => this.onKeydown(event, index));
      });

      this.select(Math.max(0, this.tabs.findIndex((tab) => tab.dataset.uikitTab === "selected")));
    }

    select(index) {
      this.tabs.forEach((tab, i) => {
        const selected = i === index;
        tab.setAttribute("aria-selected", String(selected));
        // Roving tabindex: only the selected tab is in the tab order, so Tab
        // moves past the whole tablist instead of through every tab.
        tab.tabIndex = selected ? 0 : -1;
        this.panels[i].hidden = !selected;
      });
      this.selectedIndex = index;
      this.root.dispatchEvent(
        new CustomEvent("uikit:tabchange", { bubbles: true, detail: { index } })
      );
    }

    onKeydown(event, index) {
      const last = this.tabs.length - 1;
      const moves = {
        ArrowRight: index === last ? 0 : index + 1,
        ArrowLeft: index === 0 ? last : index - 1,
        Home: 0,
        End: last,
      };
      const next = moves[event.key];
      if (next === undefined) return;
      event.preventDefault();
      this.select(next);
      this.tabs[next].focus();
    }
  }

  /* ============================================================== Accordion */

  class Accordion {
    constructor(root) {
      this.root = root;
      this.single = root.dataset.uikitSingle === "true";
      this.items = [...root.querySelectorAll("[data-uikit-accordion-item]")].map((item) => {
        const trigger = item.querySelector("[data-uikit-accordion-trigger]");
        const panel = item.querySelector("[data-uikit-accordion-panel]");
        panel.id = panel.id || uniqueId("acc-panel");
        trigger.id = trigger.id || uniqueId("acc-trigger");
        trigger.setAttribute("aria-controls", panel.id);
        trigger.setAttribute("aria-expanded", "false");
        panel.setAttribute("role", "region");
        panel.setAttribute("aria-labelledby", trigger.id);
        panel.hidden = true;
        trigger.addEventListener("click", () => this.toggle(trigger, panel));
        return { trigger, panel };
      });
    }

    toggle(trigger, panel) {
      const willOpen = trigger.getAttribute("aria-expanded") !== "true";
      if (willOpen && this.single) {
        this.items.forEach(({ trigger: other, panel: otherPanel }) => {
          other.setAttribute("aria-expanded", "false");
          otherPanel.hidden = true;
        });
      }
      trigger.setAttribute("aria-expanded", String(willOpen));
      panel.hidden = !willOpen;
    }
  }

  /* =============================================================== Combobox */

  class Combobox {
    constructor(root) {
      this.root = root;
      this.input = root.querySelector("input");
      this.listbox = root.querySelector("[role='listbox'], [data-uikit-listbox]");
      this.options = [...this.listbox.querySelectorAll("li")];
      this.activeIndex = -1;

      this.listbox.setAttribute("role", "listbox");
      this.listbox.id = this.listbox.id || uniqueId("listbox");
      this.listbox.hidden = true;
      this.input.setAttribute("role", "combobox");
      this.input.setAttribute("aria-expanded", "false");
      this.input.setAttribute("aria-controls", this.listbox.id);
      this.input.setAttribute("aria-autocomplete", "list");
      this.input.autocomplete = "off";

      this.options.forEach((option, index) => {
        option.id = option.id || uniqueId("option");
        option.setAttribute("role", "option");
        option.setAttribute("aria-selected", "false");
        option.addEventListener("mousedown", (event) => {
          event.preventDefault(); // keep focus in the input
          this.choose(index);
        });
      });

      this.input.addEventListener("input", () => this.filter());
      this.input.addEventListener("keydown", (event) => this.onKeydown(event));
      this.input.addEventListener("blur", () => this.collapse());
    }

    get visibleOptions() {
      return this.options.filter((option) => !option.hidden);
    }

    filter() {
      const query = this.input.value.trim().toLowerCase();
      this.options.forEach((option) => {
        option.hidden = Boolean(query) && !option.textContent.toLowerCase().includes(query);
      });
      const hasMatches = this.visibleOptions.length > 0;
      this.expand(hasMatches);
      this.setActive(hasMatches ? 0 : -1);
    }

    expand(open) {
      this.listbox.hidden = !open;
      this.input.setAttribute("aria-expanded", String(open));
    }

    collapse() {
      this.expand(false);
      this.setActive(-1);
    }

    setActive(index) {
      const visible = this.visibleOptions;
      this.options.forEach((option) => option.classList.remove("is-active"));
      if (index < 0 || index >= visible.length) {
        this.activeIndex = -1;
        this.input.removeAttribute("aria-activedescendant");
        return;
      }
      this.activeIndex = index;
      const option = visible[index];
      option.classList.add("is-active");
      // aria-activedescendant keeps DOM focus in the input while screen
      // readers announce the highlighted option.
      this.input.setAttribute("aria-activedescendant", option.id);
      option.scrollIntoView({ block: "nearest" });
    }

    choose(index) {
      const option = this.options[index] || this.visibleOptions[index];
      if (!option) return;
      this.options.forEach((o) => o.setAttribute("aria-selected", "false"));
      option.setAttribute("aria-selected", "true");
      this.input.value = option.textContent.trim();
      this.options.forEach((o) => (o.hidden = false));
      this.collapse();
      this.root.dispatchEvent(
        new CustomEvent("uikit:select", { bubbles: true, detail: { value: this.input.value } })
      );
    }

    onKeydown(event) {
      const visible = this.visibleOptions;
      switch (event.key) {
        case "ArrowDown":
          event.preventDefault();
          if (this.listbox.hidden) this.filter();
          else this.setActive(Math.min(this.activeIndex + 1, visible.length - 1));
          break;
        case "ArrowUp":
          event.preventDefault();
          this.setActive(Math.max(this.activeIndex - 1, 0));
          break;
        case "Enter":
          if (!this.listbox.hidden && this.activeIndex >= 0) {
            event.preventDefault();
            this.choose(this.options.indexOf(visible[this.activeIndex]));
          }
          break;
        case "Escape":
          this.collapse();
          break;
        default:
          break;
      }
    }
  }

  /* ================================================================== Toast */

  const toastRegion = (() => {
    let region = null;
    return () => {
      if (region) return region;
      region = document.querySelector("[data-uikit-toasts]");
      if (!region) {
        region = document.createElement("div");
        region.setAttribute("data-uikit-toasts", "");
        document.body.appendChild(region);
      }
      region.className = "uikit-toasts";
      // Polite so a toast never interrupts what the user is currently reading.
      region.setAttribute("role", "status");
      region.setAttribute("aria-live", "polite");
      return region;
    };
  })();

  function toast(message, { variant = "info", duration = 4000 } = {}) {
    const region = toastRegion();
    const element = document.createElement("div");
    element.className = `uikit-toast uikit-toast--${variant}`;
    element.textContent = message;

    const dismiss = document.createElement("button");
    dismiss.type = "button";
    dismiss.className = "uikit-toast-close";
    dismiss.setAttribute("aria-label", "Dismiss notification");
    dismiss.textContent = "✕";
    dismiss.addEventListener("click", () => element.remove());
    element.appendChild(dismiss);

    region.appendChild(element);
    if (duration > 0) setTimeout(() => element.remove(), duration);
    return element;
  }

  /* ============================================================ Form fields */

  const VALIDATORS = {
    required: (value) => (value.trim() ? "" : "This field is required."),
    email: (value) => (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? "" : "Enter a valid email address."),
    minlength: (value, arg) =>
      value.length >= Number(arg) ? "" : `Use at least ${arg} characters.`,
  };

  function validateField(field) {
    const rules = (field.dataset.uikitValidate || "").split("|").filter(Boolean);
    const errorEl = document.getElementById(field.getAttribute("aria-describedby") || "");

    for (const rule of rules) {
      const [name, arg] = rule.split(":");
      const validate = VALIDATORS[name];
      if (!validate) continue;
      const message = validate(field.value, arg);
      if (message) {
        field.setAttribute("aria-invalid", "true");
        if (errorEl) errorEl.textContent = message;
        return false;
      }
    }
    field.setAttribute("aria-invalid", "false");
    if (errorEl) errorEl.textContent = "";
    return true;
  }

  function initForm(form) {
    const fields = [...form.querySelectorAll("[data-uikit-validate]")];
    fields.forEach((field) => {
      if (!field.getAttribute("aria-describedby")) {
        const error = document.createElement("p");
        error.className = "uikit-error";
        error.id = uniqueId("error");
        field.insertAdjacentElement("afterend", error);
        field.setAttribute("aria-describedby", error.id);
      }
      // Re-validate on blur, and live once a field is already marked invalid.
      field.addEventListener("blur", () => validateField(field));
      field.addEventListener("input", () => {
        if (field.getAttribute("aria-invalid") === "true") validateField(field);
      });
    });

    form.addEventListener("submit", (event) => {
      const results = fields.map(validateField);
      if (results.includes(false)) {
        event.preventDefault();
        // Send focus to the first problem so a keyboard user lands on it.
        fields[results.indexOf(false)].focus();
        return;
      }
      event.preventDefault();
      form.dispatchEvent(new CustomEvent("uikit:valid", { bubbles: true }));
    });
  }

  /* ================================================================= Theme */

  function initTheme(toggle) {
    const root = document.documentElement;
    let stored = null;
    try {
      stored = localStorage.getItem("uikit-theme");
    } catch {
      stored = null; // private mode or blocked storage — fall back to system
    }
    if (stored) root.setAttribute("data-theme", stored);

    const sync = () => {
      const dark =
        root.getAttribute("data-theme") === "dark" ||
        (!root.hasAttribute("data-theme") &&
          window.matchMedia("(prefers-color-scheme: dark)").matches);
      toggle.setAttribute("aria-pressed", String(dark));
    };

    toggle.addEventListener("click", () => {
      const next = toggle.getAttribute("aria-pressed") === "true" ? "light" : "dark";
      root.setAttribute("data-theme", next);
      try {
        localStorage.setItem("uikit-theme", next);
      } catch {
        /* storage unavailable — the theme still applies for this page view */
      }
      sync();
    });
    sync();
  }

  /* ================================================================== Init */

  const REGISTRY = {
    modal: (el) => new Modal(el),
    tabs: (el) => new Tabs(el),
    accordion: (el) => new Accordion(el),
    combobox: (el) => new Combobox(el),
    form: (el) => initForm(el),
    theme: (el) => initTheme(el),
  };

  function init(root = document) {
    const instances = new Map();
    root.querySelectorAll("[data-uikit]").forEach((element) => {
      const factory = REGISTRY[element.dataset.uikit];
      if (!factory) return;
      const instance = factory(element);
      if (element.id) instances.set(element.id, instance);
    });

    // Wire any button that points at a modal by id.
    root.querySelectorAll("[data-uikit-open]").forEach((trigger) => {
      const modal = instances.get(trigger.dataset.uikitOpen);
      if (modal) trigger.addEventListener("click", () => modal.open());
    });

    return instances;
  }

  global.UIKit = { Modal, Tabs, Accordion, Combobox, toast, initForm, initTheme, init, validateField };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => init());
  } else {
    init();
  }
})(window);
