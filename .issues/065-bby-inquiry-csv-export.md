---
status: open
spec: 061
blocked-by: 063
---

# 065 — exportingTheGridWritesAllTwentyEightRawFieldsToCsv

## What to build

A **CSV export** of the current (filtered) result set — the react equivalent of the WPF
Export-to-Xlsx, resolved to CSV-in-v1 (059 decision).

- An **Export CSV** button that calls AG-Grid Community's `exportDataAsCsv` over the current grid
  (respecting the active sort + filter row), writing **all 28 raw header fields** — codes, `yyyyMMdd`
  dates, `HHMMSS` times verbatim (the raw values the grid preserved in 063, not the display chips).
- Opens in Excel. Prior art: `src/features/oms/deliveries/export.ts`.

xlsx is explicitly out of scope (Enterprise-only / needs SheetJS or a server endpoint) — deferred to a
later ticket.

## Spine reach

component (export button + `exportDataAsCsv` config over raw values) · i18n (button label, filename) ·
test (app-drive).

## Proof (→ `tdd` red-green cycles)

- [ ] clicking Export writes a CSV of the current filtered set with all 28 raw fields (codes/dates unformatted) · **flow** — verify via typecheck + drive (mocked `Bby/List`); assert the CSV header + a raw-coded cell

## Boundaries

No new endpoint. CSV only (xlsx out of scope). New i18n keys (button, filename). No vitest bootstrap.

## Done when

Export CSV downloads the current filtered result set with all 28 raw fields; typecheck + build green.

## Blocked by

[063](063-bby-inquiry-full-grid.md) — needs the full raw-valued column set.
