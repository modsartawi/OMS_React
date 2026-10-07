---
status: open
spec: 430
blocked-by: 431
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

- [ ] `paymentsCriteria` — the default is today and limit 200. The 1,000 guard counts both boxes with the shared separators (Excel column, commas, spaces), allows exactly 1,000 and refuses 1,001 · pure
- [ ] `paymentRowOffers` — open-delivery only with a delivery no · pure
- [ ] `tools/document-payments-drive.mjs` — the guard message, a stubbed search, money/date isolation in RTL, open document and delivery, export, the leaf hidden without the flag · flow

## Boundaries

- A new door, `SdDocumentWeb/DocumentPayments` (BO-3, not filed), built on a stub. The
  `success:false` code is `TOO_MANY_VALUES`.
- A new namespace, `document-payments`.
- The rows carry the customer's phone and name. They are never shown without the grant.

## Done when

The drive is green on the stub, and the gates are green.

## Blocked by

[431](431-an-hq-lead-lists-todays-donor-requests-across-stores-and-filters-them.md) (for the probe flags)
