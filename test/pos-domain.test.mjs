import test from "node:test";
import assert from "node:assert/strict";
import {
  availableForProduct,
  basketSummary,
  changeBasketQuantity,
  completeApprovedSale,
  countStock,
  createInitialState,
  replaceBasket,
  salesReport,
  salesCsv,
  saveProduct
} from "../pos-domain.js";

const NOW = "2026-08-19T12:00:00Z";
const CATALOG = [
  { id: "bar-beer", sku: "BAR-BEER", shop: "bar", name: "Beer", detail: "Test", reportCategory: "Beer", pricePence: 600, openingStock: 4, unit: "can", lowStockAt: 1, active: true },
  { id: "merch-shirt", sku: "MERCH-SHIRT", shop: "merch", name: "Shirt", detail: "M", reportCategory: "Apparel", pricePence: 2500, openingStock: 2, unit: "item", lowStockAt: 1, active: true }
];

function initial() {
  return createInitialState({ catalog: CATALOG, deviceId: "ipad-test", createdAt: NOW });
}

test("bar and merch baskets stay separate", () => {
  let state = initial();
  state = changeBasketQuantity(state, "bar", "bar-beer", 1);
  state = changeBasketQuantity(state, "merch", "merch-shirt", 1);
  assert.equal(basketSummary(state, "bar").totalPence, 600);
  assert.equal(basketSummary(state, "merch").totalPence, 2500);
});

test("stock cannot be oversold in a basket", () => {
  const state = initial();
  assert.throws(() => changeBasketQuantity(state, "bar", "bar-beer", 5), /not enough estimated stock/);
  assert.equal(state.inventory["bar-beer"], 4);
});

test("sale requires explicit S710 approval and then records stock movement", () => {
  let state = changeBasketQuantity(initial(), "bar", "bar-beer", 2);
  assert.throws(() => completeApprovedSale(state, {
    shop: "bar", saleId: "sale-1", occurredAt: NOW, staffConfirmedApproved: false
  }), /confirm/);
  state = completeApprovedSale(state, {
    shop: "bar", saleId: "sale-1", occurredAt: NOW, staffConfirmedApproved: true
  });
  assert.equal(state.inventory["bar-beer"], 2);
  assert.equal(state.sales.length, 1);
  assert.equal(state.sales[0].totalPence, 1200);
  assert.equal(state.sales[0].payment.evidence, "STAFF_CONFIRMED_APPROVED");
  assert.equal(state.baskets.bar.length, 0);
  assert.equal(state.movements.at(-1).kind, "SALE_CONSUMED");
});

test("products without prices cannot be completed", () => {
  const catalog = [{ ...CATALOG[0], pricePence: null }];
  let state = createInitialState({ catalog, deviceId: "ipad-test", createdAt: NOW });
  state = changeBasketQuantity(state, "bar", "bar-beer", 1);
  assert.equal(basketSummary(state, "bar").ready, false);
  assert.throws(() => completeApprovedSale(state, {
    shop: "bar", saleId: "sale-1", occurredAt: NOW, staffConfirmedApproved: true
  }), /not ready/);
});

test("physical counts are append-only movements", () => {
  const state = countStock(initial(), {
    productId: "bar-beer",
    quantity: 3,
    occurredAt: NOW,
    movementId: "count-1",
    reason: "Opening recount"
  });
  assert.equal(state.inventory["bar-beer"], 3);
  assert.deepEqual(state.movements.at(-1), {
    id: "count-1",
    productId: "bar-beer",
    inventoryId: "bar-beer",
    kind: "COUNTED",
    delta: -1,
    resultingStock: 3,
    occurredAt: NOW,
    reason: "Opening recount"
  });
});

test("new catalogue items retain product and inventory separation", () => {
  const state = saveProduct(initial(), {
    occurredAt: NOW,
    product: { id: "merch-cap", sku: "MERCH-CAP", shop: "merch", name: "Cap", detail: "", pricePence: 1800, openingStock: 10, unit: "item", lowStockAt: 2, active: true }
  });
  assert.equal(state.catalog.at(-1).name, "Cap");
  assert.equal(state.inventory["merch-cap"], 10);
});

