---
status: done
spec: 430
blocked-by: —
---

# 433 — A payments user finds a document's payments and opens its document or delivery

## What to build

This is the WPF *Document Payment Inquiry* on the web (spec 430 D4, D10, D11).

- **Leaf and route.** The "Document payments" leaf is gated on `canOpenDocumentPayments` (the flag
  431 added). The route is `/oms/document-payments`, with a page guard.
- **Criteria.**
  - From/to dates, defaulting to today.
  - Store.
  - Document type, from the existing cookie-open `SdDocument/DocumentTypes` lookup.
  - Customer phone.
  - Document no(s) and order no(s), which accept a pasted list.
  - Limit, defaulting to 200.
- **The list guard.** More than **1,000** numbers across both boxes is refused before the call,
  with a message naming the count. The numbers are counted with the core code-list splitter, which
  uses the server's `MultiValueFilter` separators. The text is sent as typed.
- **The call.** `GET SdDocumentWeb/DocumentPayments` with the WPF query, reading
  `{ rows: DocumentPaymentModel[], limited }`. The model goes in `@/core/models`. A `limited` result
  says "showing the first N". `TOO_MANY_VALUES` is shown with its message.
- **The grid.** It has the WPF columns: order no, doc type, payment type, method, card type,
  amount (money, in its currency), currency, reference, store, entry time, mobile, delivery type,
  delivery no, delivery note and delivery status.
- **Row actions.** "Open document" always. "Open delivery" only when `deliveryNo` is set.
- **Export** to xlsx.

## Spine reach

model/api · logic (criteria, guard, row offers) · component/route/menu · i18n · test

## Proof (→ `tdd` red-green cycles)

- [x] `paymentsCriteria` — the default is today and limit 200. The 1,000 guard counts both boxes with the shared separators (Excel column, commas, spaces), allows exactly 1,000 and refuses 1,001 · pure
- [x] `paymentRowOffers` — open-delivery only with a delivery no · pure
- [x] `tools/document-payments-drive.mjs` — the guard message, a stubbed search, money/date isolation in RTL, open document and delivery, export, the leaf hidden without the flag · flow

## Boundaries

- A new door, `SdDocumentWeb/DocumentPayments` (BO-3, not filed), built on a stub. The
  `success:false` code is `TOO_MANY_VALUES`.
- A new namespace, `document-payments`.
- The rows carry the customer's phone and name. They are never shown without the grant.

## Done when

The drive is green on the stub, and the gates are green.

## Blocked by

[431](431-an-hq-lead-lists-todays-donor-requests-across-stores-and-filters-them.md) (for the probe flags)

## Comments

**Done 2026-10-07 (AFK).** Built on a STUB of spec 430 D2/D4 — the door
`SdDocumentWeb/DocumentPayments` (BO-3, not filed) is NOT built, so nothing was driven against a
live SIS.Api.

- Proof: vitest `document-payments/criteria.test.ts` (default today + limit 200; the 1,000 guard
  over both boxes with the shared separators, exactly 1,000 allowed, 1,001 refused naming the count;
  the WPF query names, number boxes as typed; the search kept on the history entry) and
  `row-offers.test.ts` (open-delivery only with a delivery no); `core/oms/access.test.ts` and
  `layout/menu-model.test.ts` gained the new flag's reader and leaf. Full suite 215 files green.
  Drive `tools/document-payments-drive.mjs` 66/66 in LTR and RTL (stubbed): leaf hidden + denied
  card without the flag, one probe call, opens on today / 200 with no call until Search, the guard
  message and no call, the wire params, SAR 2 dp / BHD 3 dp / a negative amount, money, dates,
  phones and codes isolated, the limited note, Open document / Open delivery land on Details and
  Back restores the search, Reset clears the result, the xlsx (no actions column, amounts as
  numbers, identities as text, no isolate characters), TOO_MANY_VALUES shown with its message.
  typecheck, lint (4 gates) and build green.
- The guard counts as the server's `MultiValueFilter.Split` does: distinct per box
  (case-insensitive), summed across the two boxes, on the core code-list splitter's separators.
- Model `@/core/models/document-payment.ts` is the WPF `DocumentPaymentModel`, camelCase, nothing
  added. Reader `canOpenDocumentPayments` in `@/core/oms/access` (no new flag, no second probe).
- The leaf sits right after Donor requests; 434 inserts Failed donor transfers between them (D18).
- Rulings logged in `.afk/HITL-433.md`: the column mapping (Document no added; Payment vs Payment
  type; Entry time = `documentDate`), the WPF-only columns left out, distinct counting, search
  kept on the history entry, load on Search.

**Outstanding (not AFK's):** a live walk against a real SIS.Api once BO-3 exists (does
`documentDate` carry a time?); the owner's eye on the Arabic strings
(`src/locales/ar/document-payments.json`) under RTL; the owner rulings in `.afk/HITL-433.md`.
