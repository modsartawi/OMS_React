---
status: done
spec: C:\Work\DMSCO\BackOffice\.issues\3201-hungerstation-promotions-are-made-on-oms-react-and-sent-to-hungerstation-spec.md
blocked-by: 667 (live: BackOffice 3213)
---

# 668 — A same-item bundle sheet with mixed values is previewed as the parts it will be sent as

## What to build

The **same-item bundle** type in the editor.

- A bundle column spec for `core/import/ImportDialog`: `Material, Buy, Get, Subtype, Value, MaxQty`.
  Blank cells take the header defaults (default buy, get, subtype, value). Buy-one-get-one-free is
  `1, 1, PERCENTAGE, 100`.
- **Part preview** from Check: one row per **HungerStation promotion part**, showing the combination
  in words ("Buy 2 get 1 at 50% off", "Buy 1 get 1 free", "Buy 2 get 1 for 9.95 SAR"), its SKU count
  and the name it will carry on HungerStation. A Send button reads "Send N promotions to M stores"
  when N > 1.
- The detail (665) shows each part's own status; one failed part makes the promotion Failed.
- The user never splits a sheet by hand. Say so on the paste step: "Rows with different buy/get or
  discount are sent as separate HungerStation promotions."

Wire shapes: the contract's Check (parts) and read sections (added by BackOffice 3213).

## Spine reach

UI → app (BackOffice doors, stubbed)

## Proof (→ `tdd` red-green cycles)

- [x] `bundleColumns` parse: blank cells → defaults, buy/get < 1 flagged, BOGO row reads as such (vitest)
- [x] `partLabel`: the combination in words, EN and AR, for PERCENTAGE / ABSOLUTE / FINAL_PRICE and BOGO (vitest)
- [x] drive (LTR + RTL), against stubs: a mixed 1,000-row sheet previews 3 parts with their counts and names; Send says "3 promotions"; per-part status on the detail
- [x] `npm run typecheck`, `npm run lint`, `npm test` green

## Boundaries

oms-react only. The split is the server's (BackOffice 3213); the page only shows it, and never
computes the parts on its own.

## Done when

A mixed bundle sheet previews as its parts and sends from stubs.

## Blocked by

[667](667-the-promotion-check-panel-shows-each-row-s-refusal-and-the-stores-a-price-warning-names.md)

## Comments

- 2026-10-29 (built, `impl/668`): **done against stubs only. No BackOffice door exists, and the
  contract has no Check (parts) or read section yet (BackOffice 3213).** So "done" means vitest +
  typecheck + lint + the drive green against stubbed envelopes (real `errors[]` shape). Nothing was
  called live.
  - **Type:** the editor gains a **Type** picker (strikethrough default, same-item bundle); a type
    change drops the pasted items and the check (the columns differ). The list button is now "New
    promotion"; the editor's eyebrow/title say "HungerStation promotion".
  - **Bundle columns** (`bundle-columns.ts`): `Material, Buy, Get, Subtype, Value, MaxQty` through
    `core/import/ImportDialog`, read by 666's rules, now shared as `readItemSheet` in
    `strikethrough-columns.ts` (header skip, last row wins counted, cap reported). Buy / get must be
    a whole number ≥ 1, else the line is flagged (`CELL`). Blank cells stay `null` in the body
    (666's assumption: the default as SAVED); `rowCombination` shows on the grid what a blank row
    will read as (greyed buy / get, a Combination column in words). BOGO = `1, 1, PERCENTAGE, 100`.
  - **Header defaults:** new **Default buy** / **Default get** boxes (bundle only), sent as
    `defaultBuyQuantity` / `defaultGetQuantity` on the save body and read back on the detail
    (shown as "Default buy / get"). A strikethrough sends `null` for both and strips row buy/get.
  - **Part preview** (`CheckPanel`, bundle only): from Check's `parts` — never computed here —
    one row per part: the combination in words (`part-label.ts` `partLabel`, EN + AR: "Buy 2 get 1
    at 50% off", "Buy 1 get 1 free", "Buy 2 get 1 for 9.950 SAR", values isolated with `fsi`), its
    SKU count and its name on HungerStation. `checkSummary` carries `parts` + `skuCount`;
    `checkOfRefusal` now reads parts defensively (DHS-00018's `data`).
  - **Send** reads "Send N promotions to M stores" when Check answered N > 1 parts (M = the ticked
    stores). The paste step's format line ends "Rows with different buy/get or discount are sent as
    separate HungerStation promotions."; the items section says it too.
  - **Detail:** each part's own status was already 665's; the drive now proves a 3-part bundle reads
    Queued ×3 after Send, then Completed / Failed / Completed with the promotion **Failed** (the
    server's roll-up).
  - **Drive** § 12 (LTR + RTL): **346/346** (285 before + 61). Its doors are overrides on 666's
    (`check` / `send` / `refresh`); the stub does the split as 3213 will. The mixed 1,000-row
    sheet previews 600 / 300 / 100. 666's create-body expectation gained the two new `null`s.
  - 🚩 **Assumptions for the contract (BackOffice 3213):** (1) **default buy / get on the promotion**
    — spec 3201's record names only a default subtype and value; this ticket asks for buy / get
    defaults too. Modelled as `defaultBuyQuantity` / `defaultGetQuantity` on the save body and the
    detail: **BO ask** (or drop them and require buy / get on every row). (2) check code
    `BUY_GET_RANGE` (a row's buy or get, own or default, under 1 or missing). (3) the part preview
    is `HungerStationPromotionPartPreview` (combination + name + skuCount), in the server's order.
    (4) money in the words uses the area's 3 decimals ("9.950 SAR"), not the ticket's "9.95 SAR".
  - **Open:** should Check's part preview also show on a strikethrough (always one part)? Shown for
    bundles only.
