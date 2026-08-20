# Architects Holiday Open Day POS

A dependency-free, offline-first iPad calculator for the Open Day Bar and Merch counters.

The interface follows the Lobby Host Calm UI system. The only Architects Holiday identity asset used in the interface is the supplied horizontal white wordmark.

## Weekend workflow

1. Open Operations on each iPad and give it a clear label.
2. Check the physical opening counts. For wines, edit the bottle row; bottle, 125ml and 175ml buttons share that stock.
3. Leave one iPad in Bar and the other in Merch. Each remembers its last mode.
4. Use the labelled product groups to find the item, then tap its button to build the order. Supplier names are highlighted and serving formats such as Bottle, 125ml glass and 175ml glass use a separate badge. Use Undo for the last basket change or Clear to start again.
5. Tap Take payment and enter the exact displayed total on the Stripe Card Reader.
6. Only after the reader says Approved, tap Payment approved · complete sale.
7. Wait for the centred Sale completed confirmation, which shows the order total for 2.4 seconds.
8. Open Reports at any time to see that iPad's revenue, units, distinct products and completed transactions.
9. Export the sales CSV and full JSON backup from each iPad at close.

The supplied catalogue contains 24 Bar buttons and 12 Merch buttons. Bar products are grouped into Beer, Wine, Sparkling, Non-alcoholic, Soft drinks and Water. Merchandise places Caps & bags and Small goods before T-shirts, with Tote Bag before Cap. Product grids use three columns above mobile width, and the sparkling rosé pair starts on its own row. Products with no physical stock remain visible but disabled. A completed sale snapshots the name, SKU and price, appends stock movements, and clears that counter’s basket.

After each completed sale, the confirmation screen appears above the cleared basket and briefly blocks further taps so staff can see that the sale, stock movement and report update have finished.

Reports is read-only. It shows event totals, Bar and Merch counter totals, Beer, Wine, Alcohol-free, Soft drinks & water, Apparel, Bags and Small goods categories, plus a ranked product table. Revenue uses the price saved with each completed sale, so later catalogue edits do not rewrite historic totals. Products means distinct sale buttons/SKUs; units means the quantity sold.

## Important weekend boundary

Data is stored in that browser on that iPad only. The two iPads do not synchronize. This is reliable offline and suits one Bar plus one Merch counter, but if both iPads sell from the same physical counter their remaining counts will diverge. Take a physical count before relying on either device in that situation.

Reports is also per iPad. For the complete event result, record the totals from both Reports pages and add them together. Do not treat either page as a Stripe settlement report: it contains locally completed, staff-confirmed sales and does not include S710 refunds, reversals or corrections.

The app has no Stripe credentials and cannot see whether the S710 succeeded. Its payment status is a staff confirmation, not provider evidence. Refunds and reader corrections must be handled on the S710 or in Stripe separately, followed by a physical stock count in Operations.

Wine bottle and glass formats do share one local inventory pool on each iPad. A 750ml bottle sale consumes 750ml; glass sales consume 125ml or 175ml from the same pool.

## Local test

From this directory on Windows:

- `npm.cmd test`
- `npm.cmd run serve`
- open `http://127.0.0.1:4173`

The approved public HTTPS deployment is https://architects-holiday.github.io/open-day-pos/. Open it once online on each iPad, then use Add to Home Screen. After the first successful load, the service worker caches the app for offline use on that device.

## Future extension seam

The current domain already separates:

- catalogue, integer-pence prices and selling formats;
- physical inventory pools and per-format stock consumption;
- per-device Bar and Merch baskets;
- completed sale snapshots;
- append-only stock movements;
- local persistence and export;
- manual terminal payment evidence;
- device-local sales summaries built from immutable completed-sale snapshots.

A later full Lobby Host POS can replace local storage with a product-owned repository, add synchronized location inventory, and introduce separately approved cabin or minibar contexts. Guest identity, reservation or cabin links, live Stripe Terminal payment intents, refunds, tax treatment, permissions and durable audit storage remain deliberately absent from this weekend version.
