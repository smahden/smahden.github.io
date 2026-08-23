/**
 * Keyboard and ARIA tests.
 *
 * These drive the demo page in a real browser with real key presses and assert
 * focus position and ARIA state after each one — the behaviour a screen reader
 * would report. Unit-testing the classes in isolation would miss exactly the
 * bugs this catches.
 *
 *   npm test                    # uses the Playwright-managed Chromium
 *   PW_CHROMIUM=/path/to/chrome npm test
 */

import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const PAGE_URL = `file://${resolve(here, "..", "index.html")}`;

const { chromium } = await import("playwright").catch(() => import("playwright-core"));

let passed = 0;
const failures = [];

async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (error) {
    failures.push({ name, error });
    console.log(`  ✗ ${name}\n      ${error.message}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

const activeId = (page) => page.evaluate(() => document.activeElement.id || "");
const activeText = (page) => page.evaluate(() => document.activeElement.textContent.trim());

const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM || undefined,
  args: ["--no-sandbox"],
});
const page = await browser.newPage();
const pageErrors = [];
page.on("pageerror", (error) => pageErrors.push(String(error)));
await page.goto(PAGE_URL);

console.log("\nTabs");
await test("first tab is selected on load", async () => {
  assertEqual(await page.getAttribute(".uikit-tab:nth-child(1)", "aria-selected"), "true", "first tab");
  assertEqual(await page.getAttribute(".uikit-tab:nth-child(2)", "aria-selected"), "false", "second tab");
});

await test("only the selected tab is in the tab order", async () => {
  const indexes = await page.$$eval(".uikit-tab", (tabs) => tabs.map((t) => t.tabIndex));
  assertEqual(JSON.stringify(indexes), JSON.stringify([0, -1, -1]), "roving tabindex");
});

await test("ArrowRight selects and focuses the next tab", async () => {
  await page.focus(".uikit-tab:nth-child(1)");
  await page.keyboard.press("ArrowRight");
  assertEqual(await activeText(page), "Keyboard", "focused tab");
  assertEqual(await page.getAttribute(".uikit-tab:nth-child(2)", "aria-selected"), "true", "selection");
});

await test("ArrowLeft from the first tab wraps to the last", async () => {
  await page.focus(".uikit-tab:nth-child(1)");
  await page.keyboard.press("ArrowLeft");
  assertEqual(await activeText(page), "Screen readers", "wrapped focus");
});

await test("Home and End jump to the ends", async () => {
  await page.keyboard.press("Home");
  assertEqual(await activeText(page), "Overview", "Home");
  await page.keyboard.press("End");
  assertEqual(await activeText(page), "Screen readers", "End");
});

await test("selecting a tab shows only its panel", async () => {
  await page.keyboard.press("Home");
  const hidden = await page.$$eval(".uikit-panel", (panels) => panels.map((p) => p.hidden));
  assertEqual(JSON.stringify(hidden), JSON.stringify([false, true, true]), "panel visibility");
});

console.log("\nModal");
await test("opening moves focus into the dialog", async () => {
  await page.click("[data-uikit-open='confirm-modal']");
  assert(await page.isVisible("#confirm-modal"), "dialog should be visible");
  assertEqual(await activeText(page), "Cancel", "focus lands on first control");
});

await test("dialog exposes role and aria-modal", async () => {
  assertEqual(await page.getAttribute("#confirm-modal", "role"), "dialog", "role");
  assertEqual(await page.getAttribute("#confirm-modal", "aria-modal"), "true", "aria-modal");
});

await test("Tab wraps forward at the end of the dialog", async () => {
  await page.keyboard.press("Tab"); // Cancel -> Yes, delete
  assertEqual(await activeId(page), "confirm-delete", "second control");
  await page.keyboard.press("Tab"); // wraps back to the first
  assertEqual(await activeText(page), "Cancel", "focus wrapped to start");
});

await test("Shift+Tab wraps backward", async () => {
  await page.keyboard.press("Shift+Tab");
  assertEqual(await activeId(page), "confirm-delete", "focus wrapped to end");
});

await test("Escape closes and restores focus to the trigger", async () => {
  await page.keyboard.press("Escape");
  assert(await page.isHidden("#confirm-modal"), "dialog should be hidden");
  assertEqual(await activeText(page), "Delete account…", "focus returned to trigger");
});

console.log("\nAccordion");
await test("panels start collapsed", async () => {
  const expanded = await page.$$eval(".uikit-accordion-trigger", (els) =>
    els.map((el) => el.getAttribute("aria-expanded"))
  );
  assert(expanded.every((value) => value === "false"), "all collapsed");
});

await test("Enter on a trigger expands its panel", async () => {
  await page.focus(".uikit-accordion-trigger:nth-of-type(1)");
  await page.keyboard.press("Enter");
  assertEqual(
    await page.getAttribute(".uikit-accordion-item:nth-child(1) .uikit-accordion-trigger", "aria-expanded"),
    "true",
    "aria-expanded"
  );
  assert(
    await page.isVisible(".uikit-accordion-item:nth-child(1) .uikit-accordion-panel"),
    "panel visible"
  );
});

await test("single mode closes the previously open panel", async () => {
  await page.click(".uikit-accordion-item:nth-child(2) .uikit-accordion-trigger");
  assertEqual(
    await page.getAttribute(".uikit-accordion-item:nth-child(1) .uikit-accordion-trigger", "aria-expanded"),
    "false",
    "first panel closed"
  );
});

console.log("\nCombobox");
await test("typing filters the options and expands the listbox", async () => {
  await page.click("#framework");
  await page.type("#framework", "s");
  assertEqual(await page.getAttribute("#framework", "aria-expanded"), "true", "expanded");
  const visible = await page.$$eval(".uikit-listbox li", (items) =>
    items.filter((li) => !li.hidden).map((li) => li.textContent.trim())
  );
  assert(visible.includes("JavaScript") && visible.includes("TypeScript"), "matches shown");
  assert(!visible.includes("Docker"), "non-matches hidden");
});

await test("ArrowDown highlights via aria-activedescendant, focus stays in the input", async () => {
  await page.keyboard.press("ArrowDown");
  assertEqual(await activeId(page), "framework", "focus stays in input");
  const active = await page.getAttribute("#framework", "aria-activedescendant");
  assert(active, "aria-activedescendant is set");
  const highlighted = await page.$eval(".uikit-listbox li.is-active", (el) => el.id);
  assertEqual(active, highlighted, "points at the highlighted option");
});

await test("Enter selects the highlighted option", async () => {
  await page.keyboard.press("Enter");
  const value = await page.inputValue("#framework");
  assert(value.length > 0, "input has a value");
  assertEqual(await page.getAttribute("#framework", "aria-expanded"), "false", "listbox closed");
  assertEqual(
    await page.$eval(".uikit-listbox li[aria-selected='true']", (el) => el.textContent.trim()),
    value,
    "selected option matches the value"
  );
});

await test("Escape closes the listbox", async () => {
  await page.fill("#framework", "");
  await page.type("#framework", "p");
  await page.keyboard.press("Escape");
  assertEqual(await page.getAttribute("#framework", "aria-expanded"), "false", "closed");
});

console.log("\nForm validation");
await test("submitting empty marks fields invalid and focuses the first", async () => {
  await page.fill("#framework", "");
  await page.click("#signup button[type='submit']");
  assertEqual(await page.getAttribute("#name", "aria-invalid"), "true", "name invalid");
  assertEqual(await activeId(page), "name", "focus on first invalid field");
});

await test("errors are wired through aria-describedby", async () => {
  const describedBy = await page.getAttribute("#name", "aria-describedby");
  assert(describedBy, "aria-describedby present");
  const message = await page.$eval(`#${describedBy}`, (el) => el.textContent.trim());
  assertEqual(message, "This field is required.", "error text");
});

