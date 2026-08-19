import {
  availableForProduct,
  basketSummary,
  changeBasketQuantity,
  clearBasket,
  completeApprovedSale,
  countStock,
  replaceBasket,
  salesReport,
  salesCsv,
  saveProduct,
  setPreferredShop
} from "./pos-domain.js";
import { downloadFile, loadLocalState, saveLocalState } from "./storage.js";

const byId = (id) => document.getElementById(id);
const money = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });
const whole = new Intl.NumberFormat("en-GB");
const reportDateTime = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const reportTime = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" });
const loaded = loadLocalState();
let state = loaded.state;
let currentShop = state.device.preferredShop;
let currentView = "pos";
let toastTimer;
const undoBaskets = { bar: null, merch: null };

const elements = {
  stationTitle: byId("stationTitle"),
  workspaceSuffix: byId("workspaceSuffix"),
  skipLink: byId("skipLink"),
  posView: byId("posView"),
  reportsView: byId("reportsView"),
  openReports: byId("openReports"),
  catalogueEyebrow: byId("catalogueEyebrow"),
  products: byId("products"),
  emptyProducts: byId("emptyProducts"),
  basketLines: byId("basketLines"),
  basketEmpty: byId("basketEmpty"),
  basketTotal: byId("basketTotal"),
  basketNote: byId("basketNote"),
  undoBasket: byId("undoBasket"),
  startPayment: byId("startPayment"),
  paymentTotal: byId("paymentTotal"),
  paymentDialog: byId("paymentDialog"),
  operationsDialog: byId("operationsDialog"),
  productEditor: byId("productEditor"),
  productTemplate: byId("productEditTemplate"),
  salesSummary: byId("salesSummary"),
  manageShopLabel: byId("manageShopLabel"),
  deviceLabel: byId("deviceLabel"),
  reportScope: byId("reportScope"),
  reportPeriod: byId("reportPeriod"),
  reportRevenue: byId("reportRevenue"),
  reportUnits: byId("reportUnits"),
  reportProducts: byId("reportProducts"),
  reportTransactions: byId("reportTransactions"),
  reportAverage: byId("reportAverage"),
  reportShopBreakdown: byId("reportShopBreakdown"),
  reportCategoryBreakdown: byId("reportCategoryBreakdown"),
  reportCategoryEmpty: byId("reportCategoryEmpty"),
  reportProductRows: byId("reportProductRows"),
  reportProductEmpty: byId("reportProductEmpty"),
  toast: byId("toast")
};

function persist() {
  saveLocalState(state);
}

function showToast(message) {
  clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.hidden = false;
  toastTimer = setTimeout(() => { elements.toast.hidden = true; }, 3200);
}

