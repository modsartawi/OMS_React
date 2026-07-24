---
status: done
spec: 083
blocked-by: 090
---

# 091 — theDocumentNumberIsTheLargestThingOnTheScreen

## What to build

The document gets an identity. A **dark band** at the top of the page — the one dark band on the
page, which is why 082 rejected a dark sidebar — carries `documentNo` as the big line, its sub-ids
beneath it, and the customer block at the end, so *whose is this* is answered without a read of the
summary rail. The page title row and the toolbar row above it disappear; **Back becomes a chevron at
the start of the band**, so leaving the screen is always in the same place whether or not any command
is available.

| Slot | Source | Rule |
|---|---|---|
| Big line | `documentNo` | The route key and the id an operator quotes. |
| Overall lozenge | `status.overallStatus` (raw) | Labelled **monospace** code — no `*Description` companion exists. Omitted when blank (3/5 of the corpus). |
| Dawaa Now tag | `isExpressDelivery` | Squared tag in the band, **never a rail pill** — it is an attribute, not a lifecycle state. |
| Sub-ids | `orderNo` · `documentTypeDescription` · `deliveryDocumentTypeDescription` · `documentDate`+`entryTime` · `storeCode` | Descriptions fall back to their codes. "Placed" is one row built from two fields. |
| Customer block (end) | `customer.customerName` · `customer.customerPhone` · `shippingAddress?.cityName` | Duplicated with the Customer card **by design**. |
| Back chevron (start) | — | Navigation; stays put whether or not any command is available. |

`refDocumentNo`, `documentSourceDescription` and `entryUser` move to the All-statuses disclosure's
neighbourhood rather than into the band. `documentCategory` is machinery and stays off-screen.

`DocumentHeader.tsx`'s document and status-summary groups are superseded by this band plus 090's
rail and retire with it.

**One build-time check, a grep and not a redesign:** `isExpressDelivery` is `false` on all five
payloads and the owner reports the source flag is named `IsDeliveryExpress`. Verify our field
actually binds it. If it does not, the Dawaa Now tag renders on nothing — that is a **contract bug to
file**, not a reason to change the band.

## Spine reach

component (identity band, composed by `DocumentDetailsPage`) · pure (sub-id/description fallbacks in
`fields.ts`) · i18n · app-drive

## Proof (→ `tdd` red-green cycles)

- [x] `bandSubIds` — the five sub-id rows build from a captured payload with descriptions falling
      back to codes, and "Placed" composes `documentDate` + `entryTime` into one row · pure (vitest)
- [x] `overallLozengeOmitted` — the three corpus documents with a blank `status.overallStatus`
      produce no lozenge; the two that carry one render it as a raw monospace code · pure (vitest)
      *(the ticket named the wrong document — see Comments)*

Verify the band's appearance and the back chevron by driving `npm run dev` in both themes, plus
`npm run typecheck`.

## Boundaries

New i18n keys for the band's sub-id labels and the Dawaa Now tag's new home. No new API endpoint; no
change to what is fetched. Carries the `isExpressDelivery` / `IsDeliveryExpress` contract check —
record the finding in this ticket's Comments and open a contract bug if the field never binds.

## Done when

The page opens straight into the dark identity band on all five captured documents: `documentNo` is
the largest thing on screen, the sub-ids sit under it, the customer block sits at the end, Back is a
chevron at the start, and the old title row, toolbar row and header field groups are gone.

## Blocked by

[090](090-pill-rail-and-vitest.md) — the rail must exist before `DocumentHeader`'s status summary can
retire, or the state facts leave the screen entirely.

## Comments

### The `isExpressDelivery` / `IsDeliveryExpress` contract check — the field binds, no bug to file

All five captures in `.issues/assets/078-document-payloads/` carry the key **`isExpressDelivery`**
(`false` on 5/5) — the exact name `SdDocumentHeaderModel` binds. `IsDeliveryExpress` is the
server-side property spelling the owner reported; the wire name our model reads is the camelCase one,
and it is present on every payload. **No contract bug is opened.** The tag has simply never had a
true document to render on: `tools/document-band-drive.mjs` flips the one field on a real payload and
asserts the tag appears, which is the rendering half of the check.

### The spec's overall-status example names the wrong document

083 D-2 and this ticket say "`8000000174`'s renders as a raw monospace code". The count is right
(3/5 blank) and the document is not: `8000000174`'s `status.overallStatus` is `''`, and the two that
carry `C` are **`2000000551`** and **`8000000253`**. The tests follow the corpus.

### The band's echo test is exact where the rail's is case-insensitive

`documentTypeDescription: 'Cash'` against `documentType: 'CASH'` is a resolved *word*, so the band
prints "Cash" rather than shouting "CASH" back in monospace. `rail.ts`'s `isCodeEcho` stays
case-insensitive for pills; `fields.ts`'s `isBandCodeEcho` is exact and says why in its own doc
comment. Two spellings of one idea, deliberately — recorded here so the divergence is a decision and
not a drift.

### `refDocumentNo` · `documentSourceDescription` · `entryUser` landed in the disclosure

Deleting `DocumentHeader`'s Document group removed their only render site, and no later ticket claims
them (092's five cards do not list them). They are now a **second `FieldGroup` inside the All-statuses
popover** — D-2's "the disclosure's neighbourhood" — built by `documentProvenanceRows`. The thirteen
status rows themselves are untouched, as D-3 requires.

### Proof, as run

- `npm test` — 28/28 (`fields.test.ts` 11 new assertions over the five payloads, `rail.test.ts` and
  `status-severity.test.ts` unchanged).
- `npm run typecheck` · `npm run build` · `npm run lint` (boundaries · contrast · colour literals) — green.
- `tools/document-band-drive.mjs` — **32/32**, the real app over the five captured payloads in both
  themes: the sub-ids as rendered, the lozenge present/absent per document, `documentNo` measured as
  the largest text on the screen (20px vs 14px), Back at the band's start routing to the list, the
  customer block at its end, the old title/toolbar/field groups gone, and the Dawaa Now tag rendering
  when `isExpressDelivery` is flipped true.
