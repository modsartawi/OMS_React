---
status: done
spec: C:\Work\DMSCO\BackOffice\.issues\3042-serving-lists-and-store-duty-for-callouts-spec.md
blocked-by: — (live: BackOffice 3047 deployed)
---

# 572 — The dispatch board shows a callout's serving list and duty-removed count

## What to build

**Two board fields and two reasons**, for BackOffice spec 3042 (stories 22–24). The contract is the spec's
`## Comments` → "oms-react hand-off (2026-10-25)". A dispatcher can then tell "few stores nearby" from "the list or
the duty check narrowed the race".

- **Model** `core/models/dispatch-board.ts` (541's). `DispatchCallout` gains these fields beside `candidateCount`:
  - `servingListId`: `''` when the type had no list;
  - `servingListNameEn` and `servingListNameAr`: `''` when the list is gone, so show the id alone;
  - `dutyRemovedCount`.

  `DeliveryCalloutRecord` on `SdDocumentWeb/Delivery/{no}/Callout` inherits them, so 542's Callout sub-tab gets them
  too.
- **Reasons:** add `ServingListInactive` and `DutyLeftFewerThanTwo` to `CALLOUT_NOT_OPENED_REASONS`
  (`core/models/delivery-callout.ts`), with EN + AR labels in the board's and the timeline's namespaces:
  - `ServingListInactive`: "Serving list inactive or empty". The type's list is deactivated, missing or has no enabled
    member, so nothing was competed;
  - `DutyLeftFewerThanTwo`: "Fewer than two stores on duty".

  They count in the `NotCompeted` tile with no door change.
- **Inspector (541) and Callout sub-tab (542):** beside the candidate count, show:
  - **Serving list**: the name in the UI language, falling back to the id, or "—" when blank. Make it a link to
    `/oms/serving-lists/:id` only when `canViewServingLists` (567's probe). Otherwise show plain text;
  - **Removed by duty**: `n`, shown only when it is above 0.

## Spine reach

model · logic (inspector serving-list cell, reason labels) · inspector + sub-tab · i18n EN + AR · test

## Proof (→ `tdd` red-green cycles)

- [x] view: list name by language → id fallback → "—"; duty-removed hidden at 0; both new reasons have labels; an
      older payload without the four fields still parses (vitest)
- [x] drive script, LTR and RTL, against the board stub extended with an opened callout drawn from a list (duty removed
      3), a `ServingListInactive` and a `DutyLeftFewerThanTwo` not-opened row: the inspector, the not-competed tile,
      the sub-tab
- [x] `npm run typecheck`, `npm run lint`, `npm test` green

## Boundaries

- Doors: BackOffice 3047 (`DispatchBoard/Board`, `SdDocumentWeb/Delivery/{no}/Callout`), on branch `spec3042`,
  stubbed until deployed with `Callouts/Sql/002` and `003`.
- The scorecard (543) is unchanged: it already counts only offered bids.
- The link to the list waits on 567's route; until then, show the name without a link.

## Done when

The Proof boxes are ticked: on the running app (stubbed), the board's inspector and a delivery's Callout sub-tab show
the serving list and the duty-removed count, and the two new not-competed reasons read as words.

## Blocked by

— (the link to the list uses 567 when present)

## Open questions

—

## Comments

### Built 2026-10-25 (stubbed)

- Pure view in `core/dispatch/view.ts` (`servingListView`, `dutyRemovedView`, `servingListHref`) + the shared cell
  `core/dispatch/ServingListName.tsx` (`canLink`); vitest `core/dispatch/serving-list.test.ts` (8).
- The four fields are **optional** on `DispatchCallout`: a pre-3042 payload reads as no list ("—") and no duty count.
- The link is wired on 567's probe (`servingListAccessQuery()` / `canViewServingLists`) on the board and on Delivery
  details (asked there only when a callout carries a list). Its target `/oms/serving-lists/:id` arrives with 568.
- Drives (STUBBED, LTR + RTL): `tools/dispatch-board-drive.mjs` 116/116, `tools/delivery-callout-drive.mjs` 96/96.
- Rulings (overrulable): the reason words are lowercase like their siblings ("serving list inactive or empty",
  "fewer than two stores on duty"), shown mid-sentence; the duty count reads "removed by duty n"; AR wording
  ("قائمة الخدمة", "استبعدتهم المناوبة") wants an Arabic sign-off.
- Live walk rides BackOffice 3047 deployed + `Callouts/Sql/002`, `003`.
