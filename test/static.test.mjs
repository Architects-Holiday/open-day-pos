import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const load = (name) => readFile(new URL(name, root), "utf8");

test("PWA shell exposes clear Bar and Merch station modes", async () => {
  const html = await load("index.html");
  assert.match(html, /data-shop="bar"/);
  assert.match(html, /data-shop="merch"/);
  assert.doesNotMatch(html, /Local till|Stored on this iPad|Stock and sales are stored on this iPad only/);
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

test("catalogue visually groups products and separates supplier from serving format", async () => {
  const [html, app, css] = await Promise.all([load("index.html"), load("app.js"), load("styles.css")]);
  assert.match(html, /class="product-groups" id="products"/);
  for (const title of ["Beer", "Wine", "Sparkling", "Non-alcoholic", "Soft drinks", "Water", "T-shirts"]) assert.match(app, new RegExp('title: "' + title));
  assert.match(app, /product-supplier/);
  assert.match(app, /product-serving/);
  assert.match(app, /125\|175/);
  assert.match(css, /\.product-group-header h3/);
  assert.match(css, /\.product-supplier/);
  assert.match(css, /\.product-serving/);
  assert.match(css, /--group-accent-rgb/);
});

test("founder layout refinement keeps the selector compact and predictable", async () => {
  const [html, app, css] = await Promise.all([load("index.html"), load("app.js"), load("styles.css")]);
  assert.doesNotMatch(html, /Tap products to build the order|Use S710|on the S710/);
  assert.match(html, /Add products, then take payment on Stripe Reader/);
  assert.match(html, /on the Stripe Card Reader/);
  assert.match(app, /merch: Object\.freeze\(\[\s*\{ key: "caps-bags"[\s\S]*\{ key: "small-goods"[\s\S]*\{ key: "t-shirts"/);
  assert.match(app, /"merch-tote": 0, "merch-cap": 1/);
  assert.match(app, /bar-tilsmore-rose-bottle/);
  assert.match(css, /\.product-grid \{[\s\S]*grid-template-columns: repeat\(3/);
  assert.match(css, /@media \(max-width: 1180px\)[\s\S]*?\.product-grid \{\s*grid-template-columns: repeat\(3/);
  assert.match(css, /@media \(max-width: 700px\)[\s\S]*?\.product-grid \{\s*grid-template-columns: repeat\(2/);
  assert.match(css, /\.product-row-break \{\s*grid-column-start: 1/);
  assert.match(css, /\.shop-switch button \{[\s\S]*border: 1px solid rgba/);
  assert.match(css, /\.shop-switch button\[aria-pressed="true"\]/);
});

test("offline assets and install manifest are present", async () => {
  const [manifest, worker] = await Promise.all([load("manifest.webmanifest"), load("sw.js")]);
  assert.equal(JSON.parse(manifest).display, "standalone");
  for (const asset of ["index.html", "styles.css", "app.js", "pos-domain.js", "storage.js", "architects-holiday-wordmark-white.svg"]) assert.ok(worker.includes(asset));
});
