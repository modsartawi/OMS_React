---
status: done
spec: —
blocked-by: BackOffice 2458
---

# 429 — A delivery's donor requests appear on its Delivery timeline

**Source:** grilled 2026-10-07 in a BackOffice session (`/grill-with-docs`, no spec).
**Live:** BackOffice 2458 provides the read. Build against a stub of the wire contract below, then do the
live walk once 2458 is merged.

## Wire contract

`GET SdDocumentWeb/Delivery/{deliveryNo}/DonorRequests` (cookie + Delivery details grant) answers in the
usual envelope with a list. Live requests come oldest first and CANCELLED ones last. Fields the timeline
reads:

```
requestNo, deliveryNo, orderStore, donorStore,
state: "OPEN" | "FULFILLED" | "TRANSFERRED" | "CANCELLED",
outcome: "" | "CANCELLED" | "REFUSED" | "EXPIRED", outcomeReason, outcomeBy, outcomeAt,
raisedBy, raisedAt, changedBy, changedAt, fulfilledAt, lockedBy, lockedAt,
transferStoNo, transferSapDocumentNo, transferredAt,
picked, required          // units given / asked
```

An unset time is `0001-…`. `realTime()` already treats it as no time.

## What to build

- **Load it.** `DocumentDetailsPage` loads the door as a fourth `Deferred` beside logs and jobs, for
  deliveries only.
  - If it fails, the rest of the spine still renders, with an inline error line for the donor rows.
  - The model goes in `@/core/models`.
- **Derive donor moments in `@/core/oms`.** This is a pure function next to `timeline-feed.ts`. Each
  request gives one point row per time it has set:

  | Moment | Time | Row says |
  |---|---|---|
  | Raised | `raisedAt` | donor store, units asked, `raisedBy` |
  | Edited | `changedAt` | `changedBy` |
  | Picked | `fulfilledAt` | `picked`/`required` units |
  | Stamped | `lockedAt` | `lockedBy` |
  | Transferred | `transferredAt` | STO `transferStoNo` |
  | Ended | `outcomeAt` | outcome (cancelled / refused / expired) + `outcomeReason` + `outcomeBy` |

  - Each time is the latest one only: a repick or a second edit replaced the earlier time on the server.
  - A cancelled request stays on the timeline as history.
  - A request cancelled after it was transferred (reversed by hand) shows both Transferred and Ended.
  - There is no row for "transfer started" (STO set but no time). The DRTR job row covers it.
- **Merge into `past`.** A new `SpineEntry` kind, `donor`, joins the newest-first merge on `at`.
  - Ties follow the existing rule: a Log row first, so Stamped sits directly under the Ready milestone at
    the same instant.
  - Within donor rows a tie falls back to the moment order above.
- **Waiting line.** While a request is OPEN and has no `fulfilledAt`, a line "Waiting on donor D012 ·
  1h 20m" (elapsed since `raisedAt`) sits above **Now**, below the future steps. It goes away once the
  request is picked or ended. Two such requests get two lines.
- **Look.** Every donor row and the waiting line use one donor icon (`ArrowLeftRight`) in the primary tone.
  An Ended row takes its outcome's tone: refused and expired are `attention` (amber), cancelled is muted.
- **The DRTR job row names its donor.** When a job's `documentNo` equals the `requestNo` of one of this
  delivery's requests, its label becomes "Donor transfer to DRS · {donorStore}" with the donor icon tint.
  Its job state, failed banner and retrying line are unchanged.
- **Strings.** Add English and Arabic strings in the `document` namespace. The owner reads the Arabic.
- **Glossary.** Add to `CONTEXT.md`:
  - **Donor request:** the order store's named ask to one donor store for units it cannot fill. Point at
    BackOffice `CONTEXT.md` for the full meaning.
  - **Donor moment:** a point on the Delivery timeline taken from a donor request's own record, not from
    the delivery's Log.

## Proof (→ vitest)

- [x] Each moment in the table becomes one row with its time, and an unset time gives no row.
- [x] A cancelled request that was transferred gives both Transferred and Ended rows.
- [x] Merge order: a donor row interleaves with Log and job rows on `at`, and Stamped lands under Ready
  at a tie.
- [x] The waiting line shows for an OPEN, unpicked request only, and is gone once `fulfilledAt` or
  `outcomeAt` is set.
- [x] The DRTR job row is labelled with the donor store only when its `documentNo` matches a request.
- [x] A failing donor read leaves the rest of the spine rendered, with the inline error.

## Boundaries

- The Delivery details spine only. The deliveries-list inspector is untouched.
- Read-only. Nothing on the timeline acts on a donor request.
- No repick history (owner decision: latest state only).

## Done when

Vitest, lint and typecheck are green. A stubbed drive shows a delivery with a transferred request, a
refused request and an open request. The live walk on a pilot-store delivery waits on BackOffice 2458.

## Blocked by

BackOffice [2458](C:/Work/DMSCO/BackOffice/.issues/2458-oms-react-reads-a-deliverys-donor-requests.md)
(live only; build against the stub).

## Comments

**2026-10-07 — built (`/implement`).** Done against a STUB of the 2458 contract; the live walk on a
pilot-store delivery still waits on BackOffice 2458.

- **Seams.** Pure `@/core/oms/donor-moments.ts` (`donorMoments`, `waitingOnDonor`, `donorOfJob`,
  `donorOutcome`, `elapsedSince`); `timeline-feed.ts`'s `feed`/`spine` take an optional fourth read and
  gain a `donor` entry kind, a `donor` field on job entries and a `waiting` list. Model
  `DonorRequestModel` in `@/core/models/sd-document`; `documentApi.getDonorRequests`; the page loads it
  as a fourth `Deferred`, deliveries (category D) only, and a return asks for nothing.
- **Proof.** `src/core/oms/donor-moments.test.ts` (11 tests) covers the six boxes; the last one is the
  pure half (a `null` donor read leaves `spine()` unchanged) plus the drive. Tests were written
  alongside the module, not strictly red-first. `tools/document-donor-drive.mjs` **18/18** stubbed, LTR
  and RTL: a transferred (D012), a refused (D044) and an open (D077) request, the waiting line
  "Waiting on donor D077 · 1h 20m", the amber refused row, "Donor transfer to DRS · D012", the
  inline error on a failed read, and no read for a return. Twelve older document drives were taught
  the new read (an empty list) so their spines stay error-free; `document-spine-drive` 92/92 after.
  `npm test` 3923/3923, lint, typecheck and build green.
- **Calls made here (owner may overrule).**
  - Tie order across sources is Log → donor → job (the ticket fixed only "Log first").
  - The DRTR row keeps its job-state icon as the dot and puts the donor icon, primary-tinted, inline
    before the label.
  - The elapsed time is isolated with a dir-auto `<bdi>`, not `Ltr`: it carries words (`1h 20m`,
    `1 س 20 د`) and an LTR isolate would reverse the Arabic one.
  - An Ended row with no `outcome` reads "Donor request … ended", muted.
  - Edited follows the table literally: any set `changedAt` is a row. If the live server stamps
    `changedAt` on raise or on pick, the walk will show a spurious Edited row — check it on 2458.
- **Arabic.** Strings are in `src/locales/ar/document.json` for the owner to read; the app still runs
  `lng: 'en'`, so nothing renders them yet.
