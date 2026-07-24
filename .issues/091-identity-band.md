---
status: open
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

- [ ] `bandSubIds` — the five sub-id rows build from a captured payload with descriptions falling
      back to codes, and "Placed" composes `documentDate` + `entryTime` into one row · pure (vitest)
- [ ] `overallLozengeOmitted` — the three corpus documents with a blank `status.overallStatus`
      produce no lozenge; `8000000174`'s renders as a raw monospace code · pure (vitest)

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
