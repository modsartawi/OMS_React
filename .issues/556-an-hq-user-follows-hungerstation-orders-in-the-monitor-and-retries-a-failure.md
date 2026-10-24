---
status: open
spec: C:\Work\DMSCO\BackOffice\.issues\3028-hungerstation-follow-up-on-oms-react-spec.md
blocked-by: 551 (live: BackOffice 3036, 3037)
---

# 556 — An HQ user follows HungerStation orders in the monitor and retries a failure

## What to build

The orders monitor for the direct HungerStation rail, shaped like the Deliverect monitor (478). Use the
glossary word **HungerStation order outcome**: `created`, `cancelled`, `failed` or `pending`, judged on our
side. HungerStation's own status (`hsStatus`) is a separate column.

- **Registration:** the feature `features/hungerstation/orders`, the namespace `hungerstation-orders` in EN
  and AR, and the route `/hungerstation/orders`. Its menu entry fills 551's placeholder under
  `canViewOrders`.
- **Orders grid**, server-paged (`skip`/`take`, `total`), newest first:
  - Columns: received at, order code, order id, chain, vendor id, store, HungerStation status, document
    number, outcome, reason, replaced lines, deliveries (a count), total (3 decimals + `currencyKey`) and
    alert.
  - The window (`from`/`to`, date only, both days included) is required, at most 31 days, defaulting to
    today. Validate it locally (not before 2000-01-01, not after tomorrow); a server 400
    `HungerStationWindowInvalid` still shows inline.
  - Filters: store, chain, outcome (multi: created / cancelled / failed / pending / replacedLines /
    unmatched, OR within the key), and text (order id, order code or document number). URL state.
  - `alert: "unmatched"` is shown prominently. It means the vendor id belongs to no onboarded store, and
    the action it names is to onboard (or revive) the store, not to retry. Link to the Stores page.
  - `storeCode` and `documentNumber` render blank when `null`.
- **Detail drawer** (`GET Orders/{orderId}`):
  - the row's fields;
  - lines in the order given, each replacement shown right after the line it replaced, with HungerStation's
    line status (`IN_CART`, `REPLACED`, …). Lines carry no `currencyKey`; use the row's;
  - deliveries, oldest first, each with its run: status (`C` done / `P` waiting / `F` stopped), attempts,
    last attempt, next attempt (only for `P`) and error. `run: null` reads "intake failed before a run was
    written".
- **Raw view**: a delivery opens its raw body, pretty-printed from the JSON **string** the door returns.
  It is read-only, with a copy button.
- **Retry** (`POST Orders/{orderId}/Retry`), shown only when `retryable` is true, with a mandatory reason.
  - The confirmation says it re-runs the order's **latest** run only.
  - On success (`requeued: true`), refresh the row: it reads `pending` until the worker runs it.
  - DHS-00012 (no longer failed: done, waiting, cancelled or already has its document) shows inline and
    refreshes the row. DHS-00011 shows inline.

Wire shapes: `C:\Work\DMSCO\BackOffice\.issues\assets\3028-hungerstation-web-door-contract.md`, section Orders
monitor.

## Spine reach

UI → app (BackOffice doors, stubbed until 557)

## Proof (→ `tdd` red-green cycles)

- [ ] `ordersQuery`: the window (required, ≤31 days, the 2000/tomorrow bounds), repeated `outcome`, URL ⇄
  door (vitest)
- [ ] `outcomeLabel` / `runLabel`: four outcomes, `alert` wording, run `C`/`P`/`F` and `null` (vitest)
- [ ] `lineOrder`: a replacement shown right after the line it replaced (vitest)
- [ ] `tools/hungerstation-orders-drive.mjs`, against stubs, LTR and RTL:
  - grid, window, filters, paging;
  - the unmatched alert and its Stores link;
  - the detail drawer, the raw view;
  - retry: success, DHS-00012, hidden when not retryable;
  - the menu entry hidden when `canViewOrders` is false.
- [ ] typecheck, lint, test green

## Boundaries

oms-react only. Gate: `canViewOrders` (Retry is behind the same grant). The Deliverect orders feature is the
model; share what fits in core rather than copying.

## Done when

The helpers and the drive are green; the live check rides 557.

## Blocked by

- [551](551-an-hq-user-lists-onboards-and-edits-hungerstation-stores-with-a-reason.md)

(live: BackOffice 3036, 3037)

## Open questions

- **What a retry acts on (owner, BackOffice 3028).** The contract says the worker reads "the order as it
  stands now". The built handler re-processes the latest run's own raw body, which is the newest status we
  accepted. The UI is the same either way; keep the confirmation wording neutral ("re-runs the order's
  latest run").
