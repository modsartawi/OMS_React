---
status: open
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

- [ ] `total discount swaps the reward columns for the side panel` · vitest
- [ ] `total minimum value enables its amount` · vitest
- [ ] `curr/pe shows % for percent and the currency otherwise; price carries ex-VAT` · vitest
- [ ] `editor state maps to the BonusBuy/Save request and back` — the pure mapping, with a non-trivial line count · vitest
- [ ] `refusals render with code, English and Arabic` · vitest
- [ ] `stale version shows the reload prompt` · vitest
- [ ] `display mode disables every input` · vitest

## Boundaries

Same rules as the promotion ticket. No flag. Needs BackOffice 2377–2379 for the live walk.

## Done when

The owner keys the three captured shapes (1+1 on a grouping at 100 %, 10 % basket for a coupon, OR price rewards with a minimum value) on a dev HQ, activates them, and the simulator prices them.

## Blocked by

416 (+ BackOffice 2377, 2378, 2379 for the endpoints)
