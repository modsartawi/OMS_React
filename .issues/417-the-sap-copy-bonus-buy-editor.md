---
status: done
spec: C:/Work/DMSCO/BackOffice/.issues/2374-marketing-authors-bonus-buys-in-oms-on-a-copy-of-sap-screen-spec.md
blocked-by: 416
---

# 417 — The SAP-copy bonus-buy editor creates, changes, copies and displays a bonus buy

**Source:** BackOffice spec 2374, *Marketing authors bonus buys in OMS on a copy of SAP's screen and uploader*, at `C:/Work/DMSCO/BackOffice/.issues/2374-marketing-authors-bonus-buys-in-oms-on-a-copy-of-sap-screen-spec.md`. The screen is read field by field in `C:/Work/DMSCO/BackOffice/.issues/2330-SAP-BBY-SCREEN.md`. The owner-approved prototype is on BackOffice branch `proto/2335-bby-editor-sap-copy` (`.scratch/proto/bby-editor-sap-copy/index.html`), a layout and flow reference, not code to port.

**Standing preference:** marketing must not feel the move from SAP. When "like SAP" and "better" conflict, like SAP wins.

## What to build

The Create, Change and Display bonus-buy page opened from the overview, as in the approved prototype (screenshots `2.png`–`10.png`):

- **Tabs: Header Data · Engine Rules · Promotion Data · History of Changes** (owner verdict, 2335: the engine-only fields go
  in their own tab).
- **Header:**
  - the number (display; "minted on save" for a new one) + text (at most 60);
  - status;
  - profile `BBCH` (fixed);
  - valid from/to, defaulting from the promotion;
  - currency per organisation (SAR / BHD);
  - limit number.
