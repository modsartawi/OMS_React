# HITL log — ticket 453 (Stock check, spec 2544)

## Contract gap: the envelope's error entries are abbreviated in the contract
**Decision taken:** Same ruling as 451 (see HITL-451): the stub and the client use the REAL SIS.Api envelope `errors: [{ errorCode, errorMessage, internalErrorCode }]`. MAT-00002/3/4 are branched on only through `apiErrorCode` (`isStockUnavailable` in `@/core/materials/stock`), and their text is shown only through `apiErrorMessage`.
**Why:** The contract abbreviates the shared estate envelope; every SIS.Api door emits the long form.
**Revisit if:** the MaterialWeb doors ever emit `{ code, message }`. MAT-00004 would then fall to the general failure banner. That is still not an empty grid, but it loses the "unavailable" wording.

## Contract gap: the stock cell carries no material description
**Decision taken:** The ticket lists a "description" column, but the contract's Stock cell is `{ materialNumber, storeCode, storeName, atp, sapUnrestricted, pos, oms, updatedAt }`, with no description. The grid has no description column. Nothing is invented, and no Search/Material call is made to fill it (that would need the search grant and up to 50 extra calls).
**Why:** The contract is the ONLY source of wire shapes.
**Revisit if:** BackOffice 2548 adds `description` / `description2` to the cell. Amend the contract first, then add the column.

## Q: Is "All stores" on or off when the page opens?
**Decision taken:** Off. Check stock stays disabled, with the hint "Choose stores, add a set, or tick All stores", until a store, a set or All stores is chosen.
**Why:** 50 materials × every store is the heaviest question the door takes. It is asked for on purpose, not by default.
**Revisit if:** owners mostly arrive from "check stock for selected" wanting every store; then default it on.

## Q: An empty list: send it and show MAT-00003, or refuse on the client?
**Decision taken:** Check stock is disabled while the box holds no material, with a hint. A MAT-00003 (or MAT-00002) from the door is still handled: it shows inline under the box in the server's words, and is cleared once the box is edited.
**Why:** A call that can only be refused is not worth making. The inline branch still covers a server that disagrees with the client.
**Revisit if:** the owner wants the server's sentence to be what a user sees for an empty list.

## Q: The 51st material: truncate to 50, or refuse the whole check?
**Decision taken:** Refuse. `parseMaterialList` keeps the first 50 and lists the rest as `refused`. While `refused` is non-empty, the shared refusal sentence (`STOCK_CAP_REFUSAL_KEY`, 451's ONE key) shows under the box and Check stock is disabled. The cap counts DISTINCT materials, so 50 pasted twice is allowed.
**Why:** Silently dropping the tail would answer a question the user did not ask.
**Revisit if:** the owner prefers "check the first 50".

## Q: Where do the MAT-00004 panel's words live?
**Decision taken:** `materials-search:shared.stockUnavailableTitle / Body / Retry`, beside 451's `shared.stockCapRefused`. The panel is `@/core/materials/StockUnavailable.tsx`, so 452's Stock tab reuses it with no keys of its own. The two Arabic strings mirror them.
**Why:** 451 ruled that `materials-search` holds the area's shared words. A core component cannot own a namespace without a second registration.
**Revisit if:** the area grows a core `materials` namespace. Move both shared blocks there together.

## Q: What is a store's "name" in the finder and on a chip?
**Decision taken:** `StoreDetailModel` (the existing `SdDocument/StoreDetails` lookup) has no name field. A store picked from it is named by `storeAddress`, falling back to `city`. A store added through a set uses that set's `storeName`. The finder matches every typed word against code, city, region and address. A chip shows `code · name` as ONE pair (`formatPair`, isolated once with `Ltr`).
**Why:** The ticket says to use the existing lookup, and the address is what the estate's other store pickers show.
**Revisit if:** the lookup gains a real store name.

## Q: A set added before "Include closed stores" was ticked
**Decision taken:** A set is resolved (`StoreSets/{kind}/{value}?includeClosed=`) with the toggle as it is at the moment of adding, and its stores become chips. Ticking the toggle later does not re-resolve chips already there. The request still sends the current `includeClosed`. The finder offers the whole lookup, closed stores included, because the lookup has no closed flag. The door filters by `includeClosed` either way.
**Why:** The chips are explicit store choices the user can see and remove. Silently re-resolving them would change a list the user built.
**Revisit if:** users expect the toggle to re-expand sets already added. Then remember each set's kind/value and re-ask it on toggle.

## Q: "Grouped or sortable by material"
**Decision taken:** Sortable. AG Grid Community has no row grouping, so every column sorts and the grid opens sorted by material (ascending), then ATP (descending), which is the door's own order.
**Why:** Row grouping is Enterprise. The ticket offers "or".
**Revisit if:** the owner wants visual grouping. A material-band row class is the Community-only way to do it.

## Q: The 451 drive asserted the placeholder on /materials/stock
**Decision taken:** `tools/materials-search-drive.mjs` check 8 now asserts that the stock check's own page renders on `/materials/stock` (no placeholder, box prefilled `101234\n0100777`) instead of `data-material-placeholder="static"`.
**Why:** 451's HITL foresaw this ("452–454's own pages then prove it"). The static-route proof now lives in both drives.
**Revisit if:** never; 454 does the same for `/materials/gs1`.

## Note: a flaky check in the 451 drive
`materials-search-drive.mjs` check 5 ("the door got the URL's own query string") failed once out of three runs here. The other two runs were 74/74. It is a timing race in 451's own filter-URL test, untouched by 453, and is noted for 451's owner.
