const item = (product) => ({
  inventoryId: product.id,
  stockUse: 1,
  stockDisplayDivisor: 1,
  stockDisplayUnit: product.unit,
  lowStockAt: 3,
  active: true,
  ...product
});

const wine = ({ id, sku, name, producer, pricePence, openingBottles, serveMl = 750 }) => ({
  id,
  sku,
  shop: "bar",
  name,
  detail: serveMl === 750 ? `${producer} · bottle` : `${producer} · ${serveMl}ml glass`,
  pricePence,
  openingStock: openingBottles * 750,
  unit: serveMl === 750 ? "bottle" : "glass",
  lowStockAt: serveMl === 750 ? 3 : 12,
  active: true,
  inventoryId: id.replace(/-(125|175)$/, "-bottle"),
  stockUse: serveMl,
  stockDisplayDivisor: 750,
  stockDisplayUnit: "bottle"
});

export const DEFAULT_CATALOG = Object.freeze([
  item({ id: "bar-sussex-lager", sku: "BAR-BB-LAGER", shop: "bar", name: "Sussex Lager", detail: "Brewing Brothers", pricePence: 500, openingStock: 48, unit: "can", lowStockAt: 12 }),
  item({ id: "bar-table-beer", sku: "BAR-BB-TABLE", shop: "bar", name: "Table Beer", detail: "Brewing Brothers", pricePence: 500, openingStock: 48, unit: "can", lowStockAt: 12 }),
  item({ id: "bar-stir-neipa", sku: "BAR-BB-NEIPA", shop: "bar", name: "Stir Hazy NEIPA", detail: "Brewing Brothers", pricePence: 550, openingStock: 48, unit: "can", lowStockAt: 12 }),
  item({ id: "bar-reforestation-pale", sku: "BAR-BB-REFOREST", shop: "bar", name: "Reforestation Pale", detail: "Brewing Brothers", pricePence: 500, openingStock: 48, unit: "can", lowStockAt: 12 }),
  item({ id: "bar-1066-pale", sku: "BAR-BB-1066", shop: "bar", name: "1066 Pale", detail: "Brewing Brothers", pricePence: 600, openingStock: 48, unit: "can", lowStockAt: 12 }),

  wine({ id: "bar-endgrain-bottle", sku: "BAR-ENDGRAIN-BTL", name: "Endgrain", producer: "Tillingham", pricePence: 3000, openingBottles: 18 }),
  wine({ id: "bar-endgrain-125", sku: "BAR-ENDGRAIN-125", name: "Endgrain", producer: "Tillingham", pricePence: 800, openingBottles: 18, serveMl: 125 }),
  wine({ id: "bar-endgrain-175", sku: "BAR-ENDGRAIN-175", name: "Endgrain", producer: "Tillingham", pricePence: 1100, openingBottles: 18, serveMl: 175 }),
  wine({ id: "bar-rose-bottle", sku: "BAR-ROSE-BTL", name: "Rosé", producer: "Tillingham", pricePence: 3000, openingBottles: 18 }),
  wine({ id: "bar-rose-125", sku: "BAR-ROSE-125", name: "Rosé", producer: "Tillingham", pricePence: 800, openingBottles: 18, serveMl: 125 }),
  wine({ id: "bar-rose-175", sku: "BAR-ROSE-175", name: "Rosé", producer: "Tillingham", pricePence: 1100, openingBottles: 18, serveMl: 175 }),
  wine({ id: "bar-r-nv-bottle", sku: "BAR-RNV-BTL", name: "R (NV)", producer: "Tillingham", pricePence: 3000, openingBottles: 18 }),
  wine({ id: "bar-r-nv-125", sku: "BAR-RNV-125", name: "R (NV)", producer: "Tillingham", pricePence: 800, openingBottles: 18, serveMl: 125 }),
  wine({ id: "bar-r-nv-175", sku: "BAR-RNV-175", name: "R (NV)", producer: "Tillingham", pricePence: 1100, openingBottles: 18, serveMl: 175 }),

  wine({ id: "bar-tilsmore-vintage-bottle", sku: "BAR-TILSMORE-V-BTL", name: "Vintage Sparkling", producer: "Tilsmore", pricePence: 3500, openingBottles: 18 }),
  wine({ id: "bar-tilsmore-vintage-125", sku: "BAR-TILSMORE-V-125", name: "Vintage Sparkling", producer: "Tilsmore", pricePence: 900, openingBottles: 18, serveMl: 125 }),
  wine({ id: "bar-tilsmore-rose-bottle", sku: "BAR-TILSMORE-R-BTL", name: "Rosé Sparkling", producer: "Tilsmore", pricePence: 3500, openingBottles: 6 }),
  wine({ id: "bar-tilsmore-rose-125", sku: "BAR-TILSMORE-R-125", name: "Rosé Sparkling", producer: "Tilsmore", pricePence: 900, openingBottles: 6, serveMl: 125 }),

  item({ id: "bar-dalston-elderflower", sku: "BAR-DALSTON-ELDER", shop: "bar", name: "Elderflower", detail: "Dalston Press", pricePence: 300, openingStock: 48, unit: "can", lowStockAt: 12 }),
  item({ id: "bar-dalston-ginger", sku: "BAR-DALSTON-GINGER", shop: "bar", name: "Ginger Beer", detail: "Dalston Press", pricePence: 300, openingStock: 48, unit: "can", lowStockAt: 12 }),
  item({ id: "bar-club-mera", sku: "BAR-CLUB-MERA", shop: "bar", name: "Non-alcoholic Aperitivo", detail: "Club Mera", pricePence: 700, openingStock: 120, unit: "serve", lowStockAt: 24 }),
  item({ id: "bar-marlish-still", sku: "BAR-MARLISH-STILL", shop: "bar", name: "Still Water", detail: "Marlish", pricePence: 250, openingStock: 48, unit: "bottle", lowStockAt: 12 }),
  item({ id: "bar-marlish-sparkling", sku: "BAR-MARLISH-SPARK", shop: "bar", name: "Sparkling Water", detail: "Marlish", pricePence: 250, openingStock: 48, unit: "bottle", lowStockAt: 12 }),
  item({ id: "bar-lucky-saint", sku: "BAR-LUCKY-SAINT", shop: "bar", name: "Lucky Saint", detail: "Alcohol-free beer", pricePence: 450, openingStock: 48, unit: "bottle", lowStockAt: 12 }),

  item({ id: "merch-mens-tshirt-s", sku: "MERCH-MTS-S", shop: "merch", name: "Men’s T-shirt", detail: "Small", pricePence: 4000, openingStock: 10, unit: "item", lowStockAt: 2 }),
  item({ id: "merch-mens-tshirt-m", sku: "MERCH-MTS-M", shop: "merch", name: "Men’s T-shirt", detail: "Medium", pricePence: 4000, openingStock: 5, unit: "item", lowStockAt: 2 }),
  item({ id: "merch-mens-tshirt-l", sku: "MERCH-MTS-L", shop: "merch", name: "Men’s T-shirt", detail: "Large", pricePence: 4000, openingStock: 2, unit: "item", lowStockAt: 1 }),
  item({ id: "merch-mens-tshirt-xl", sku: "MERCH-MTS-XL", shop: "merch", name: "Men’s T-shirt", detail: "Extra large", pricePence: 4000, openingStock: 6, unit: "item", lowStockAt: 2 }),
  item({ id: "merch-womens-tshirt-s", sku: "MERCH-WTS-S", shop: "merch", name: "Women’s T-shirt", detail: "Small", pricePence: 4500, openingStock: 0, unit: "item", lowStockAt: 1 }),
  item({ id: "merch-womens-tshirt-m", sku: "MERCH-WTS-M", shop: "merch", name: "Women’s T-shirt", detail: "Medium", pricePence: 4500, openingStock: 0, unit: "item", lowStockAt: 1 }),
  item({ id: "merch-womens-tshirt-l", sku: "MERCH-WTS-L", shop: "merch", name: "Women’s T-shirt", detail: "Large", pricePence: 4500, openingStock: 4, unit: "item", lowStockAt: 1 }),
  item({ id: "merch-womens-tshirt-xl", sku: "MERCH-WTS-XL", shop: "merch", name: "Women’s T-shirt", detail: "Extra large", pricePence: 4500, openingStock: 0, unit: "item", lowStockAt: 1 }),
  item({ id: "merch-cap", sku: "MERCH-CAP", shop: "merch", name: "Cap", detail: "One size", pricePence: 3500, openingStock: 25, unit: "item", lowStockAt: 5 }),
  item({ id: "merch-tote", sku: "MERCH-TOTE", shop: "merch", name: "Tote Bag", detail: "One size", pricePence: 5500, openingStock: 25, unit: "item", lowStockAt: 5 }),
  item({ id: "merch-pencil", sku: "MERCH-PENCIL", shop: "merch", name: "Pencil", detail: "Architects Holiday", pricePence: 250, openingStock: 30, unit: "item", lowStockAt: 6 }),
  item({ id: "merch-badge", sku: "MERCH-BADGE", shop: "merch", name: "Badge", detail: "Architects Holiday", pricePence: 500, openingStock: 20, unit: "item", lowStockAt: 5 })
]);

export function cloneDefaultCatalog() {
  return DEFAULT_CATALOG.map((product) => ({ ...product }));
}
