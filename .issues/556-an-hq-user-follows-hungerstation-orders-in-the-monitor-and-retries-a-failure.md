---
status: done
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

- [x] `ordersQuery`: the window (required, ≤31 days, the 2000/tomorrow bounds), repeated `outcome`, URL ⇄
  door (vitest)
- [x] `outcomeLabel` / `runLabel`: four outcomes, `alert` wording, run `C`/`P`/`F` and `null` (vitest)
- [x] `lineOrder`: a replacement shown right after the line it replaced (vitest)
- [x] `tools/hungerstation-orders-drive.mjs`, against stubs, LTR and RTL:
  - grid, window, filters, paging;
  - the unmatched alert and its Stores link;
  - the detail drawer, the raw view;
  - retry: success, DHS-00012, hidden when not retryable;
  - the menu entry hidden when `canViewOrders` is false.
- [x] typecheck, lint, test green

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

## Comments

**Done 2026-10-24** (branch `ticket/556`). Proof: vitest (`features/hungerstation/orders/orders-query.test.ts`,
`order-outcome.test.ts`, `order-lines.test.ts`, `i18n-keys.test.ts`; `core/util/date-window.test.ts`,
`filter-choices.test.ts`, `raw-json.test.ts`), typecheck + lint (4 gates) + `npm test` green (6150), and
`tools/hungerstation-orders-drive.mjs` **101/101 against STUBS** (LTR and RTL, three clean runs in a row).
🚩 Not driven against a live SIS.Api — the live walk is 557.

Shared with Deliverect by graduating to core (a feature never imports another):
- `core/util/date-window.ts` — `localToday`, `addDays`, `windowDays`, `windowProblem(from, to, { maxDays, earliest?, latest? })`
  (adds `outOfBounds`). Deliverect's `orders-query.ts` now delegates to it (its exports and tests unchanged).
- `core/util/filter-choices.ts` — `toggled`, `keyChoices`. Deliverect's `toggled`/`platformChoices` delegate.
- `core/util/raw-json.ts` — `rawView` (the value-preserving re-indent), its tests moved with it from Deliverect.
- `core/ui/SideSheet.tsx` — the native-`<dialog>` side-sheet frame. Deliverect's `OrderDrawer` and `RawDrawer`
  now use it; the Deliverect orders drive re-ran **91/91** after the move. The stores-feature drawers
  (`SyncLogsDrawer`, `StatusHistoryDrawer`, `MaterialHistoryDrawer`) still carry their own copy — moving them is
  a follow-up, not this ticket's.

Registration: route `/hungerstation/orders` → `features/hungerstation/orders/OrdersPage`; namespace
`hungerstation-orders` (EN + AR, six Arabic plural forms) registered in `core/i18n.ts`. The menu leaf already
existed (551, on `canViewOrders`). `src/app/HungerStationPlaceholderPage.tsx` stays: Materials (555) still opens
it, so 555 deletes it once it lands.

Judgement calls (overrulable):
1. **The unmatched alert** paints the row on the attention ground and badges *Store not onboarded*; its link
   opens `/hungerstation/stores?q=<vendorId>` (the Stores search matches vendor ids, so a removed store with that
   id shows there to revive). The link shows whatever the viewer's grants — the Stores page gates itself. The
   drawer of an unmatched order leads with the same alert and link. An alert the contract does not name reads
   *Needs a person* rather than vanishing.
2. **Outcome tones:** created ok, failed bad, cancelled neutral, pending *in motion* (`go`), not a warning.
   Run tones: `C` ok, `P` in motion, `F` bad, no run bad.
3. **Window bounds** are checked locally (from ≥ 2000-01-01, to ≤ tomorrow local) with their own sentence; the
   server's 400 `HungerStationWindowInvalid` still shows inline beside the dates with its words and code, never
   as the generic failure banner.
4. **Page size 100** (the contract's default `take`). No Excel export — the ticket names none (Deliverect's has
   one); add it if the owner wants parity.
5. **The document number is plain text**, not a link to `/oms/document/…` as Deliverect does — the contract does
   not say which document screen a HungerStation document opens on. One line to add if it is the OMS one.
6. **The chain filter** is a select fed by `Chains`; that read rides `canManageStores`, so an orders-only user
   gets the chains seen on the rows (remembered across filters), the Deliverect platform fallback.
7. **Retry** uses the area's reason dialog (`core/hungerstation/ReasonDialog`); DHS-00012 and DHS-00011 show
   inline in the dialog (`handledCodes`, so never twice), DHS-00012 also refreshes every orders read, DHS-00008
   under the reason. A success with `requeued: false` (the contract never names one) toasts *Nothing was put
   back* rather than claiming success. Wording stays neutral per the open question: *re-runs the order's latest
   run only*.
8. **Deliveries are sorted oldest first** client-side too, and lines go through `lineOrder` even though the door
   already orders them — both are cheap guards, and the drive feeds them out of order to prove it.

Observed, not fixed (551's code): the core `ReasonDialog` clears its field in `onShow`, which can land just after
the first keystrokes when the dialog has only just mounted; a human cannot type that fast, but the drive retypes
until Confirm is enabled. Also, a filter `update` builds on the query of the last render (Deliverect's shape too),
so the drive waits for a rendered sign between two date changes.

Open for the owner: the Arabic copy is unread by a native eye (the app's `lng` stays `en`; the drive's RTL pass
is direction only). The retry-semantics question (BackOffice 3028) stays open; the UI is the same either way.

