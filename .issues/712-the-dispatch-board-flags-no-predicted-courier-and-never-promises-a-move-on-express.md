---
status: open
spec: C:\Work\DMSCO\BackOffice\.issues\3306-a-quick-commerce-callout-reaches-only-oto-ready-stores-and-oto-hears-the-winner-spec.md
blocked-by: —
---

# 712 — The Dispatch board flags a delivery with no predicted courier, and never promises a move on an express delivery

## What to build

Backend: BackOffice branch `spec3306`, ticket 3311 (not merged yet).

Fields added to `DispatchCallout` (`src/core/models/dispatch-board.ts`), on `GET DispatchBoard/Board` and
`GET SdDocumentWeb/Delivery/{no}/Callout`:

- `isExpressDelivery: boolean`
- `courierQuote: DispatchCourierQuote | null` (null = no quote yet)

`DispatchCourierQuote`: `outcome` (`'Quoted' | 'NoCourier' | 'Failed' | (string & {})`), `checkedAt`, `storeCode`,
`deliveryCompanyName`, `price`, `currency`, `estimatedDeliveryDate` (OTO's own text: show as is, never parse).
Company, price, currency and ETA are empty or 0 unless `Quoted`.

**Flagging.** A visible attention flag on the board row and Inspector for `NoCourier` and `Failed`, including on
Closed rows. `NoCourier`: "OTO predicted no courier". `Failed`: "Courier check failed". Show `checkedAt`. Neither means
the order failed; the OTO order is created anyway. `Quoted`: a quiet "Predicted: {company}, {price} {currency}, ETA {text}".
Always say "predicted". `null`: no flag.

**No-move wording, when `isExpressDelivery` is true.** Near Release lock and in `ReleaseLockDialog`: "Releasing the lock does
not free a store move on this delivery: an express delivery keeps its store once its OTO order exists. To get out of it,
cancel the delivery." Arabic draft, to be reviewed: "فك القفل لا يتيح نقل هذا التوصيل إلى متجر آخر: يبقى التوصيل السريع في متجره بعد إنشاء طلب OTO. للخروج منه، ألغِ التوصيل."
Do not point to Change store, and do not hide Release lock: a release still frees the holding store's own cancel.

**Not-opened reasons.** Add to `CALLOUT_NOT_OPENED_REASONS` (`src/core/models/delivery-callout.ts`) and the `dispatch-board`
and `document` locales: `CoverageUnavailable` "OTO coverage could not be checked" / "تعذر التحقق من تغطية OTO";
`CoverageEmpty` "OTO listed no stores for this address" / "لم تُدرج OTO أي متجر لهذا العنوان".

## Boundaries

No new grants: same `DispatchBoard` gate.

## Done when

The flags, wording and labels show against the merged backend.

## Blocked by

BackOffice branch `spec3306` merged and deployed.

## Comments

**2026-11-03 — client half built (branch `impl/3326-712`), stubbed.** Matched to BackOffice 3311 as built (`1d09a8d94`):

- `DispatchCallout` gains `isExpressDelivery`, `storeMoveAvailable` (on the wire too: `!isExpressDelivery`) and
  `courierQuote: DispatchCourierQuote | null`. All three are **optional** in the model, as spec 3042's fields were, so a
  callout read before 3311 deploys reads as no quote and not express.
- Pure `core/dispatch/courier-quote.ts`: `courierQuoteView` (none / flag on `NoCourier`+`Failed` / quiet `Quoted` /
  an unknown outcome quietly as it came) and `releaseFreesNoMove`. Price and currency are one isolated value; OTO's ETA
  text is shown as it came.
- Board: a new **Courier** column on both grids flags `NoCourier` / `Failed` with the check time (closed rows
  too). Inspector: the flag with "checked …" and "A prediction only: the OTO order is created anyway.", or "Predicted:
  {company}, {price currency}, ETA {text}".
- Express: the no-move sentence sits under the locked line, in `ReleaseLockDialog` (which then uses the plain
  `release.explain`, never `explainHeld`'s "moved to another store"), and replaces Change store after a release.
  Release lock stays offered. Delivery details passes the flag to the dialog and its success toast uses a new
  `callout.release.doneDetailExpress` instead of promising a move (my wording, EN + AR draft: owner to review).
- `CoverageUnavailable` / `CoverageEmpty` in `CALLOUT_NOT_OPENED_REASONS`, both locales, board and document.

**Proof (stubbed — no live SIS.Api):** `src/core/dispatch/courier-quote.test.ts` 10/10; `npm test` 600 files / 8455
tests green; `npm run typecheck` clean; `tools/dispatch-board-drive.mjs` extended with section 9 (712), **141/141** in LTR
and RTL. Lint: grid-base, contrast, palette and controls gates clean; the boundaries gate fails on the base already
(4 `insurance-rules/aliases` test imports from the 3271 merge), none in this change.

**Open:** the live walk against the merged and deployed `spec3306` (still the Blocked by), and the owner's review of
the Arabic drafts (`release.noMove` as given, plus the quote flags and `doneDetailExpress`, which are mine).
