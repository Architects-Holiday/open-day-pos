import { cloneDefaultCatalog } from "./catalog.js";

export const SCHEMA_VERSION = 2;
export const SHOPS = Object.freeze(["bar", "merch"]);

const copy = (value) => JSON.parse(JSON.stringify(value));

function integer(value, field, minimum = 0) {
  if (!Number.isSafeInteger(value) || value < minimum) throw new RangeError(field + " must be an integer of at least " + minimum);
  return value;
}

function text(value, field, maximum = 80) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > maximum) throw new TypeError(field + " must be between 1 and " + maximum + " characters");
  return value.trim();
}

function shop(value) {
  if (!SHOPS.includes(value)) throw new RangeError("shop must be bar or merch");
  return value;
}

function instant(value, field) {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) throw new TypeError(field + " must be an ISO timestamp");
  return value;
}

export function reportCategoryForProduct(product) {
  if (typeof product?.reportCategory === "string" && product.reportCategory.trim()) return product.reportCategory.trim().slice(0, 40);
  const id = String(product?.id ?? "").toLowerCase();
  if (product?.shop === "bar") {
    if (/endgrain|bar-rose|bar-r-nv|tilsmore/.test(id)) return "Wine";
    if (/sussex-lager|table-beer|stir-neipa|reforestation-pale|1066-pale/.test(id)) return "Beer";
    if (/club-mera|lucky-saint/.test(id)) return "Alcohol-free";
    if (/dalston|marlish/.test(id)) return "Soft drinks & water";
    return "Other bar";
  }
  if (/tshirt|merch-cap/.test(id)) return "Apparel";
  if (/merch-tote/.test(id)) return "Bags";
  if (/merch-pencil|merch-badge/.test(id)) return "Small goods";
  return "Other merch";
}


export function normaliseProduct(product) {
  const id = text(product.id, "id", 100);
  const unit = text(product.unit ?? "item", "unit", 24);
  return {
    id,
    sku: text(product.sku, "sku", 40).toUpperCase(),
    shop: shop(product.shop),
    name: text(product.name, "name"),
    detail: typeof product.detail === "string" ? product.detail.trim().slice(0, 100) : "",
    reportCategory: reportCategoryForProduct({ ...product, id }),
    pricePence: product.pricePence == null ? null : integer(product.pricePence, "pricePence", 1),
    openingStock: integer(product.openingStock ?? 0, "openingStock"),
    unit,
    lowStockAt: integer(product.lowStockAt ?? 0, "lowStockAt"),
    active: product.active !== false,
    inventoryId: text(product.inventoryId ?? id, "inventoryId", 100),
    stockUse: integer(product.stockUse ?? 1, "stockUse", 1),
    stockDisplayDivisor: integer(product.stockDisplayDivisor ?? 1, "stockDisplayDivisor", 1),
    stockDisplayUnit: text(product.stockDisplayUnit ?? unit, "stockDisplayUnit", 24)
  };
}

function normaliseCatalog(products) {
  if (!Array.isArray(products)) throw new TypeError("catalog must be an array");
  const catalog = products.map(normaliseProduct);
  if (new Set(catalog.map((product) => product.id)).size !== catalog.length) throw new RangeError("catalog contains duplicate product IDs");
  if (new Set(catalog.map((product) => product.sku)).size !== catalog.length) throw new RangeError("catalog contains duplicate SKUs");

  const poolConfiguration = new Map();
  for (const product of catalog) {
    const configuration = {
      openingStock: product.openingStock,
      stockDisplayDivisor: product.stockDisplayDivisor,
      stockDisplayUnit: product.stockDisplayUnit
    };
    const existing = poolConfiguration.get(product.inventoryId);
    if (existing && (
      existing.openingStock !== configuration.openingStock ||
      existing.stockDisplayDivisor !== configuration.stockDisplayDivisor ||
      existing.stockDisplayUnit !== configuration.stockDisplayUnit
    )) throw new RangeError("products in a shared stock pool must use the same opening count and display unit");
    poolConfiguration.set(product.inventoryId, configuration);
  }
  return catalog;
}

