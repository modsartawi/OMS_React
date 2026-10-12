---
status: done
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

- [x] `ordersQuery`: filters ⇄ URL round-trip; a window over 31 days is refused client-side (vitest)
- [x] `statusLabel`: every contract status code maps to a label key (vitest)
- [x] `tools/deliverect-orders-drive.mjs`, against stubs:
  - each outcome renders;
  - the drawer shows dropped lines and statuses;
  - raw opens;
  - retry is offered only where allowed;
  - the menu entry is hidden when `canViewOrders` is false.
- [x] typecheck, lint, test green

## Boundaries

oms-react only. No feature flag: the access probe gates the menu, and the server grant is the real boundary. The BackOffice doors are built in parallel; until they are deployed, prove the page against stubs of the contract (real envelope `errors[]` shape, fixtures emitting **exactly** the contract's fields).

## Done when

The helpers and the drive are green.

## Blocked by

- [477](477-an-hq-user-onboards-a-store-on-a-deliverect-account-and-sees-its-link.md)

(live: BackOffice 2626)

## Comments

**Done 2026-10-12 (AFK).** `features/deliverect/orders` at `/deliverect/orders`, namespace `deliverect-orders` (en + ar), Orders leaf on `canViewOrders`.

- vitest: `orders-query.test.ts` (URL round-trip incl. repeated `platform`/`outcome`, `from`/`to` always written, local today, inclusive 31-day cap refused, cleared date invalid), `order-status.test.ts` (every contract code 20/90/110/120/126 → key in en + ar, unknown raw, 126 needs a person, retry only refused/statusFailed, raw body never altered), `i18n-keys.test.ts`, `menu-deliverect.test.ts` updated. Suite 4893 green.
- drive `tools/deliverect-orders-drive.mjs` **91/91 against stubs** (LTR + RTL, Asia/Riyadh clock): each outcome, the 126 alert row painted, filters ⇄ URL ⇄ door, >31 days refused with no call, Platforms 200 + 403, drawer lines (dropped + reason) and statuses, raw (formatted / verbatim / non-JSON), retry only where allowed + DLV-00006/00007 inline, xlsx export, paging, menu hidden without `canViewOrders`. `tools/deliverect-stores-drive.mjs` 167/167 (two menu checks relaxed for the new leaf).
- typecheck, lint (4 gates), build green.
- Raw door shape ruled `{ rawBody, receivedAt }` in `core/models/deliverect.ts`. Rulings and contract gaps in `.afk/HITL-478.md`.

**Outstanding (not AFK's):** the live door on staging (483 / BackOffice 2626); owner sign-off on the inclusive 31-day window, the Raw field names, the no-reason Retry and the 200 page size; owner's eye on the Arabic.
