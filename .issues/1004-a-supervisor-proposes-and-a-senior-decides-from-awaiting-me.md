---
status: open
spec: BackOffice 4456
blocked-by: BackOffice 4479
---

# 1004 — A supervisor proposes hours and a senior decides from Awaiting me; the missing list confirms period hours

Spec: BackOffice `.issues/4456-the-store-hierarchy-and-the-duty-roster-are-kept-in-backoffice-and-fill-omss-storearea-and-storeduty-spec.md`.

## What to build

The chain on the duty page.

- Propose dialog: kind (normal from a date / temporary from–to with reason / period within a coming period), "Also
  for other stores" with whole-patch tick, who it will go to, the past-start warning, the overlap warning.
- Waiting proposal shown dashed beside what is in force: "waiting for <name>, <level> <position>"; withdraw; "start
  a change from this".
- Awaiting me tab with count: store, kind, dates, only changed days before → after, proposer and reason, step, the day
  it moves up; Approve; Reject with a required note.
- Missing period hours tab (supervisor and above): waiting vs nothing proposed, "Confirm last year's hours unchanged"
  for the ticked, "Open the draft".
- Preview toggle: waiting proposals drawn as if approved (screen-side only).

## Spine reach

UI (oms-react) → SIS.Api endpoints of the BackOffice tickets it is blocked by

## Proof (→ `tdd` red-green cycles)

- [ ] `AwaitingMe_BeforeAfterDiff_OnlyChangedDays` · vitest
- [ ] `Reject_RequiresANote` · vitest
- [ ] `PreviewToggle_OverlaysWaiting` · vitest
- [ ] `AlsoForOtherStores_TicksAPatch` · vitest
- [ ] HITL: walked against a BackOffice host in English and Arabic, light and dark

## Boundaries

—

## Done when

Proof green.

## Blocked by

BackOffice 4479