await test("a bad email is rejected, a good one is accepted", async () => {
  await page.fill("#name", "Mahden");
  await page.fill("#email", "not-an-email");
  await page.click("#signup button[type='submit']");
  assertEqual(await page.getAttribute("#email", "aria-invalid"), "true", "rejected");
  await page.fill("#email", "mahden@example.com");
  await page.click("#signup button[type='submit']");
  assertEqual(await page.getAttribute("#email", "aria-invalid"), "false", "accepted");
});

await test("minlength is enforced on the password", async () => {
  await page.fill("#password", "short");
  await page.click("#signup button[type='submit']");
  const describedBy = await page.getAttribute("#password", "aria-describedby");
  assertEqual(
    await page.$eval(`#${describedBy}`, (el) => el.textContent.trim()),
    "Use at least 8 characters.",
    "minlength message"
  );
});

await test("a valid form emits uikit:valid", async () => {
  await page.fill("#password", "a-long-enough-password");
  const fired = page.evaluate(
    () => new Promise((r) => document.getElementById("signup").addEventListener("uikit:valid", () => r(true), { once: true }))
  );
  await page.click("#signup button[type='submit']");
  assertEqual(await fired, true, "uikit:valid fired");
});

console.log("\nToasts and theme");
await test("a toast appears inside a polite live region", async () => {
  // The valid-form submission above raised its own toast; start from empty.
  await page.evaluate(() => {
    document.querySelectorAll(".uikit-toast").forEach((el) => el.remove());
  });
  await page.click("#toast-success");
  const region = await page.$("[data-uikit-toasts]");
  assertEqual(await region.getAttribute("aria-live"), "polite", "aria-live");
  assertEqual(await page.locator(".uikit-toast").count(), 1, "one toast");
});

await test("a toast can be dismissed by its labelled button", async () => {
  await page.click(".uikit-toast-close");
  assertEqual(await page.locator(".uikit-toast").count(), 0, "toast removed");
});

await test("theme toggle flips data-theme and aria-pressed", async () => {
  const before = await page.getAttribute("html", "data-theme");
  await page.click("#theme");
  const after = await page.getAttribute("html", "data-theme");
  assert(before !== after, "theme changed");
  assertEqual(await page.getAttribute("#theme", "aria-pressed"), after === "dark" ? "true" : "false", "aria-pressed");
});

console.log("\nPage health");
await test("no uncaught JavaScript errors during the run", async () => {
  assertEqual(JSON.stringify(pageErrors), "[]", "page errors");
});

await browser.close();

console.log(`\n${passed} passed, ${failures.length} failed\n`);
process.exit(failures.length === 0 ? 0 : 1);
