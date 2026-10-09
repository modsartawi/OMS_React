# HITL log — ticket 452 (Material detail, spec 2544)

## Contract gap: the envelope's error entries are abbreviated in the contract
**Decision taken:** Same ruling as 451/453/454: the stub and the client use the REAL SIS.Api envelope `errors: [{ errorCode, errorMessage, internalErrorCode }]`. MAT-00001 and MAT-00004 are branched on only through `apiErrorCode` (`isStockUnavailable` for MAT-00004); any text is shown only through `apiErrorMessage`.
**Why:** The contract abbreviates the shared estate envelope; every SIS.Api door emits the long form.
**Revisit if:** the MaterialWeb doors ever emit `{ code, message }`. MAT-00001 would then show the generic "could not be loaded" banner instead of the not-found page.

## Q: The Stock tab shows "every store whose ATP ≠ 0", but the door drops only cells where EVERY quantity is zero
**Decision taken:** With "show zero stores" off, the tab also leaves out the cells the door returns with ATP 0 (for example SAP 15, OMS -15). With the toggle on (`includeZero: true`), every cell the door returns is shown. A negative ATP is not zero and is shown. The rows are sorted by ATP, highest first, then by store code. The filter is `detailStockRows`, under vitest.
**Why:** The ticket and spec story 20 both say "where it is not zero" about ATP, and the toggle is the way to see the rest.
**Revisit if:** the owner wants an ATP-0 store with SAP stock (the "why does SAP say 15?" case) visible by default. Then drop the client filter and let the door's rule stand alone.

## Q: Which master fields are "info" fields (hidden when `hasInfo: false`)?
**Decision taken:** A field is `info` when the `ItemInfo` entity carries it (`Sartawi.Retail.Data/ItemInfo.cs`, read-only): the levels, vendor (+ AR name), brand, manufacturer, status, manufacture code/name, SFDA, Wasfaty, house brand, OTC list, grade, ABC, category manager, purchase group, item class and created date. The number, descriptions, type, flags, price, material group, UoMs, tracking and temperature are the material's own. The map is `MASTER_SOURCE`, typed with `satisfies Record<keyof MaterialMaster, …>`, so a new contract field fails the typecheck until it is placed.
**Why:** The contract only lists "level, vendor, brand and status" as nulled. The entity is the evidence for the rest.
**Revisit if:** BackOffice 2547's projection sources a field differently (for example `createdDate` from `Item`). Then a value would be hidden on a material without ItemInfo. The drive would not show this, because it stubs the contract.

## Q: What exactly replaces the "empty groups" when `hasInfo: false`?
**Decision taken:** Every ItemInfo row is left out. A group left with no rows (only Hierarchy, today) is not drawn. ONE "Not in material info" note stands where that group stood. Groups that still hold the material's own fields (Identity: type, material group; Commercial: price; Logistics: all) keep those rows. The header also carries a "Not in material info" badge (that is where `hasInfo` itself is shown). There is no status badge, because status is an info field.
**Why:** The ticket says "in place of the empty groups", and the material's own fields are still real data.
**Revisit if:** the owner wants the note to replace Identity and Commercial wholesale.

## Q: Group membership for fields the ticket does not name
**Decision taken:** Identity: material type, material group, material class, SFDA, Wasfaty, OTC list, created date. Hierarchy: A–E. Commercial: vendor (`200345 · GSK` pair), vendor AR name, brand, manufacturer, manufacturer code (`M100 · NAME` pair), house brand, price ex VAT, ABC class, grade, category manager, purchase group. Logistics: base/sales/purchase UoM, tracking type, temperature. `itemType` and `trackingType` are shown as the raw numbers (no code table is in the contract).
**Why:** The ticket names only some fields per group; the rest went where a buyer or a logistics user would look.
**Revisit if:** the owner wants a fifth "Classification" group, or labels for the type and tracking codes.

## Q: The level pair separator
**Decision taken:** `formatPair(code, description)` → `A006 · MEDICINE` (middle dot), isolated once with `Ltr`, as 451 ruled. The ticket's en dash is replaced.
**Why:** It is the wave ruling and the bidi rule.
**Revisit if:** never, short of a bidi helper change.