function make(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function shopLabel(value) {
  return value === "bar" ? "Bar" : "Merch";
}

const PRODUCT_GROUPS = Object.freeze({
  bar: Object.freeze([
    { key: "beer", title: "Beer" },
    { key: "wine", title: "Wine" },
    { key: "sparkling", title: "Sparkling" },
    { key: "non-alcoholic", title: "Non-alcoholic" },
    { key: "soft-drinks", title: "Soft drinks" },
    { key: "water", title: "Water" },
    { key: "other-bar", title: "Other drinks" }
  ]),
  merch: Object.freeze([
    { key: "caps-bags", title: "Caps & bags" },
    { key: "small-goods", title: "Small goods" },
    { key: "t-shirts", title: "T-shirts" },
    { key: "other-merch", title: "Other merchandise" }
  ])
});

function servingLabel(product) {
  const id = product.id.toLowerCase();
  const glassSize = id.match(/-(125|175)$/);
  if (glassSize) return glassSize[1] + "ml glass";
  if (id.includes("-bottle")) return "Bottle";
  if (product.shop === "merch" && product.detail && !/architects holiday/i.test(product.detail)) return product.detail;
  return ({ can: "Can", bottle: "Bottle", glass: "Glass", serve: "Single serve" })[product.unit] ?? "";
}

function productPresentation(product) {
  const id = product.id.toLowerCase();
  const detailSupplier = product.detail.trim();
  if (product.shop === "merch") {
    const groupKey = /tshirt/.test(id) ? "t-shirts" : /merch-cap|merch-tote/.test(id) ? "caps-bags" : /merch-pencil|merch-badge/.test(id) ? "small-goods" : "other-merch";
    return { groupKey, supplier: "Architects Holiday", name: product.name, serving: servingLabel(product) };
  }
  if (/sussex-lager|table-beer|stir-neipa|reforestation-pale|1066-pale/.test(id)) return { groupKey: "beer", supplier: detailSupplier || "Brewing Brothers", name: product.name, serving: servingLabel(product) };
  if (/tilsmore/.test(id)) return { groupKey: "sparkling", supplier: "Tilsmore", name: product.name, serving: servingLabel(product) };
  if (/endgrain|bar-rose|bar-r-nv/.test(id)) return { groupKey: "wine", supplier: "Tillingham", name: product.name, serving: servingLabel(product) };
  if (/club-mera/.test(id)) return { groupKey: "non-alcoholic", supplier: "Club Mera", name: product.name, serving: servingLabel(product) };
  if (/lucky-saint/.test(id)) return { groupKey: "non-alcoholic", supplier: "Lucky Saint", name: product.detail || product.name, serving: servingLabel(product) };
  if (/dalston/.test(id)) return { groupKey: "soft-drinks", supplier: detailSupplier || "Dalston Press", name: product.name, serving: servingLabel(product) };
  if (/marlish/.test(id)) return { groupKey: "water", supplier: detailSupplier || "Marlish", name: product.name, serving: servingLabel(product) };
  return { groupKey: "other-bar", supplier: detailSupplier || "Open Day", name: product.name, serving: servingLabel(product) };
}

function currentProducts() {
  return state.catalog.filter((product) => product.shop === currentShop && product.active);
}

function productSortRank(product) {
  return ({ "merch-tote": 0, "merch-cap": 1, "merch-pencil": 2, "merch-badge": 3 })[product.id] ?? 100;
}

function plural(value, unit) {
  if (value === 1) return unit;
  if (unit === "glass") return "glasses";
  return unit + "s";
}

function stockText(product, available) {
  if (available === 0) return "None remaining";
  const shared = state.catalog.filter((candidate) => candidate.inventoryId === product.inventoryId).length > 1;
  return available + " " + plural(available, product.unit) + " available" + (shared ? " · shared stock" : "");
}

function rememberBasket() {
  undoBaskets[currentShop] = state.baskets[currentShop].map((line) => ({ ...line }));
}

function renderProducts() {
  elements.products.replaceChildren();
  const products = currentProducts();
  elements.emptyProducts.hidden = products.length !== 0;
  const groupedProducts = new Map(PRODUCT_GROUPS[currentShop].map((group) => [group.key, []]));
  for (const product of products) groupedProducts.get(productPresentation(product).groupKey).push(product);
  for (const groupProducts of groupedProducts.values()) groupProducts.sort((left, right) => productSortRank(left) - productSortRank(right));

  for (const group of PRODUCT_GROUPS[currentShop]) {
    const groupProducts = groupedProducts.get(group.key);
    if (!groupProducts.length) continue;
    const section = make("section", "product-group product-group-" + group.key);
    section.setAttribute("aria-labelledby", "product-group-title-" + group.key);
    const groupHeader = make("header", "product-group-header");
    const groupTitle = make("h3", "", group.title);
    groupTitle.id = "product-group-title-" + group.key;
    groupHeader.append(groupTitle, make("span", "", groupProducts.length + (groupProducts.length === 1 ? " choice" : " choices")));
    const grid = make("div", "product-grid");

    for (const product of groupProducts) {
      const presentation = productPresentation(product);
      const available = availableForProduct(state, product);
      const button = make("button", "product-button");
      button.type = "button";
      button.dataset.productId = product.id;
      button.disabled = product.pricePence == null || available === 0;
      if (available === 0) button.classList.add("sold-out");
      if (product.id === "bar-tilsmore-rose-bottle") button.classList.add("product-row-break");

      const heading = make("div", "product-copy");
      heading.append(make("span", "product-supplier", presentation.supplier), make("strong", "product-name", presentation.name));
      if (presentation.serving) heading.append(make("span", "product-serving", presentation.serving));

      const meta = make("div", "product-meta");
      const price = make("span", "product-price", product.pricePence == null ? "Set price" : money.format(product.pricePence / 100));
      const stockLabel = make("span", "stock-label" + (available <= product.lowStockAt ? " low" : ""), stockText(product, available));
      meta.append(price, stockLabel);
      button.append(heading, meta);
      button.setAttribute("aria-label", [presentation.supplier, presentation.name, presentation.serving, price.textContent].filter(Boolean).join(", "));
      button.addEventListener("click", () => {
        try {
          rememberBasket();
          state = changeBasketQuantity(state, currentShop, product.id, 1);
          persist();
          render();
        } catch (error) {
          showToast(error.message);
        }
      });
      grid.append(button);
    }
    section.append(groupHeader, grid);
    elements.products.append(section);
  }
}

function quantityControl(line) {
  const control = make("div", "quantity-control");
  const minus = make("button", "", "−");
  minus.type = "button";
  minus.setAttribute("aria-label", "Remove one " + line.product.name);
  const quantity = make("span", "", String(line.quantity));
  const plus = make("button", "", "+");
  plus.type = "button";
  plus.setAttribute("aria-label", "Add one " + line.product.name);
  minus.addEventListener("click", () => updateBasket(line.product.id, -1));
  plus.addEventListener("click", () => updateBasket(line.product.id, 1));
  control.append(minus, quantity, plus);
  return control;
}

function updateBasket(productId, delta) {
  try {
    rememberBasket();
    state = changeBasketQuantity(state, currentShop, productId, delta);
    persist();
    render();
  } catch (error) {
    showToast(error.message);
  }
}

function renderBasket() {
  const summary = basketSummary(state, currentShop);
  elements.basketLines.replaceChildren();
  elements.basketEmpty.hidden = summary.lines.length !== 0;
  for (const line of summary.lines) {
    const row = make("div", "basket-line");
    const copy = make("div", "basket-line-copy");
    copy.append(
      make("strong", "", line.product.name),
      make("small", "", line.product.detail),
      make("span", "", line.lineTotalPence == null ? "Price not set" : money.format(line.lineTotalPence / 100))
    );
    row.append(copy, quantityControl(line));
    elements.basketLines.append(row);
  }
  elements.basketTotal.textContent = money.format(summary.totalPence / 100);
  elements.startPayment.disabled = !summary.ready;
  elements.undoBasket.disabled = undoBaskets[currentShop] == null;
  if (!summary.lines.length) elements.basketNote.textContent = "Add products, then take the exact total on the S710.";
  else if (!summary.ready) elements.basketNote.textContent = "Set missing prices or adjust stock before taking payment.";
  else elements.basketNote.textContent = summary.itemCount + " item" + (summary.itemCount === 1 ? "" : "s") + " · stock changes only after Approved.";
}

function renderShopBreakdown(shopSummary) {
  const card = make("article", "report-shop-card");
  card.dataset.shop = shopSummary.shop;
  const head = make("div", "report-shop-head");
  head.append(
    make("span", "", shopLabel(shopSummary.shop) + " total"),
    make("strong", "", money.format(shopSummary.revenuePence / 100))
  );
  const metrics = make("dl");
  const addMetric = (label, value) => {
    const item = make("div");
    item.append(make("dt", "", label), make("dd", "", whole.format(value)));
    metrics.append(item);
  };
  addMetric("Units", shopSummary.units);
  addMetric("Transactions", shopSummary.transactions);
  addMetric("Products", shopSummary.distinctProducts);
  card.append(head, metrics);
  return card;
}

function renderReports() {
  const report = salesReport(state);
  elements.reportRevenue.textContent = money.format(report.totals.revenuePence / 100);
  elements.reportUnits.textContent = whole.format(report.totals.units);
  elements.reportProducts.textContent = whole.format(report.totals.distinctProducts);
  elements.reportTransactions.textContent = whole.format(report.totals.transactions);
  elements.reportAverage.textContent = money.format(report.totals.averageSalePence / 100);
  elements.reportScope.textContent = "Completed sales stored on " + report.device.label + ". Add the totals from both iPads for the complete event.";

  if (!report.period.firstSaleAt) {
    elements.reportPeriod.textContent = "No completed sales yet";
  } else if (report.period.firstSaleAt === report.period.lastSaleAt) {
    elements.reportPeriod.textContent = reportDateTime.format(new Date(report.period.firstSaleAt));
  } else {
    const first = new Date(report.period.firstSaleAt);
    const last = new Date(report.period.lastSaleAt);
    const sameDate = first.toDateString() === last.toDateString();
    elements.reportPeriod.textContent = sameDate
      ? reportDateTime.format(first) + "–" + reportTime.format(last)
      : reportDateTime.format(first) + "–" + reportDateTime.format(last);
  }

  elements.reportShopBreakdown.replaceChildren(...report.shops.map(renderShopBreakdown));

  elements.reportCategoryBreakdown.replaceChildren();
  elements.reportCategoryEmpty.hidden = report.categories.length !== 0;
  const categoryMaximum = Math.max(1, ...report.categories.map((category) => category.revenuePence));
  for (const category of report.categories) {
    const row = make("article", "report-category-row");
    row.dataset.shop = category.shop;
    const copy = make("div", "report-category-copy");
    copy.append(make("strong", "", category.category), make("span", "", shopLabel(category.shop) + " · " + whole.format(category.transactions) + " transaction" + (category.transactions === 1 ? "" : "s")));
    const values = make("div", "report-category-values");
    values.append(make("span", "", whole.format(category.units) + " units"), make("strong", "", money.format(category.revenuePence / 100)));
    const rail = make("span", "report-category-rail");
    rail.setAttribute("aria-hidden", "true");
    const fill = make("i");
    fill.style.width = ((category.revenuePence / categoryMaximum) * 100).toFixed(2) + "%";
    rail.append(fill);
    row.append(copy, values, rail);
    elements.reportCategoryBreakdown.append(row);
  }

  elements.reportProductRows.replaceChildren();
  elements.reportProductEmpty.hidden = report.products.length !== 0;
  for (const product of report.products) {
    const row = document.createElement("tr");
    const productCell = document.createElement("th");
    productCell.scope = "row";
    productCell.append(make("strong", "", product.name));
    if (product.detail) productCell.append(make("small", "", product.detail));
    const shopCell = make("td", "", shopLabel(product.shop));
    const categoryCell = make("td", "", product.category);
    const unitsCell = make("td", "report-number", whole.format(product.units));
    const revenueCell = make("td", "report-number", money.format(product.revenuePence / 100));
    row.append(productCell, shopCell, categoryCell, unitsCell, revenueCell);
    elements.reportProductRows.append(row);
  }
}

function renderHeader() {
  if (currentView === "reports") {
    elements.stationTitle.textContent = "Event";
    elements.workspaceSuffix.textContent = "summary";
    elements.posView.hidden = true;
    elements.reportsView.hidden = false;
    elements.skipLink.href = "#reportTitle";
    elements.skipLink.textContent = "Skip to report";
    for (const button of document.querySelectorAll("[data-shop]")) button.setAttribute("aria-pressed", "false");
    elements.openReports.setAttribute("aria-pressed", "true");
    return;
  }

  const label = shopLabel(currentShop);
  elements.stationTitle.textContent = label;
  elements.workspaceSuffix.textContent = "counter";
  elements.posView.hidden = false;
  elements.reportsView.hidden = true;
  elements.skipLink.href = "#products";
  elements.skipLink.textContent = "Skip to products";
  elements.catalogueEyebrow.textContent = label + " selection";
  elements.openReports.setAttribute("aria-pressed", "false");
  for (const button of document.querySelectorAll("[data-shop]")) button.setAttribute("aria-pressed", String(button.dataset.shop === currentShop));
  const sales = state.sales.filter((sale) => sale.shop === currentShop);
  const total = sales.reduce((sum, sale) => sum + sale.totalPence, 0);
  elements.salesSummary.textContent = sales.length ? sales.length + " completed · " + money.format(total / 100) + " on this iPad" : "No completed sales on this iPad";
}

function render() {
  renderHeader();
  if (currentView === "reports") {
    renderReports();
    return;
  }
  renderProducts();
  renderBasket();
}

function openOperations() {
  elements.productEditor.replaceChildren();
  elements.deviceLabel.value = state.device.label;
  elements.manageShopLabel.textContent = shopLabel(currentShop) + " catalogue";
  for (const product of state.catalog.filter((candidate) => candidate.shop === currentShop)) addEditorRow(product);
  elements.operationsDialog.showModal();
}

function formatStockCount(value) {
  return Number.isInteger(value) ? String(value) : value.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
}

function addEditorRow(product = null) {
  const row = elements.productTemplate.content.firstElementChild.cloneNode(true);
  const id = product?.id ?? currentShop + "-" + (globalThis.crypto?.randomUUID?.() ?? Date.now());
  const inventoryId = product?.inventoryId ?? id;
  const stockDisplayDivisor = product?.stockDisplayDivisor ?? 1;
  const stockDisplayUnit = product?.stockDisplayUnit ?? "item";
  const stockIsEditable = !product || product.id === inventoryId;
  const sharedProducts = product ? state.catalog.filter((candidate) => candidate.inventoryId === inventoryId) : [];

  row.dataset.productId = id;
  row.dataset.inventoryId = inventoryId;
  row.dataset.stockDisplayDivisor = String(stockDisplayDivisor);
  row.dataset.stockDisplayUnit = stockDisplayUnit;

  const set = (field, value) => {
    const input = row.querySelector('[data-field="' + field + '"]');
    if (input.type === "checkbox") input.checked = Boolean(value);
    else input.value = value ?? "";
  };
  set("id", id);
  set("name", product?.name ?? "");
  set("detail", product?.detail ?? "");
  set("price", product?.pricePence == null ? "" : (product.pricePence / 100).toFixed(2));
  set("unit", product?.unit ?? "item");
  set("lowStockAt", product?.lowStockAt ?? 3);
  set("active", product?.active ?? true);

  const stockField = row.querySelector(".stock-field");
  const stockInput = row.querySelector('[data-field="stock"]');
  const stockLabel = row.querySelector("[data-stock-label]");
  const stockNote = row.querySelector("[data-stock-note]");
  const rawStock = product ? state.inventory[inventoryId] : 0;
  stockInput.value = formatStockCount(rawStock / stockDisplayDivisor);
  stockLabel.textContent = "Count (" + plural(2, stockDisplayUnit) + ")";

  if (!stockIsEditable) {
    stockField.hidden = true;
    stockInput.disabled = true;
    stockInput.required = false;
    const owner = state.catalog.find((candidate) => candidate.id === inventoryId);
    stockNote.textContent = "Shares the stock count managed by " + (owner?.name ?? "the bottle row") + ".";
  } else if (sharedProducts.length > 1) {
    stockNote.textContent = "Shared by this wine’s bottle and glass buttons.";
  } else {
    stockNote.hidden = true;
  }

  elements.productEditor.append(row);
  if (!product) row.querySelector('[data-field="name"]').focus();
}

function pence(value) {
  const cleaned = value.trim();
  if (!cleaned) return null;
  if (!/^\d+(?:\.\d{1,2})?$/.test(cleaned)) throw new Error("Prices must use pounds and up to two decimal places");
  const result = Math.round(Number(cleaned) * 100);
  if (!Number.isSafeInteger(result) || result < 1) throw new Error("Each entered price must be above zero");
  return result;
}

function wholeNumber(value, label) {
  if (!/^\d+$/.test(value.trim())) throw new Error(label + " must be a whole number");
  return Number(value);
}

function stockQuantity(value, divisor) {
  const cleaned = value.trim();
  if (!/^\d+(?:\.\d{1,3})?$/.test(cleaned)) throw new Error("Stock must be a positive count with no more than three decimal places");
  const result = Math.round(Number(cleaned) * divisor);
  if (!Number.isSafeInteger(result) || result < 0) throw new Error("Stock count is outside the supported range");
  return result;
}

function editorValue(row, field) {
  return row.querySelector('[data-field="' + field + '"]');
}

function saveOperations(event) {
  if (event.submitter?.value !== "save") return;
  event.preventDefault();
  try {
    let next = state;
    const occurredAt = new Date().toISOString();
    for (const row of elements.productEditor.querySelectorAll(".product-edit-row")) {
      const id = row.dataset.productId;
      const existing = next.catalog.find((product) => product.id === id);
      const stockInput = editorValue(row, "stock");
      const stockDisplayDivisor = existing?.stockDisplayDivisor ?? Number(row.dataset.stockDisplayDivisor) ?? 1;
      const stockDisplayUnit = existing?.stockDisplayUnit ?? row.dataset.stockDisplayUnit ?? "item";
      const inventoryId = existing?.inventoryId ?? row.dataset.inventoryId ?? id;
      const stock = stockInput.disabled
        ? next.inventory[inventoryId]
        : stockQuantity(stockInput.value, stockDisplayDivisor);
      const name = editorValue(row, "name").value.trim();
      if (!name) throw new Error("Every product needs a name");
      const skuBase = name.toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 24) || "ITEM";
      next = saveProduct(next, {
        occurredAt,
        product: {
          id,
          sku: existing?.sku ?? (currentShop.toUpperCase() + "-" + skuBase + "-" + String(next.catalog.length + 1)),
          shop: currentShop,
          name,
          detail: editorValue(row, "detail").value,
          reportCategory: existing?.reportCategory,
          pricePence: pence(editorValue(row, "price").value),
          openingStock: existing?.openingStock ?? stock,
          unit: editorValue(row, "unit").value,
          lowStockAt: wholeNumber(editorValue(row, "lowStockAt").value, "Low stock"),
          active: editorValue(row, "active").checked,
          inventoryId,
          stockUse: existing?.stockUse ?? 1,
          stockDisplayDivisor,
          stockDisplayUnit
        }
      });
      if (!stockInput.disabled && next.inventory[inventoryId] !== stock) {
        next = countStock(next, {
          productId: id,
          quantity: stock,
          occurredAt,
          movementId: "count-" + id + "-" + Date.now() + "-" + Math.random().toString(16).slice(2),
          reason: "Operations screen physical count"
        });
      }
    }
    next.device.label = elements.deviceLabel.value.trim() || "Open Day iPad";
    state = next;
    persist();
    elements.operationsDialog.close();
    render();
    showToast("Catalogue and stock saved on this iPad");
  } catch (error) {
    showToast(error.message);
  }
}

