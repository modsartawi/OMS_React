---
status: open
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

- [ ] The `ReceiptReplay` audit label, beside the existing audit-label tests · pure (vitest)
- [ ] Replay drive section: the list renders the stubbed rows, pages, shows its empty words, and re-reads after a push (two requests) · flow (Playwright)
- [ ] The audit drives show "Replayed a receipt" for a stubbed `ReceiptReplay` row · flow
- [ ] Gates green.

## Boundaries

oms-react only. One new stubbed door, `ActionSync/Replays`. The column values are machine values,
isolated by the grid base.

## Done when

The recent list and the audit label render in the drives.

## Blocked by

[472](472-a-tester-pastes-a-sale-pushes-it-into-a-store-and-sees-its-new-receipt-number.md)