function poolOwners(catalog) {
  const owners = new Map();
  for (const product of catalog) if (!owners.has(product.inventoryId)) owners.set(product.inventoryId, product);
  return owners;
}

export function createInitialState(options = {}) {
  const catalog = normaliseCatalog(options.catalog ?? cloneDefaultCatalog());
  const occurredAt = options.createdAt ?? new Date().toISOString();
  const owners = poolOwners(catalog);
  return {
    schemaVersion: SCHEMA_VERSION,
    device: {
      id: text(options.deviceId ?? "device-local", "deviceId", 100),
      label: typeof options.deviceLabel === "string" && options.deviceLabel.trim() ? options.deviceLabel.trim().slice(0, 40) : "Open Day iPad",
      preferredShop: shop(options.preferredShop ?? "bar")
    },
    catalog,
    inventory: Object.fromEntries([...owners].map(([inventoryId, product]) => [inventoryId, product.openingStock])),
    baskets: { bar: [], merch: [] },
    sales: [],
    movements: [...owners].filter(([, product]) => product.openingStock > 0).map(([inventoryId, product]) => ({
      id: "opening-" + inventoryId,
      productId: product.id,
      inventoryId,
      kind: "OPENING_COUNT",
      delta: product.openingStock,
      resultingStock: product.openingStock,
      occurredAt,
      reason: "Initial catalogue count"
    })),
    updatedAt: occurredAt
  };
}

export function validateState(state) {
  if (!state || typeof state !== "object" || state.schemaVersion !== SCHEMA_VERSION) throw new Error("unsupported POS data version");
  text(state.device?.id, "device.id", 100);
  shop(state.device?.preferredShop);
  if (!Array.isArray(state.sales) || !Array.isArray(state.movements)) throw new TypeError("POS collections are invalid");
  const catalog = normaliseCatalog(state.catalog);
  for (const product of poolOwners(catalog).values()) integer(state.inventory?.[product.inventoryId], "inventory." + product.inventoryId);
  for (const currentShop of SHOPS) {
    if (!Array.isArray(state.baskets?.[currentShop])) throw new TypeError("basket " + currentShop + " is invalid");
    for (const line of state.baskets[currentShop]) {
      const product = catalog.find((candidate) => candidate.id === line.productId);
      if (!product || product.shop !== currentShop) throw new Error("basket refers to an unknown product");
      integer(line.quantity, "basket quantity", 1);
    }
  }
  return state;
}

export function setPreferredShop(state, value) {
  validateState(state);
  const next = copy(state);
  next.device.preferredShop = shop(value);
  next.updatedAt = new Date().toISOString();
  return next;
}

export function availableForProduct(state, productOrId) {
  validateState(state);
  const product = typeof productOrId === "string"
    ? state.catalog.find((candidate) => candidate.id === productOrId)
    : productOrId;
  if (!product) throw new Error("product was not found");
  return Math.floor(state.inventory[product.inventoryId] / product.stockUse);
}

function basketDemand(state, currentShop) {
  const products = new Map(state.catalog.map((product) => [product.id, product]));
  const demand = new Map();
  for (const line of state.baskets[currentShop]) {
    const product = products.get(line.productId);
    demand.set(product.inventoryId, (demand.get(product.inventoryId) ?? 0) + (product.stockUse * line.quantity));
  }
  return demand;
}

function assertBasketStock(state, currentShop) {
  for (const [inventoryId, quantity] of basketDemand(state, currentShop)) {
    if (quantity > state.inventory[inventoryId]) throw new RangeError("not enough estimated stock on this iPad");
  }
}

