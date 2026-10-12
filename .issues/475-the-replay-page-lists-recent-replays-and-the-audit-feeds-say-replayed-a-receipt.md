---
status: done
spec: 470
blocked-by: 472
---

# 475 — The Replay page lists recent replays, and the audit feeds say "Replayed a receipt"

## What to build

- **Recent replays** on the Replay page come from `GET ActionSync/Replays?page=` (spec 470's contract),
  in a `TabGrid`-style list paged by the door at 50, newest first. The columns are:
  - when and who;
  - source store and source receipt;
  - target store, register and new receipt number.

  The list refreshes after a successful push. An empty list says no receipt has been replayed yet.
- **Audit:** `ReceiptReplay` joins the console's `AuditAction` model and `AUDIT_ACTIONS`, labelled
  "Replayed a receipt". It shows in both the fleet audit feed and a store's audit tab.

## Spine reach

model/api (Replays door, `AuditAction`) · component (list on the page) · i18n (`replay.recent.*`, audit label) · test

## Proof (→ `tdd` red-green cycles)

- [x] The `ReceiptReplay` audit label, beside the existing audit-label tests · pure (vitest)
- [x] Replay drive section: the list renders the stubbed rows, pages, shows its empty words, and re-reads after a push (two requests) · flow (Playwright)
- [x] The audit drives show "Replayed a receipt" for a stubbed `ReceiptReplay` row · flow
- [x] Gates green: typecheck, lint (4 gates), vitest (269 files / 4792 tests), build.

## Boundaries

oms-react only. One new stubbed door, `ActionSync/Replays`. The column values are machine values,
isolated by the grid base.

## Done when

The recent list and the audit label render in the drives.

## Blocked by

[472](472-a-tester-pastes-a-sale-pushes-it-into-a-store-and-sees-its-new-receipt-number.md)

## Built (2026-10-12)

- `ReceiptReplay` joins `AuditAction` (`core/models/sync-console.ts`) and `AUDIT_ACTIONS`, labelled
  "Replayed a receipt" (`auditActions.ReceiptReplay`). It is pinned beside the other audit labels in
  `control-helpers.test.ts`.
- `syncConsoleApi.replays(page)` → `GET ActionSync/Replays?page=&pageSize=50` (`replaysQuery` in
  `replay-helpers.ts`, tested), read as the console's `Paged<ReplayRow>`. 🚩 Contract gap: spec 470
  writes `{ rows, total }` (HITL-475). `REPLAYS_KEY` / `replaysQueryOptions` are in `api.ts`.
- `replay-columns.tsx` has seven columns: when, who, source store, source receipt, store, register
  and new receipt. They are plain fields isolated by the console's base cell, with no `fsi`.
- `ReplayPage`: **Recent replays** is drawn below the result area through `TabGrid` + `GridPager`
  (50 a page). An emptied inner page clamps back, as on the audit feed. The empty list reads "No
  receipt has been replayed yet." A successful push invalidates `REPLAYS_KEY` and goes back to
  page 1, where the new replay is on top.
- Drives (all stubbed):
  - Replay drive section 9: empty words; a push re-reads the list (two requests); 50 rows on page 1
    with their headers and values, newest first, isolated with no FSI; Next asks page 2; a push from
    page 2 re-reads page 1 and shows the replay on top. **127/127.**
  - Controls drive section 11: a stubbed `ReceiptReplay` row reads "Replayed a receipt" in the
    fleet-wide feed and in the target store's Audit tab. **113/113.**
  - Store drive **336/336**, unchanged.
  - No existing assertion changed.

## Outstanding (not AFK's)

- A human's eye on the Recent replays list (no prototype covers it).
- Live: `ActionSync/Replays` and the `ReceiptReplay` audit row wait on the BackOffice replay spec (476).