test("CSV export includes line snapshots and manual payment evidence", () => {
  let state = changeBasketQuantity(initial(), "bar", "bar-beer", 1);
  state = completeApprovedSale(state, {
    shop: "bar", saleId: "sale-1", occurredAt: NOW, staffConfirmedApproved: true
  });
  const csv = salesCsv(state);
  assert.match(csv, /sale_id,timestamp,device_id/);
  assert.match(csv, /BAR-BEER,Beer,can,1,600,600,600,STAFF_CONFIRMED_APPROVED/);
});

test("bottle and glass buttons consume one shared physical wine stock pool", () => {
  const catalog = [
    {
      id: "wine-bottle", sku: "WINE-BTL", shop: "bar", name: "Wine", detail: "Bottle", pricePence: 3000,
      openingStock: 750, unit: "bottle", lowStockAt: 1, active: true, inventoryId: "wine-bottle",
      stockUse: 750, stockDisplayDivisor: 750, stockDisplayUnit: "bottle"
    },
    {
      id: "wine-125", sku: "WINE-125", shop: "bar", name: "Wine", detail: "125ml", pricePence: 800,
      openingStock: 750, unit: "glass", lowStockAt: 1, active: true, inventoryId: "wine-bottle",
      stockUse: 125, stockDisplayDivisor: 750, stockDisplayUnit: "bottle"
    }
  ];
  let state = createInitialState({ catalog, deviceId: "ipad-test", createdAt: NOW });
  state = changeBasketQuantity(state, "bar", "wine-125", 2);
  assert.throws(() => changeBasketQuantity(state, "bar", "wine-bottle", 1), /not enough estimated stock/);
  state = completeApprovedSale(state, {
    shop: "bar", saleId: "sale-wine", occurredAt: NOW, staffConfirmedApproved: true
  });
  assert.equal(state.inventory["wine-bottle"], 500);
  assert.equal(availableForProduct(state, "wine-bottle"), 0);
  assert.equal(availableForProduct(state, "wine-125"), 4);
});

test("a previous basket snapshot can be restored for one-step undo", () => {
  let state = changeBasketQuantity(initial(), "bar", "bar-beer", 2);
  const previous = state.baskets.bar.map((line) => ({ ...line }));
  state = changeBasketQuantity(state, "bar", "bar-beer", -1);
  state = replaceBasket(state, "bar", previous);
  assert.equal(basketSummary(state, "bar").itemCount, 2);
});

test("sales report totals completed revenue, units, counters, categories, and products", () => {
  let state = changeBasketQuantity(initial(), "bar", "bar-beer", 2);
  state = completeApprovedSale(state, {
    shop: "bar", saleId: "sale-bar-1", occurredAt: "2026-08-19T12:00:00Z", staffConfirmedApproved: true
  });
  state = changeBasketQuantity(state, "bar", "bar-beer", 1);
  state = completeApprovedSale(state, {
    shop: "bar", saleId: "sale-bar-2", occurredAt: "2026-08-19T12:10:00Z", staffConfirmedApproved: true
  });
  state = changeBasketQuantity(state, "merch", "merch-shirt", 1);
  state = completeApprovedSale(state, {
    shop: "merch", saleId: "sale-merch-1", occurredAt: "2026-08-19T12:20:00Z", staffConfirmedApproved: true
  });

  const report = salesReport(state);
  assert.deepEqual(report.totals, {
    revenuePence: 4300,
    units: 4,
    transactions: 3,
    distinctProducts: 2,
    averageSalePence: 1433
  });
  assert.equal(report.source, "THIS_IPAD_ONLY");
  assert.deepEqual(report.shops.map(({ shop, revenuePence, units, transactions, distinctProducts }) => ({
    shop, revenuePence, units, transactions, distinctProducts
  })), [
    { shop: "bar", revenuePence: 1800, units: 3, transactions: 2, distinctProducts: 1 },
    { shop: "merch", revenuePence: 2500, units: 1, transactions: 1, distinctProducts: 1 }
  ]);
  assert.equal(report.categories.find((category) => category.category === "Beer").revenuePence, 1800);
  assert.equal(report.categories.find((category) => category.category === "Apparel").units, 1);
  assert.equal(report.products[0].name, "Beer");
  assert.equal(report.products[0].transactions, 2);
  assert.equal(report.period.lastSaleAt, "2026-08-19T12:20:00Z");
});