export function basketSummary(state, value) {
  validateState(state);
  const currentShop = shop(value);
  const products = new Map(state.catalog.map((product) => [product.id, product]));
  const lines = state.baskets[currentShop].map((line) => {
    const product = products.get(line.productId);
    const lineTotalPence = product.pricePence == null ? null : product.pricePence * line.quantity;
    if (lineTotalPence != null && !Number.isSafeInteger(lineTotalPence)) throw new RangeError("basket total is outside the safe range");
    return { ...line, product, lineTotalPence };
  });
  const stockReady = [...basketDemand(state, currentShop)].every(([inventoryId, quantity]) => quantity <= state.inventory[inventoryId]);
  const ready = lines.length > 0 && stockReady && lines.every((line) => line.product.active && line.product.pricePence != null);
  const totalPence = lines.reduce((sum, line) => sum + (line.lineTotalPence ?? 0), 0);
  if (!Number.isSafeInteger(totalPence)) throw new RangeError("basket total is outside the safe range");
  return { lines, totalPence, itemCount: lines.reduce((sum, line) => sum + line.quantity, 0), ready };
}

export function changeBasketQuantity(state, value, productId, delta) {
  validateState(state);
  const currentShop = shop(value);
  if (!Number.isSafeInteger(delta) || delta === 0) throw new RangeError("basket change must be a non-zero integer");
  const product = state.catalog.find((candidate) => candidate.id === productId && candidate.shop === currentShop && candidate.active);
  if (!product) throw new Error("product is not available in this shop");
  const next = copy(state);
  const basket = next.baskets[currentShop];
  const line = basket.find((candidate) => candidate.productId === productId);
  const current = line?.quantity ?? 0;
  const quantity = Math.max(0, current + delta);
  if (line && quantity === 0) basket.splice(basket.indexOf(line), 1);
  else if (line) line.quantity = quantity;
  else if (quantity > 0) basket.push({ productId, quantity });
  assertBasketStock(next, currentShop);
  next.updatedAt = new Date().toISOString();
  return next;
}

export function replaceBasket(state, value, lines) {
  validateState(state);
  const currentShop = shop(value);
  if (!Array.isArray(lines)) throw new TypeError("basket lines must be an array");
  const next = copy(state);
  next.baskets[currentShop] = lines.map((line) => ({
    productId: text(line.productId, "productId", 100),
    quantity: integer(line.quantity, "basket quantity", 1)
  }));
  validateState(next);
  assertBasketStock(next, currentShop);
  next.updatedAt = new Date().toISOString();
  return next;
}

export function clearBasket(state, value) {
  validateState(state);
  const next = copy(state);
  next.baskets[shop(value)] = [];
  next.updatedAt = new Date().toISOString();
  return next;
}

export function completeApprovedSale(state, input) {
  validateState(state);
  const currentShop = shop(input.shop);
  const summary = basketSummary(state, currentShop);
  if (!summary.ready) throw new Error("basket is not ready to complete");
  if (input.staffConfirmedApproved !== true) throw new Error("staff must confirm the S710 showed Approved");
  const id = text(input.saleId, "saleId", 100);
  if (state.sales.some((sale) => sale.id === id)) throw new Error("sale ID has already been used");
  const occurredAt = instant(input.occurredAt, "occurredAt");
  const next = copy(state);
  const sale = {
    id,
    occurredAt,
    deviceId: next.device.id,
    shop: currentShop,
    lines: summary.lines.map((line) => ({
      productId: line.product.id,
      inventoryId: line.product.inventoryId,
      sku: line.product.sku,
      name: line.product.name,
      detail: line.product.detail,
      reportCategory: reportCategoryForProduct(line.product),
      unit: line.product.unit,
      quantity: line.quantity,
      stockUse: line.product.stockUse,
      unitPricePence: line.product.pricePence,
      lineTotalPence: line.lineTotalPence
    })),
    totalPence: summary.totalPence,
    payment: { mode: "STRIPE_S710_STANDALONE", evidence: "STAFF_CONFIRMED_APPROVED", providerReference: null },
    status: "COMPLETED"
  };
  for (const line of sale.lines) {
    const consumed = line.stockUse * line.quantity;
    const resultingStock = next.inventory[line.inventoryId] - consumed;
    if (resultingStock < 0) throw new Error("sale would make stock negative");
    next.inventory[line.inventoryId] = resultingStock;
    next.movements.push({
      id: id + "-" + line.productId,
      productId: line.productId,
      inventoryId: line.inventoryId,
      kind: "SALE_CONSUMED",
      delta: -consumed,
      resultingStock,
      occurredAt,
      reason: "Completed staff-confirmed S710 sale"
    });
  }
  next.sales.push(sale);
  next.baskets[currentShop] = [];
  next.updatedAt = occurredAt;
  return next;
}