- **Organizational Data:** `01 Organization` with the `1000` / `20` row, read-only. No price-list, plant or senior-area columns.
- **Buy panel:**
  - Link Category (A AND / O OR);
  - the **Total Minimum Value** checkbox, which enables an amount + currency;
  - a grid with Line Item Type (Material | Material grouping), Line Item Identifier (a material, with its description looked
    up, or a grouping picked from the bonus buy's groupings), prerequisite quantity, unit, and Scale Type (default Equal).
  - Buy-side discount columns are not shown.
- **Get panel:**
  - Link Category;
  - the **Total Discount** checkbox;
  - a grid with type, identifier, description, Scale Type (From / Up To / Equal), quantity, unit, Discount Type (Discount
    Price / Discount Amount / Discount Percent), value, and Curr/Pe (`%` for percent, otherwise the currency). A Price shows an
    ex-VAT tag.
  - **Ticking Total Discount removes the reward columns and shows a side panel**: Discount Type (Price / Amount / Percent),
    value and unit. Its hint says a Price is a bundle price, or the basket's price when Get is empty.
- **Local Material Grouping popup** (toolbar): create an id (at most 12 characters, upper-case), status "3 Created Manually",
  and a materials grid with descriptions, then Confirm.
- **Engine Rules tab:**
  - includes, excludes, origin filter, stacking excludes, loyalty groups, loyalty tiers, stackable, score, max value, and time
    of day (`HHmmss` from/to);
  - empty means no restriction;
  - Max value is shown as unavailable until the engine update.
- **Check** (`BonusBuy/Validate`) and **Save** (`BonusBuy/Save`) list every refusal and warning with its `BBY-` code, in EN and AR.
  Save sends back the `version` it read, and shows the stale-version refusal with a reload.
- **History of Changes** shows the audit rows. **Display** opens any bonus buy, SAP or OMS, read-only. **Copy** creates a new
  Planned bonus buy from the source (`BonusBuy/Copy`).
- **Not shown:** Requirement, Arb. Comb., Org Type values other than `01`.
- It extends the existing read-only Display Bonus Buy types in `core/bonus-buy`.

## Spine reach

UI (oms-react feature) · API client (BbyMaintainWeb)

## Proof (→ `tdd` red-green cycles)

- [x] `total discount swaps the reward columns for the side panel` · vitest
- [x] `total minimum value enables its amount` · vitest
- [x] `curr/pe shows % for percent and the currency otherwise; price carries ex-VAT` · vitest
- [x] `editor state maps to the BonusBuy/Save request and back` — the pure mapping, with a non-trivial line count · vitest
- [x] `refusals render with code, English and Arabic` · vitest
- [x] `stale version shows the reload prompt` · vitest
- [x] `display mode disables every input` · vitest

## Boundaries

Same rules as the promotion ticket. No flag. Needs BackOffice 2377–2379 for the live walk.

## Done when

The owner keys the three captured shapes (1+1 on a grouping at 100 %, 10 % basket for a coupon, OR price rewards with a minimum value) on a dev HQ, activates them, and the simulator prices them.

## Blocked by

416 (+ BackOffice 2377, 2378, 2379 for the endpoints)

## Comments

**Built 2026-10-05: code-complete and proven on stubs. The owner's live walk is still outstanding.** BackOffice 2376–2384 have
shipped (merge `2abd345d5`), but no dev SIS.Api is known to carry them yet. So the "Done when" walk has not happened: keying the
three shapes, activating them, and seeing the simulator price them.

**As built** — `features/pricing/bonus-buy-maintenance/`:
- `BonusBuyEditorPage` replaces 416's placeholder. It covers Create, Change and Display under `…/:promo/bonus-buy/new|:bby[?mode=display]`.
  - The toolbar has Check, Save, Local Material Grouping and Copy.
  - The four tabs are Header Data · Engine Rules · Promotion Data · History of Changes.
  - One disabled `<fieldset>` covers every input when the page is read-only.
- The header shows:
  - the number, or "Given when you save";
  - text (≤ 60);
  - the status badge;
  - `BBCH` DWA-BB Profile chain;
  - valid from/to, defaulted from the promotion;
  - SAR, from org `1000`;
  - Limit Number.
- Organizational Data shows "01 Organization" and the read-only `1000` / `20` row.
- `BuyGetPanels`:
  - Link Category; Total Minimum Value (the box enables its amount); Total Discount (the box swaps the Discount Type / Value / Curr/Pe columns for the side panel and its bundle-price hint).
  - Line Item Type picks a material input or a grouping select.
  - Curr/Pe shows `%` or the currency, and a Price carries an "ex VAT" tag.
  - Buy-side Scale Type is a disabled Equal (`BbyBuyLine` has no scale).
- `GroupingDialog` gives an upper-cased id (≤ 12), status 3 Created Manually, the materials, and Confirm. Typing an existing id opens that grouping instead of overwriting it.
- `EngineRulesTab` holds the 6 lists, Stackable, Score, Max value (disabled: "unavailable until the engine update") and the time of day (HH:mm:ss in the input, `HHmmss` on the wire).
- The pure seam is `editor.ts`:
  - `newEditor`, `fromDocument`, `toRequest`;
  - `getPanelLayout`, `buyPanelLayout`, `currPe`;
  - `normalizeGroupingId`, `upsertGrouping`;
  - `readEditorOutcome` (valid, saved, refused, stale, notFound);
  - `editorAccess`.
- Stale save: a `BBY-STALE-VERSION` refusal shows the server's EN + AR sentence with a **Reload** button, which re-reads the bonus buy and restarts the form from it.

🚩 **416's wire shapes are reconciled to the shipped DTOs** (`BbyMaintainModels.cs`); the spec-axis review checked them field by field:
- refusals are `{ code, english, arabic }`, not `en` / `ar`, and there is no `number` or `field`;
- overview rows are `description` / `bbyStatus`;
- `Promotion/List` returns whole promotion documents, so the count is `bonusBuys.length`;
- a promotion flip names its refused bonus buys in `bonusBuys[]`;
- `GET Promotion/{n}` answers a missing number in-band with `notFound`.

**Gaps the doors leave (BackOffice asks, not filed):**
- 🚩 **No material-description lookup.** `BbyMaintainWeb` has no item read, so the description cell shows "–" and the page says so. `BBY-MATERIAL-UNKNOWN` on Check and Save still catches a mistyped material.
- 🚩 **No audit read.** `BbyMaintainAudit` is written, but no door returns it. History of Changes shows the read's last write (changedBy / changedAt) and says the full list needs a server read.

**Decisions taken while building (owner sign-off wanted):**
- Empty table rows are left out of the request, as SAP's table control ignores them.
- Under Total Discount the get lines send no reward of their own, because the validator ignores them. The state keeps the rewards, so unticking brings them back.
- An unknown or legacy discount code (for example `N`) reads as `%` in the form. This can only matter for a SAP bonus buy, which is read-only, since every door refuses `N` on an OMS one.
- The discount labels are SAP's ("Discount Price / Amount / Percent"), not CONTEXT.md's Set Price / Fixed Discount. Like SAP wins.
- A blank unit is *shown* as `EA`, the server's `DefaultUom`, but is sent blank.
- Copy targets the current promotion, as in 416 (no picker). A SAP bonus buy is reachable for Display only by its URL, or through Copy from SAP. There is no "Display SAP number…" prompt.
- The editor's model lives in `core/models/bonus-buy-maintenance.ts`, not `core/bonus-buy`: the request shape shares nothing with the read-only detail DTO.

**Proof:**
- `editor.test.ts`: 30 tests, the 7 Proof lines plus round-trip and grouping cases.
- `overview.test.ts` updated to the shipped flip shape.
- Full suite 3648/3648; typecheck, lint (4 gates) and build all pass.
- `tools/bby-maintenance-drive.mjs` **68/68**: 416's 26 checks plus 42 for the editor (steps 12–21). Every `BbyMaintainWeb` envelope is stubbed in the shipped shapes.

**Reviews:**
- `/code-review` found 4 issues, all fixed:
  - typing an existing grouping id overwrote it;
  - the handed-over "Saved." report replayed on reload;
  - Copy dropped its warnings;
  - a background refetch could rebuild the form and drop unsaved edits (the read is now never refetched on its own).
- `/standards-review`, Standards axis: both hard findings are fixed (grouping ids in native `<option>` now go through `fsi`, and the "–" placeholder comes from `t()`). The smells (Buy/Get panel duplication, the org spread over three places) were left as judgement calls.
- `/standards-review`, Spec axis: the wire reconciliation is correct. The missing material description is now said on screen. The remaining points are recorded above.