document.querySelector(".shop-switch").addEventListener("click", (event) => {
  const button = event.target.closest("[data-shop]");
  if (!button || (currentView === "pos" && button.dataset.shop === currentShop)) return;
  if (currentView === "pos" && button.dataset.shop !== currentShop) {
    const currentBasket = basketSummary(state, currentShop);
    if (currentBasket.lines.length && !confirm("The " + shopLabel(currentShop).toLowerCase() + " basket still has " + currentBasket.itemCount + " item" + (currentBasket.itemCount === 1 ? "" : "s") + ". Keep it and switch counters?")) return;
  }
  currentShop = button.dataset.shop;
  currentView = "pos";
  state = setPreferredShop(state, currentShop);
  persist();
  render();
});

elements.openReports.addEventListener("click", () => {
  currentView = "reports";
  render();
  byId("reportTitle").focus();
});

byId("clearBasket").addEventListener("click", () => {
  if (!basketSummary(state, currentShop).lines.length) return;
  if (!confirm("Clear the current " + shopLabel(currentShop).toLowerCase() + " basket?")) return;
  rememberBasket();
  state = clearBasket(state, currentShop);
  persist();
  render();
});

elements.undoBasket.addEventListener("click", () => {
  if (!undoBaskets[currentShop]) return;
  try {
    state = replaceBasket(state, currentShop, undoBaskets[currentShop]);
    undoBaskets[currentShop] = null;
    persist();
    render();
    showToast("Last basket change undone");
  } catch (error) {
    showToast(error.message);
  }
});

