---
status: done
spec: C:\Work\DMSCO\BackOffice\.issues\2615-deliverect-delivery-platforms-spec.md
blocked-by: 477 (live: BackOffice 2624)
---

# 480 — An HQ user sees each Deliverect store's stock sync, pauses it and reads its logs

## What to build

The stock sync on the Stores page (477):

- **Columns**: active, last full, last delta and last status. A failing or overdue store is
  highlighted (precedent: HungerStation spec 1872).
- **Pause / resume** with a reason. The dialog says in words that pausing stops the stock pushes
  only, and that the store stays listed and can still receive orders (glossary **Stock sync
  (paused)**).
- **Logs drawer**: the last 50 runs, with type (full or delta), start, end, rows, status, file id,
  Deliverect's `processed` callback, and the error.

Wire shapes: `C:\Work\DMSCO\BackOffice\.issues\assets\2615-deliverect-web-door-contract.md` (Stores `sync` block, Stock sync).

## Spine reach

UI → app (BackOffice doors, stubbed until 483)

## Proof (→ `tdd` red-green cycles)

- [x] `syncHealth`: overdue and failed rules give the highlight (vitest) — `src/features/deliverect/stores/sync-health.test.ts`, 20 cases (thresholds, local parsing, failed/overdue/paused/not-linked/first-run grace, log labels)
- [x] `tools/deliverect-stores-drive.mjs` sync section, against stubs: pause/resume, logs, highlight — sections 12–15 appended (LTR + RTL, browser clock fixed), **108/108** with 477's 1–11 unchanged; the highlight is checked as a PAINTED ground, not just a class
- [x] typecheck, lint, test green — 4810 tests; lint four gates clean; build green

## Boundaries

oms-react only. No feature flag: the access probe gates the menu, and the server grant is the real boundary. The BackOffice doors are built in parallel; until they are deployed, prove the page against stubs of the contract (real envelope `errors[]` shape, fixtures emitting **exactly** the contract's fields).

## Done when

The helpers and the drive are green.

## Blocked by

- [477](477-an-hq-user-onboards-a-store-on-a-deliverect-account-and-sees-its-link.md)

(live: BackOffice 2624)

## Outcome (2026-10-12)

Built on the 477 stores page: sync columns (active, health, last full, last delta, last status, last
error), failed rows red / overdue rows amber (`sync-health.ts`, named cadence constants), pause /
resume through the core `ReasonDialog` (says pausing stops the stock pushes only), and the logs
drawer (`SyncLogsDrawer.tsx`, the SHEET recipe, last 50 runs). Rulings and contract gaps in
`.afk/HITL-480.md`.

**Outstanding (not AFK's):** owner sign-off on the overdue thresholds, the paused-beats-failed order
and the "latest run of either kind" reading; an owner's eye on the Arabic rendering; the live doors
(483, BackOffice 2624).
