---
status: open
spec: C:\Work\DMSCO\BackOffice\.issues\3389-orders-and-erx-are-searchable-in-oms-react-and-an-insurance-order-shows-everything-it-received-and-how-it-was-priced-spec.md
blocked-by: — (server: BackOffice 3391)
---

# 786 — The Order / ERX list finds an order by any identifier, with Bupa Care Connect and No-delivery-yet lenses

## What to build

Backend: BackOffice spec 3389 (`C:\Work\DMSCO\BackOffice\.issues\3389-orders-and-erx-are-searchable-in-oms-react-and-an-insurance-order-shows-everything-it-received-and-how-it-was-priced-spec.md`). SIS.Api minimal APIs, System.Text.Json web defaults (camelCase). Door: BackOffice 3391 `GET SdDocumentWeb/OrderDocumentList`.


A new route beside `oms/deliveries` built on the delivery list's shell, as its own feature (a feature never imports
another — shared pieces move to `core/`): query-bar tokens with the criteria of BackOffice 3391, relative date kept
in saved views, the identifier-ignores-date rule mirrored client-side, lenses **All / Bupa Care Connect** (type BUPA,
source ERX) **/ No delivery yet / CHANNEL / ENGINE**, an inspector pane, the status bar (exact vs "at least"), Excel
export **without patient and member ID unless the insurance-view grant is held**. A row opens Document Details
(`oms/document/:documentNo`); a row with a delivery links its delivery. EN + AR, RTL, the bidi rule.

## Spine reach

UI (oms-react)

## Proof (→ `tdd` red-green cycles)

- [x] `order-list query model: identifiers ignore the date, other tokens need a range ≤ 31 days` · vitest
- [x] `order-list lenses: Bupa Care Connect / No delivery yet / CHANNEL / ENGINE match their rows` · vitest
- [x] `order-list saved view keeps a relative date` · vitest
- [x] `order-list export leaves patient and member ID out without the insurance grant` · vitest

## Boundaries

Read-only screen; door stubbed until BackOffice 3391 is on staging.

## Done when

Proof tests green; the list finds 1006358459 by approval against the real door on dev.

## Blocked by

Server: BackOffice [3391](C:\Work\DMSCO\BackOffice\.issues\3391-the-order-search-finds-orders-and-erx-by-any-identifier-before-they-have-a-delivery.md)

## Comments

**2026-11-05 — implementer (branch `impl/786`).** Built against a STUB of 3391; the door is not built yet.

- **Prefactor (pure move, deliveries suites unedited):** `src/core/list/relative-date.ts` (presets,
  `resolveDate`, `dateEntryOf`), `lens-count.ts` (`lensKit`, `isCut`, exact vs "at least" wording),
  `saved-view-store.ts` (the generic half of saved views, bound per list by `savedViewStore({...})`),
  `list-keys.ts` (J/K/I/`/`, Limit bounds, inspector prefs, `nextRowIndex`), and
  `src/core/ui/use-popover-dismiss.ts`. `features/oms/deliveries/*` re-export every old name.
- **The list:** `features/oms/orders/` (namespace `orders`, EN + full AR), route `/oms/orders`
  (single keys on), menu leaf under OMS on the shared `canOpenList` probe. Query bar with 3391's
  criteria (identifier group = `ORDER_IDENTIFIER_FIELDS`; an identifier sends no date and the Date
  token reads "ignored"; otherwise a range ≤ 31 days, default last 3, refused client-side with a
  reason before any call); lenses All / Bupa Care Connect / No delivery yet / Channel / Engine;
  saved views (relative Date) under `oms.orders.views.v1:<user>`; inspector; status bar; export.
  Patient / member ID — token, column, inspector line, export — only with `canViewInsurance`.
- **Proof:** the four vitest proofs are green (`query-model`, `lenses`, `saved-views`, `export`
  tests) plus an en/ar mirror test. `tools/order-list-drive.mjs` (stubbed door, LTR + RTL, with and
  without the grant): 56/56.
- **Still open:** "finds 1006358459 against the real door on dev" waits on BackOffice 3391.
- **Guesses to confirm with BackOffice (3391):** the coded criteria (`DocumentType`,
  `DocumentSource`) send the CODE (`BUPA`, `ERX`), not the lookup description the delivery list
  sends (R-3); `Status` is a free-text code until the value set is named; `HasDelivery` as
  `true`/`false`; `Limit` always sent (default 500). A row opened from this list lights the
  Deliveries menu leaf (it owns `/oms/document`), deliberately left as is.