## Q: Is the Batches grid exportable too?
**Decision taken:** Yes. All three tab grids (Barcodes, Batches, Stock) carry "Export to Excel" through `@/core/util/grid-xlsx`. Files are named `material-<no>-<tab>-<stamp>.xlsx`. Barcode, batch, vendor batch and store code are written as text.
**Why:** The ticket names Barcodes and Stock; the spec says "Every grid exports to Excel".
**Revisit if:** the owner wants Batches without the button.

## Q: The back link — history back, or `/materials`?
**Decision taken:** A plain link to `/materials` ("Back to material search"), both in the header and on the not-found page. Browser Back still returns to the exact search (451 pushes on opening a row).
**Why:** A deep-linked or pasted detail has no search behind it in history; a link always lands.
**Revisit if:** users expect the button to restore their filters (then use `navigate(-1)` when the history entry is the search).

## Q: The simulator param when it repeats, and when to show the link
**Decision taken:** `simulationMaterialParam` takes the first non-blank `?material=`, trimmed, and pre-adds ONE row (qty 1, EA) at the initial state only; it never processes. Without the param the simulator opens with its one empty row, exactly as before (drive check 9 proves both). The detail always shows the link; the simulator guards itself on its own grant (wave ruling). No key was added to the `simulation` namespace (`tools/check-sim-keys.mjs` 8/8).
**Why:** The wave ruling; the link carries only one material.
**Revisit if:** a later screen wants to pre-add a basket (then accept every value).

## Q: The Stock tab's store choice
**Decision taken:** `stores: null`, `includeClosed: false` (closed stores left out, no toggle for them), `includeZero` from "show zero stores", default off. The request goes through 453's `stockRequest` and `materialStockQuery` in `@/core/materials/stock`. The MAT-00004 panel is 453's `StockUnavailable`.
**Why:** The ticket says "one material and `stores: null`"; spec story 20 says "every open store".
**Revisit if:** the owner wants closed stores reachable from the detail.

## Note: the 451 drive's check 8
`tools/materials-search-drive.mjs` check 8 now waits for the detail page (`[data-material-detail="0100777"]`) instead of the deleted placeholder. The drive passes 74/74. The placeholder's `placeholder.*` keys are removed from `materials-search` EN and AR, and a test asserts they are gone.

## Q: Code-review findings kept as built
**Decision taken:** Four findings were not changed. (1) The simulator prefill is 1 EA even for a pack-sold material: the wave ruling says "qty 1, EA", and the link carries only the number. (2) `?material=` stays in the simulator's URL after Clear all, so a reload pre-adds it again: removing it would change Clear all, which the ruling says stays unchanged. (3) "Show zero stores" re-asks the door: the ticket says the toggle "sets `includeZero`". (4) `figure = n.toLocaleString('en-US')` is now in four Materials pages; moving it to `@/core` would edit three other features' files, so it is left as a follow-up (454 noted it first).
Fixed instead: a `key` per tab grid (Barcodes and Batches no longer share one grid), the status badge isolated with `Ltr` (a status is a code), no default expiry sort on Batches (a null expiry would have sorted first), and the quantity cells use core `formatNumber`.
**Why:** The rulings and the ticket text win over taste. The rest were real defects.
**Revisit if:** the owner wants the prefill to use the material's sales UoM. That would mean a second param, plus a contract for what the simulator does with it.

## Q: Standards/spec-review findings
**Decision taken:** Fixed: the label keys `master.fields.itemType/itemClass/itemGrade` are now `materialType/materialClass/materialGrade` (the vocabulary ruling; the wire fields keep their contract names). The grid's quantity formatter is renamed `quantity` (it was a second, different `figure`). The Stock grid has no column sort, so `detailStockRows` is the ONE source of the ATP order. Kept: (1) `detailStockColumns` is close to 453's `stockColumns`, but moving both to `@/core/materials` would edit 453's files, so it is a follow-up together with `figure`; (2) `simulatorHref` spells `material` again instead of sharing the simulator's constant, because the wave rules the link is "a plain path string, no import from the simulation feature"; (3) blocked/serialised are header badges (shown only when true), not Master rows, because the ticket puts them in the header.
**Why:** The vocabulary ruling and the single-order point were real; the rest are rulings, or edits outside this slice.
**Revisit if:** the owner wants "Not blocked" / "Not serialised" stated explicitly on the Master tab.
