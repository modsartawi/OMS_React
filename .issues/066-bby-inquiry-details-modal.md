---
status: done
spec: 061
blocked-by: 063
---

# 066 — openingDetailsShowsTheHeaderRecapBuyGetOrTotalDiscount

## What to build

The per-row **Details modal** — the SAP "Display Bonus Buy" mirror (approved prototype
[060](060-bby-detail-modal-prototype.md)), opened from the grid's **Details ▸** action.

- **`Bby/Detail`**: `api.ts` `detail(bbyNumber)` → `GET Bby/Detail?bbyNumber=` returning `BbyDetailDto`
  (header + server-projected `org` block + `buy[]`/`get[]` with inline `description`, or `totalDiscount`
  when `condTargetType==='R'`).
- **Pure `toDetailView(dto)`** — maps the DTO to the render model: the two header panels, the Buy rows,
  and the **Get-vs-total-discount branch selected on `condTargetType === 'R'`**; per-row
  `isGrouping && memberCount>0` marks a drilldown-enabled row (drilldown itself is slice 067).
- **Modal UI** (reuse `src/core/ui/Modal.tsx`, wider width): title bar (number + status badge +
  validity badge + description); **Organisation** panel (sales-org/channel/plant/currency) + **Header &
  rules** panel; **Buy side** table → "then" link strip (each side's link category) → **Get side**
  table (discount value formatted by type: `condValueP` `%` vs `condValue` + currency). In Document
  mode the Get table is replaced by the **total-discount card** (figure + type + condition type +
  basket requirement = `header.minValue`) and the Buy side shows its empty note.
- **States**: loading skeleton; **`BBY_NOT_FOUND`** (HTTP 404 business outcome) → a clear "not found"
  card via `apiErrorMessage`/`apiErrorCode`, not "unexpected". Closing (✕ / Escape / backdrop) returns
  to the grid with scroll/sort/filters intact (native `<dialog>` restores focus).

The Buy/Get lists are **lightweight read-only tables**, not AG-Grid. No live-basket status (out of scope).

## Spine reach

model/api (`BbyDetailDto`, `api.ts` `detail()`) · logic (pure `toDetailView`, branch selection) ·
component (modal via `core/ui/Modal.tsx`, header panels, Buy/Get tables, total-discount card) · i18n
(panel labels, table headers, code labels, not-found copy) · test (pure harness + app-drive).

## Proof (→ `tdd` red-green cycles)

- [x] `toDetailView` selects the **total-discount** branch (empty Get) when `condTargetType==='R'` and the **rows** branch otherwise; marks grouping rows drilldown-enabled; formats discount by type · **pure** — in-memory jiti harness, 18/18 green (branch selection, R drops stray Get, drilldown flag, `%`/`R`/defensive-`N` discount kinds, validity states)
- [x] opening Details renders the header recap + Buy/Get tables (or the total-discount card) from a mocked `Bby/Detail`; a mocked `BBY_NOT_FOUND` shows the not-found card · **flow** — verified via typecheck + drive (extended `tools/bby-inquiry-drive.mjs`, 49/49 green: rows branch header/Buy/Get + members chip, Document total-discount card + empty-note, `BBY_NOT_FOUND` card, Escape closes to an intact grid)

## Boundaries

New endpoint **`GET Bby/Detail`** (runtime-blocked; handle `BBY_NOT_FOUND`/404). New i18n keys. Reuses
`core/ui/Modal.tsx`. No vitest bootstrap.

## Done when

Details ▸ opens the modal showing the header recap + Buy→Get (or total-discount card) from a mocked
`Bby/Detail`, with loading + not-found states, closing back to an intact grid; `toDetailView` harness
green; typecheck + build green.

## Blocked by

[063](063-bby-inquiry-full-grid.md) — the sticky identity column + Details ▸ trigger live there.

## Comments

- **Built** on `feature/notification-center` (code-complete / runtime-blocked — SIS.Api `Bby/Detail`
  not built yet), following the NC/cache-reset posture. New: `detail-view.ts` (pure `toDetailView`),
  `DetailModal.tsx`, `api.ts` `detail()`, `BbyDetailDto`/`BbyBuyRow`/`BbyGetRow`/`BbyTotalDiscount`
  models, `formatAmount` (2-dp money), the `detail.*` i18n block, and the 066 drive block.
- **Discount-type label fix (spec review):** the `discount` code set had `P → "Percent"`, but the
  formatter (per the 058 DTO rule) only treats `'%'` as a percentage — a `'P'` row would read
  "Percent" beside a bare number. Corrected `P → "Price"` to match the approved 060 prototype's
  `DISCOUNT` map. `%` stays "Percent", `R` stays "Amount".
- **Backend contract note (spec review):** the Header & rules panel shows `includes`/`excludes`
  (story 33), but the 058/061 `Bby/Detail` header contract doesn't list them — added as **optional**
  `header.includes?`/`excludes?` so a payload that omits them renders a dash. The backend `Bby/Detail`
  build should project them to fill those cells; flagged for 067/backend reconciliation.
- **Standards review:** no hard violations; centralized the `%`-vs-currency unit decision into one
  `discountUnit` helper + exposed the total-discount presentation from the pure `toDetailView` (so it
  isn't re-derived in the card), and removed an unused `detail.close` key.
