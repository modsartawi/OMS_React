# HITL log — ticket 451 (Material search, spec 2544)

## Contract gap: the envelope's error entries are abbreviated in the contract
**Decision taken:** Built and stubbed against the REAL SIS.Api envelope `@/core/api` reads —
`errors: [{ errorCode, errorMessage, internalErrorCode }]` — not the contract's
`errors: [{ code, message }]`. MAT-00006 is branched on only through `apiErrorCode`, and its text is
shown only through `apiErrorMessage`. The drive's `envelope()` is copied from
`tools/coupon-import-delete-drive.mjs`.
**Why:** The contract abbreviates the shared estate envelope; every SIS.Api door emits the long form.
**Revisit if:** the MaterialWeb doors ever emit `{ code, message }` — then `apiErrorCode` reads null
and MAT-00006 would fall to the general failure banner (ticket 455's live drive would show it).

## Q: `resolvedAs: "material"` — chip or no chip?
**Decision taken:** No chip for `material` (nor `text`, nor `null`). Chips only for `gs1`, `barcode`, `code`, as the ticket lists.
**Why:** The contract's own rules never produce `material` (an all-digit token that equals a material number is still `text`), and a material number typed is already what the row shows — nothing to explain.
**Revisit if:** the server starts answering `material` and the owner wants it called out.

## Q: How does the chip read when the answer holds no material, or several?
**Decision taken:** One material → "Barcode X is material Y". None or several (a shared SFDA code; filters that exclude the resolved hit) → "… matched N materials" (a `…Many` plural key, all six Arabic forms).
**Why:** "is material Y" would be false with two rows; "→ 101234" glued between values would reverse under RTL, so it is a sentence with each value in a `<Trans>` slot.
**Revisit if:** the owner prefers listing the materials in the chip.

## Q: The "item type" filter — what does the user pick from, and what is it called?
**Decision taken:** A free-entry multi-value box (type a whole number, Enter) sending repeated `itemType` ints; labelled **"Material type"** (column "Type").
**Why:** The contract gives `itemType` as a repeatable int with NO Facets kind, so there is no list to offer; the vocabulary ruling bans "item" in labels.
**Revisit if:** the server adds an `itemType` facet kind (then make it a typeahead like the others), or the owner says "Material type" is confused with SAP's material type.

## Q: Where does the ONE shared 50-material refusal key live?
**Decision taken:** `materials-search:shared.stockCapRefused`, named by `STOCK_CAP_REFUSAL_KEY` in `src/core/materials/stock-cap.ts` beside `STOCK_MATERIAL_CAP = 50` and `stockCheckHref()`. 453 renders the same key through `<Trans>` with `values={{ max }}` and an `<n>` slot.
**Why:** A core module has no namespace of its own; `materials-search` is the area's first namespace and already owns the area's shared words (the menu labels). `common` has no Arabic file.
**Revisit if:** the area grows a core namespace (`materials`), then move it there in one place.

## Q: Load each level's options eagerly, or on demand?
**Decision taken:** A level's `MaterialWeb/Levels` list is asked while its picker is open, or while that level holds a choice (so a no-longer-offered choice can be dropped). The cascade drop runs in ONE effect over all five levels, and only against a settled URL.
**Why:** Five calls on every landing for lists nobody opened is waste; the cascade only needs the lists of levels that hold a choice.
**Revisit if:** the owner wants the lists pre-warmed.

## Q: Push or replace history on a filter change?
**Decision taken:** Replace. Opening a material from the grid is a push, so Back from the detail returns to the same search.
**Why:** Stepping Back through every tick of a filter is noise; the shareable link is the address either way.
**Revisit if:** users expect Back to undo a filter.

## Q: Does a filter change search at once, or wait for Search?
**Decision taken:** The box commits on Search/Enter; every other filter (levels, facets, blocked, serialised, type, take) searches at once, because it is written straight to the URL and the URL is the search.
**Why:** The URL is the single source of truth; a draft for the filters would be a second one.
**Revisit if:** the door proves slow enough that each tick hurts.

## Q: How is a vendor shown?
**Decision taken:** As the pair `vendorNo · vendorName` (`formatPair`), isolated LTR once — in the grid (its own `LtrPairCell`, so the export has no isolates) and in the picker. The URL carries the number.
**Why:** The contract says a vendor's value is its number; a pair led by a machine value is the bidi rule's case.
**Revisit if:** the owner wants the name alone.

## Q: How is "refuse the 51st" done on the grid?
**Decision taken:** Multi-row tick boxes with NO select-all header box; a 51st tick is unticked again and the shared refusal sentence shows. Without `canCheckStock` there are no tick boxes and no button at all.
**Why:** A select-all would tick up to 500 at once past the cap.
**Revisit if:** the owner wants "tick the first 50".

## Q: Which leaf owns `/materials/:no` in the rail?
**Decision taken:** The search leaf carries `activePrefix: '/materials'`; the stock and GS1 leaves carry their own longer prefixes and win through `markedLeaf` (proven in the drive: on `/materials/stock` only Stock check is marked).
**Why:** The detail (452) is reached from the search and should keep it lit.
**Revisit if:** a session WITHOUT the stock grant deep-links `/materials/stock`: the hidden stock leaf still out-scores the search leaf, so nothing visible is marked — the `markedLeaf` caveat already documented in `menu-model.ts`.

## Q: How does the drive prove the static routes rank above `:no`?
**Decision taken:** The shared placeholder exposes `data-material-placeholder="static"` when no `:no` param matched, `"material"` when it did. The drive asserts `static` on `/materials/stock` and `/materials/gs1`, `material` on `/materials/0100777`.
**Why:** The three routes render one component, so the page alone cannot tell them apart.
**Revisit if:** 452 deletes the placeholder (it will) — 452–454's own pages then prove it.

## Q: The detail's Stock tab needs both grants — where is that predicate?
**Decision taken:** Added `canSeeMaterialStock` (search AND stock) to `src/core/materials/access.ts` with its test, for 452 to use.
**Why:** 451 owns the probe and its predicates; writing it once keeps 452 from re-reading the flags.
**Revisit if:** 452 rules the tab differently.

## Q: The level pair separator — the ticket's "code – description" or the bidi pair?
**Decision taken:** `formatPair(code, description)` → `B010 · PAIN RELIEF` (middle dot), isolated once with `Ltr`.
**Why:** The wave ruling: the A–E value is a pair led by a machine value, and `formatPair`'s ` · ` REPLACES the ticket's en dash (an en dash is the range separator in `@/core/util/bidi`).
**Revisit if:** the owner insists on the dash — it would have to become a bidi helper, never a template literal.

## Contract gap: the spec and the contract name the stock cell's fields differently
**Decision taken:** `MaterialStockCell` follows the contract (`materialNumber`, `storeCode`), not the spec's prose (`{ material, store, storeName, … }`).
**Why:** The wave makes the contract the ONLY source of wire shapes; the spec's line reads as shorthand. Raised for 453, which renders it.
**Revisit if:** BackOffice 2547 ships `material`/`store` — then the contract must be amended first and the model with it.

## Q: Scope beyond the ticket's letter (standards-review)
**Decision taken:** Kept a "Show up to" (take 200/500) select, a "Clear all" button, a status-bar count, a "Type" column (the `itemType` the filter narrows by) and double-click to open beside the material link.
**Why:** take is a ticket-named search part that needs a control to set; the rest are the repo's list-screen furniture (document payments precedent).
**Revisit if:** the owner wants the screen leaner.
