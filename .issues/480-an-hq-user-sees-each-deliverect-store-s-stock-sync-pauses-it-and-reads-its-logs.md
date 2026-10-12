---
status: open
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

- [ ] `syncHealth`: overdue and failed rules give the highlight (vitest)
- [ ] `tools/deliverect-stores-drive.mjs` sync section, against stubs: pause/resume, logs, highlight
- [ ] typecheck, lint, test green

## Boundaries

oms-react only. No feature flag: the access probe gates the menu, and the server grant is the real boundary. The BackOffice doors are built in parallel; until they are deployed, prove the page against stubs of the contract (real envelope `errors[]` shape, fixtures emitting **exactly** the contract's fields).

## Done when

The helpers and the drive are green.

## Blocked by

- [477](477-an-hq-user-onboards-a-store-on-a-deliverect-account-and-sees-its-link.md)

(live: BackOffice 2624)