export function countStock(state, input) {
  validateState(state);
  const product = state.catalog.find((candidate) => candidate.id === input.productId);
  if (!product) throw new Error("product was not found");
  const quantity = integer(input.quantity, "quantity");
  const occurredAt = instant(input.occurredAt, "occurredAt");
  const next = copy(state);
  const previous = next.inventory[product.inventoryId];
  next.inventory[product.inventoryId] = quantity;
  next.movements.push({
    id: text(input.movementId, "movementId", 100),
    productId: product.id,
    inventoryId: product.inventoryId,
    kind: "COUNTED",
    delta: quantity - previous,
    resultingStock: quantity,
    occurredAt,
    reason: text(input.reason ?? "Physical count", "reason", 100)
  });
  next.updatedAt = occurredAt;
  return next;
}

export function saveProduct(state, input) {
  validateState(state);
  const product = normaliseProduct(input.product);
  const occurredAt = instant(input.occurredAt, "occurredAt");
  const next = copy(state);
  const index = next.catalog.findIndex((candidate) => candidate.id === product.id);
  if (next.catalog.some((candidate) => candidate.id !== product.id && candidate.sku === product.sku)) throw new Error("SKU is already in use");

  if (index >= 0) {
    const previous = next.catalog[index];
    if (previous.shop !== product.shop && next.baskets[previous.shop].some((line) => line.productId === product.id)) throw new Error("clear this product from the basket before moving shops");
    if (previous.inventoryId !== product.inventoryId) throw new Error("inventory pools cannot be changed from the weekend operations screen");
    next.catalog[index] = { ...product, openingStock: previous.openingStock };
  } else {
    next.catalog.push(product);
    if (next.inventory[product.inventoryId] == null) {
      next.inventory[product.inventoryId] = product.openingStock;
      next.movements.push({
        id: "opening-" + product.inventoryId,
        productId: product.id,
        inventoryId: product.inventoryId,
        kind: "OPENING_COUNT",
        delta: product.openingStock,
        resultingStock: product.openingStock,
        occurredAt,
        reason: "Product added"
      });
    }
  }
  normaliseCatalog(next.catalog);
  next.updatedAt = occurredAt;
  return next;
}

