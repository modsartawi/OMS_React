---
status: open
spec: C:\Work\DMSCO\BackOffice\.issues\2615-deliverect-delivery-platforms-spec.md
blocked-by: 477 (live: BackOffice 2626)
---

# 478 — An HQ user follows Deliverect orders in the monitor and retries a failure

## What to build

- **Feature** `features/deliverect/orders`, at the route `/deliverect/orders`, with the namespace
  `deliverect-orders`.
- **Grid**:
  - Columns: received at, platform, channel display id, store, our document, outcome, reason,
    dropped lines, last status sent and whether it was OK, and the total with 3 decimal places and
    `currencyKey`.
  - Filters: date window (at most 31 days, defaulting to today), platform (repeatable), store,
    outcome (repeatable) and text.
  - The search lives in the URL.
  - Export to Excel through `core/util/grid-xlsx`.
- **Detail drawer**:
  - Lines: PLU, name, quantity, unit price, funded discount, material, and a **dropped** badge with
    its reason.
  - The statuses sent, with the code's meaning in words (20 Accepted, 90 Finalized, 110 Cancelled,
    120 Failed, 126 Cancel failed), Deliverect's answer and the attempts.
  - A link to our document.
- **Raw**: a read-only JSON viewer of the body as received.
- **Retry**: shown only for the `refused` and `statusFailed` outcomes, with a confirmation.
  DLV-00007 shows inline.
- **Alert styling**: a cancel that arrived after invoicing (`126`) is shown as needing a person.

Wire shapes: `C:\Work\DMSCO\BackOffice\.issues\assets\2615-deliverect-web-door-contract.md` (Orders monitor).

## Spine reach

UI → app (BackOffice doors, stubbed until 483)

## Proof (→ `tdd` red-green cycles)

- [ ] `ordersQuery`: filters ⇄ URL round-trip; a window over 31 days is refused client-side (vitest)
- [ ] `statusLabel`: every contract status code maps to a label key (vitest)
- [ ] `tools/deliverect-orders-drive.mjs`, against stubs:
  - each outcome renders;
  - the drawer shows dropped lines and statuses;
  - raw opens;
  - retry is offered only where allowed;
  - the menu entry is hidden when `canViewOrders` is false.
- [ ] typecheck, lint, test green

## Boundaries

oms-react only. No feature flag: the access probe gates the menu, and the server grant is the real boundary. The BackOffice doors are built in parallel; until they are deployed, prove the page against stubs of the contract (real envelope `errors[]` shape, fixtures emitting **exactly** the contract's fields).

## Done when

The helpers and the drive are green.

## Blocked by

- [477](477-an-hq-user-onboards-a-store-on-a-deliverect-account-and-sees-its-link.md)

(live: BackOffice 2626)
