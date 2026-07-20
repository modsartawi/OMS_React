---
status: open
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

- [ ] `toDetailView` selects the **total-discount** branch (empty Get) when `condTargetType==='R'` and the **rows** branch otherwise; marks grouping rows drilldown-enabled; formats discount by type · **pure**
- [ ] opening Details renders the header recap + Buy/Get tables (or the total-discount card) from a mocked `Bby/Detail`; a mocked `BBY_NOT_FOUND` shows the not-found card · **flow** — verify via typecheck + drive (extend `tools/screen1-smoke.mjs`)

## Boundaries

New endpoint **`GET Bby/Detail`** (runtime-blocked; handle `BBY_NOT_FOUND`/404). New i18n keys. Reuses
`core/ui/Modal.tsx`. No vitest bootstrap.

## Done when

Details ▸ opens the modal showing the header recap + Buy→Get (or total-discount card) from a mocked
`Bby/Detail`, with loading + not-found states, closing back to an intact grid; `toDetailView` harness
green; typecheck + build green.

## Blocked by

[063](063-bby-inquiry-full-grid.md) — the sticky identity column + Details ▸ trigger live there.
