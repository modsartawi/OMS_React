---
status: open
spec: C:\Work\DMSCO\BackOffice\.issues\3389-orders-and-erx-are-searchable-in-oms-react-and-an-insurance-order-shows-everything-it-received-and-how-it-was-priced-spec.md
blocked-by: 787
---

# 789 — A delivery of an insurance order shows its money strip and links to its order's insurance

## What to build

Backend: BackOffice spec 3389 (`C:\Work\DMSCO\BackOffice\.issues\3389-orders-and-erx-are-searchable-in-oms-react-and-an-insurance-order-shows-everything-it-received-and-how-it-was-priced-spec.md`). SIS.Api minimal APIs, System.Text.Json web defaults (camelCase).

On a delivery's Details page, for a delivery whose order is an insurance order: a compact strip with the money source, the order's patient total and insurer total, and **the delivery's own amount due** beside them (the figure a driver collects), and a link to the order's Insurance section. Without the insurance-view grant the strip shows the money only and no link.

## Spine reach

UI (oms-react)

## Proof (→ `tdd` red-green cycles)

- [x] `delivery money strip: shows source, patient, insurer and the delivery's amount due` · vitest
- [x] `delivery money strip: no link without the insurance grant` · vitest

## Boundaries

Read-only.

## Done when

Proof tests green.

## Blocked by

[787](787-document-details-shows-an-insurance-orders-money-verdict-its-lines-how-each-was-priced-and-the-gap-to-engine-money.md)

## Comments

### 2026-11-05 — implemented (stubbed; the door is not built)

- **Proof.** Both boxes green in `src/features/oms/document/delivery-money-strip.test.ts` (pure model
  `delivery-money-strip.ts`: `asksDeliveryMoneyStrip`, `deliveryMoneyStrip`, `orderRowOf`), plus
  `delivery-money-strip-i18n-keys.test.ts` (EN + AR `document:moneyStrip.*` mirror). Money in the order's currency
  decimals (`formatMoneyIn` via 787's `moneyCell`; BHD → 3 dp); an unknown total reads None, never `0.00`.
- **UI.** `DeliveryMoneyStrip.tsx`, self-contained (asks its own read), placed with one line in
  `DocumentDetailsPage.tsx` full width after the LF return panel, before 787's Insurance section and the two
  columns. CHANNEL/ENGINE badge (787's `moneySourceBadge`), patient total, insurer total, **this delivery's amount
  due** (`document.amountDue`), each in an `Ltr` isolate (`InsuranceCell`); with the insurance-view grant a link to
  `/oms/document/${refDocumentNo}#insurance`. No controls; the link is a `<Link>` with `buttonClass('link')`.
- **Data source (choice).** The order's search row, `GET SdDocumentWeb/OrderDocumentList?DocumentNo=<refDocumentNo>`
  (BackOffice 3391, an identifier search so the date is ignored), called from this feature's own
  `documentApi.getOrderRows` — never from the Order list feature (786). Chosen because it runs under the OMS
  **list** grant (`canOpenList`), so the money shows without the insurance-view grant (story 70), while 3390's
  insurance read needs that grant. The row is asked only on the delivery route, for a delivery with a
  `refDocumentNo`, under `canOpenList`; the strip draws only when the row says `isInsuranceOrder: true`. A 403 draws
  nothing; any other failure is said in place (`ErrorBanner` + `apiErrorMessage`).
- **Drive.** `tools/delivery-money-strip-drive.mjs`, LTR + RTL, **28/28**: strip above the columns, CHANNEL,
  63.65 / 2.66 / the delivery's 40.50 in ltr isolates, the row asked by `DocumentNo`, the link lands on the order's
  `#insurance` section; without the insurance grant money and no link; no strip for a non-insurance order, without
  the list grant (no read), or on the order's own page (no read); a failing read said in place.
  `tools/insurance-section-drive.mjs` (787) still 38/38 — it found that a malformed `{}` answer crashed
  `orderRowOf`; it now reads as no row (tested).
- **Gates.** typecheck green; `npm test` 656 files / 9022 tests green; lint: the 4 inherited boundary hits in
  `insurance-rules/aliases/door-shapes.test.ts` only, the other four gates green, control ratchet unchanged.
- **Still open.** "Done when" is met on stubs; the live walk waits on BackOffice **3391** (and 3390 for the link's
  target). Don't ship before 3391 is deployed: every delivery would ask a door that is not there and say the
  failure in place for every list-grant holder.

#### Owner questions

1. **The gap of the list-door source.** A session holding the detail grant (`canOpenDetail`) but **not** the list
   grant (`canOpenList`) sees no strip at all. Accept, or ask BackOffice for an additive
   `insuranceMoney { moneySource, patientTotal, insurerTotal, currency }` on `GET SdDocumentWeb/Delivery/{no}`
   (behind the detail grant) — which would also drop the second call and the `DocumentNo` parameter guess.
2. **Currency.** The delivery's amount due is formatted in the order row's `currency` (same store). The row's
   `currency` is itself a client ask on 3391; absent, it reads as 2 decimals.
3. **Refresh.** The page's Refresh does not re-read the order row (the strip asks its own read; order totals don't
   move under a delivery). Say if it should.