elements.startPayment.addEventListener("click", () => {
  elements.paymentTotal.textContent = money.format(basketSummary(state, currentShop).totalPence / 100);
  elements.paymentDialog.showModal();
});

byId("completeSale").addEventListener("click", (event) => {
  event.preventDefault();
  try {
    const now = new Date().toISOString();
    state = completeApprovedSale(state, {
      shop: currentShop,
      saleId: "sale-" + Date.now() + "-" + Math.random().toString(16).slice(2),
      occurredAt: now,
      staffConfirmedApproved: true
    });
    undoBaskets[currentShop] = null;
    persist();
    elements.paymentDialog.close();
    render();
    showToast("Sale completed and stock updated");
  } catch (error) {
    showToast(error.message);
  }
});

byId("openOperations").addEventListener("click", openOperations);
byId("emptyAddProduct").addEventListener("click", openOperations);
byId("addProduct").addEventListener("click", () => addEditorRow());
byId("operationsForm").addEventListener("submit", saveOperations);

byId("exportCsv").addEventListener("click", () => {
  downloadFile("open-day-sales-" + state.device.id + ".csv", salesCsv(state), "text/csv;charset=utf-8");
});
byId("exportJson").addEventListener("click", () => {
  downloadFile("open-day-pos-backup-" + state.device.id + ".json", JSON.stringify(state, null, 2), "application/json");
});

window.addEventListener("pagehide", persist);
if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
  navigator.serviceWorker.register("./sw.js").catch(() => showToast("Offline install is not available in this browser session"));
}

render();
if (loaded.recovered) showToast("Prior prototype data was preserved separately; this iPad started with the weekend catalogue");
