import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const load = (name) => readFile(new URL(name, root), "utf8");

test("PWA shell exposes clear Bar and Merch station modes", async () => {
  const html = await load("index.html");
  assert.match(html, /data-shop="bar"/);
  assert.match(html, /data-shop="merch"/);
  assert.match(html, /Stock and sales are stored on this iPad only/);
  assert.match(html, /Payment approved/);
  assert.match(html, /id="undoBasket"/);
});

test("reports view is read-only, device-scoped, and exposes the requested summary breakdowns", async () => {
  const [html, app, domain] = await Promise.all([load("index.html"), load("app.js"), load("pos-domain.js")]);
  for (const id of ["reportRevenue", "reportUnits", "reportProducts", "reportTransactions", "reportAverage", "reportShopBreakdown", "reportCategoryBreakdown", "reportProductRows"]) {
    assert.match(html, new RegExp('id="' + id + '"'));
  }
  assert.match(html, /data-view="reports"/);
  assert.match(html, /Add the totals from both iPads for the complete event/);
  assert.match(app, /salesReport\(state\)/);
  assert.match(domain, /source: "THIS_IPAD_ONLY"/);
  assert.doesNotMatch(app, /report.*completeApprovedSale|report.*countStock/i);
});

test("S710 remains a manual approval boundary", async () => {
  const [html, app, domain] = await Promise.all([load("index.html"), load("app.js"), load("pos-domain.js")]);
  assert.match(html, /This iPad cannot see the reader/);
  assert.match(app, /staffConfirmedApproved: true/);
  assert.match(domain, /STAFF_CONFIRMED_APPROVED/);
  assert.doesNotMatch(app + domain, /api_key|client_secret|paymentIntent|Stripe\(/i);
});

test("app has no guest data, provider calls, or external script dependencies", async () => {
  const [html, app, storage] = await Promise.all([load("index.html"), load("app.js"), load("storage.js")]);
  assert.doesNotMatch(html, /<script[^>]+https?:/i);
  assert.doesNotMatch(app + storage, /guestName|email|phone|reservationId|cabinId/);
  assert.doesNotMatch(app, /\bfetch\s*\(/);
});

test("interface uses the Lobby Host Calm UI and only the supplied AH wordmark", async () => {
  const [html, css, wordmark] = await Promise.all([
    load("index.html"),
    load("styles.css"),
    load("assets/architects-holiday-wordmark-white.svg")
  ]);
  for (const colour of ["#17192f", "#432951", "#a8e4ee", "#82d8c7"]) assert.match(css, new RegExp(colour));
  for (const legacyAhColour of ["#151712", "#f0ede4", "#3b4435", "#b08a61"]) assert.doesNotMatch(css, new RegExp(legacyAhColour));
  assert.match(css, /linear-gradient/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(html, /assets\/architects-holiday-wordmark-white\.svg/);
  assert.doesNotMatch(html, /class="wordmark"/);
  assert.match(wordmark, /ARCHITECTS HOLIDAY/);
});

test("weekend catalogue includes priced bar, wine serving, and merchandise products", async () => {
  const catalog = await load("catalog.js");
  assert.match(catalog, /Stir Hazy NEIPA/);
  assert.match(catalog, /serveMl: 175/);
  assert.match(catalog, /pricePence: 250, openingStock: 30/);
  assert.match(catalog, /inventoryId: id\.replace/);
});

test("offline assets and install manifest are present", async () => {
  const [manifest, worker] = await Promise.all([load("manifest.webmanifest"), load("sw.js")]);
  assert.equal(JSON.parse(manifest).display, "standalone");
  for (const asset of ["index.html", "styles.css", "app.js", "pos-domain.js", "storage.js", "architects-holiday-wordmark-white.svg"]) assert.ok(worker.includes(asset));
});