export function salesReport(state) {
  validateState(state);
  const products = new Map(state.catalog.map((product) => [product.id, normaliseProduct(product)]));
  const completedSales = state.sales.filter((sale) => sale.status === "COMPLETED");
  const shopAggregates = new Map(SHOPS.map((currentShop) => [currentShop, {
    shop: currentShop,
    revenuePence: 0,
    units: 0,
    saleIds: new Set(),
    productIds: new Set()
  }]));
  const categoryAggregates = new Map();
  const productAggregates = new Map();
  const totalProductIds = new Set();
  let revenuePence = 0;
  let units = 0;

  for (const sale of completedSales) {
    const currentShop = shop(sale.shop);
    const saleId = text(sale.id, "sale.id", 100);
    const saleTotalPence = integer(sale.totalPence, "sale.totalPence");
    const shopAggregate = shopAggregates.get(currentShop);
    shopAggregate.revenuePence += saleTotalPence;
    shopAggregate.saleIds.add(saleId);
    revenuePence += saleTotalPence;

    for (const line of sale.lines) {
      const productId = text(line.productId, "sale line productId", 100);
      const quantity = integer(line.quantity, "sale line quantity", 1);
      const lineTotalPence = integer(line.lineTotalPence, "sale line total");
      const catalogProduct = products.get(productId);
      const reportCategory = typeof line.reportCategory === "string" && line.reportCategory.trim()
        ? line.reportCategory.trim().slice(0, 40)
        : (catalogProduct?.reportCategory ?? reportCategoryForProduct({ id: productId, shop: currentShop }));
      const productKey = currentShop + "|" + productId;
      const categoryKey = currentShop + "|" + reportCategory;

      units += quantity;
      totalProductIds.add(productId);
      shopAggregate.units += quantity;
      shopAggregate.productIds.add(productId);

      if (!categoryAggregates.has(categoryKey)) categoryAggregates.set(categoryKey, {
        shop: currentShop,
        category: reportCategory,
        revenuePence: 0,
        units: 0,
        saleIds: new Set(),
        productIds: new Set()
      });
      const categoryAggregate = categoryAggregates.get(categoryKey);
      categoryAggregate.revenuePence += lineTotalPence;
      categoryAggregate.units += quantity;
      categoryAggregate.saleIds.add(saleId);
      categoryAggregate.productIds.add(productId);

      if (!productAggregates.has(productKey)) productAggregates.set(productKey, {
        productId,
        sku: typeof line.sku === "string" ? line.sku : (catalogProduct?.sku ?? ""),
        name: typeof line.name === "string" && line.name.trim() ? line.name : (catalogProduct?.name ?? "Unknown product"),
        detail: typeof line.detail === "string" ? line.detail : (catalogProduct?.detail ?? ""),
        shop: currentShop,
        category: reportCategory,
        revenuePence: 0,
        units: 0,
        saleIds: new Set()
      });
      const productAggregate = productAggregates.get(productKey);
      productAggregate.revenuePence += lineTotalPence;
      productAggregate.units += quantity;
      productAggregate.saleIds.add(saleId);
    }
  }

  const finalize = (aggregate) => ({
    ...aggregate,
    transactions: aggregate.saleIds.size,
    distinctProducts: aggregate.productIds?.size ?? 1,
    saleIds: undefined,
    productIds: undefined
  });
  const shopOrder = new Map(SHOPS.map((value, index) => [value, index]));
  const occurredTimes = completedSales.map((sale) => sale.occurredAt).filter((value) => typeof value === "string" && Number.isFinite(Date.parse(value))).sort();

  return {
    source: "THIS_IPAD_ONLY",
    device: { id: state.device.id, label: state.device.label },
    totals: {
      revenuePence,
      units,
      transactions: completedSales.length,
      distinctProducts: totalProductIds.size,
      averageSalePence: completedSales.length ? Math.round(revenuePence / completedSales.length) : 0
    },
    period: {
      firstSaleAt: occurredTimes[0] ?? null,
      lastSaleAt: occurredTimes.at(-1) ?? null
    },
    shops: SHOPS.map((currentShop) => finalize(shopAggregates.get(currentShop))),
    categories: [...categoryAggregates.values()]
      .map(finalize)
      .sort((left, right) => (shopOrder.get(left.shop) - shopOrder.get(right.shop)) || (right.revenuePence - left.revenuePence) || left.category.localeCompare(right.category)),
    products: [...productAggregates.values()]
      .map((aggregate) => ({
        ...aggregate,
        transactions: aggregate.saleIds.size,
        saleIds: undefined
      }))
      .sort((left, right) => (right.units - left.units) || (right.revenuePence - left.revenuePence) || left.name.localeCompare(right.name))
  };
}

function csvCell(value) {
  const raw = String(value ?? "");
  return /[",\n]/.test(raw) ? "\"" + raw.replaceAll("\"", "\"\"") + "\"" : raw;
}

export function salesCsv(state) {
  validateState(state);
  const rows = [["sale_id", "timestamp", "device_id", "shop", "sku", "product", "unit", "quantity", "unit_price_pence", "line_total_pence", "sale_total_pence", "payment_evidence"]];
  for (const sale of state.sales) for (const line of sale.lines) rows.push([
    sale.id, sale.occurredAt, sale.deviceId, sale.shop, line.sku, line.name, line.unit, line.quantity,
    line.unitPricePence, line.lineTotalPence, sale.totalPence, sale.payment.evidence
  ]);
  return rows.map((row) => row.map(csvCell).join(",")).join("\n");
}
