---
status: done
spec: 061
blocked-by: 062
---

# 063 — theGridShowsAllTwentyEightHeaderFieldsGroupedWithChipsStickyIdentityAndDetailsAction

## What to build

Thicken the tracer's minimal grid into the full **28-field `BbyHeader`** inquiry grid — the operator's
scan/filter/export surface (059's "full header, not a summary" decision).

- **All 28 fields** from the `BbyInquiryRow` DTO as columns, under **grouped headers**: Identity &
  offer · Validity · Buy/Get rules · Stacking · Loyalty · Audit.
- **Sticky Status + BBY-number identity column** (pinned start) carrying the status badge, the
  `isActive` **"valid today"** marker, and a **Details ▸** action button per row (opens the modal —
  wired in slice 066; here it renders and is clickable).
- **Legible rendering, raw values preserved for export**: code→label chips (`R`→Document, `A`/`O`→
  And/Or, `bbyStatus` A/I/D/X badge, condTarget/discount/scale/condType where shown), booleans ✓/–,
  dates `yyyyMMdd→yyyy-MM-dd`, times `HHMMSS→HH:mm`. Value-formatters read the raw row; underlying
  values stay raw so CSV export (065) dumps codes/dates verbatim.
- **Sortable columns** and a **toggleable per-column filter row** (the WPF `ShowAutoFilterRow`).
- Theme via AG-Grid's CSS-variable **Theming API** to the restyle tokens; `enableRtl` for direction
  (logical-tailwind rule exempts third-party widget internals). All chrome via `t()`.

Pure formatting/label logic concentrates in a `formatters`/`codeLabels` module, kept out of the column
defs so it is testable in-memory.

## Spine reach

logic (pure `formatters` + `codeLabels`) · component (full AG-Grid column defs, grouped headers,
pinned identity cell renderer, filter row, theming) · i18n (column headers, group labels, code labels,
badges) · test (pure harness + app-drive).

## Proof (→ `tdd` red-green cycles)

- [x] `codeLabels` maps every code set to its `t()` key (status A/I/D/X, link A/O, condTarget R/P/M/G, discount P/R/%, condType ZB0x, scale A/B/C) and leaves an unknown code passed through, not thrown · **pure** (in-memory node/TS harness — 23/23 incl. every set member → `<set>.<code>` key + unknown/empty pass-through)
- [x] `formatters` renders `yyyyMMdd→yyyy-MM-dd`, `HHMMSS→HH:mm`, booleans→✓/–, and preserves the raw value for export · **pure** (harness green; display-only fns never touch the row; also `formatIsoDate`/`formatNumber` for the audit + numeric columns)
- [x] the grid shows all 28 columns under their groups with the sticky identity column, `isActive` marker, sort, and the toggleable filter row · **flow** — drove the real app (`tools/bby-inquiry-drive.mjs`, Playwright) against mocked `Bby/*` (23/23: `aria-colcount=28`, all six group headers, pinned identity carries badge+number+Details, And/Product chips, filter row toggles off→on)

## Boundaries

No new endpoint (reuses `Bby/List` from 062). AG-Grid Theming-API tokens + `enableRtl`. Zero-literal
headers/labels. No vitest bootstrap.

## Done when

The grid shows the full 28-field header (grouped, sticky identity, chips/badges, `isActive` marker,
sort, filter row), Details ▸ renders per row, raw values preserved for export; `formatters`/`codeLabels`
harness green; typecheck + build green.

## Blocked by

[062](062-bby-inquiry-scaffold-gate-list.md)
