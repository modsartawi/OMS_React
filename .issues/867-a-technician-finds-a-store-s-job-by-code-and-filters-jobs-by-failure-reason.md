---
status: done
spec: 863
blocked-by: —
---

# 867 — A technician finds a store's job by code and filters jobs by failure reason

## What to build

**DataSync:** `GET /Campaigns/{campaignId}/Jobs` gains optional `store` (case-insensitive contains on
the store code; the client part is not searched) and `failureReason` (a job failure reason code; an
unknown one is refused like an unknown `status`). All filters AND together; paging and order
unchanged. The search binds as a bounded ANSI string, never unicode, so it stays a seekable
predicate. OpenAPI draft, DataSync spec §4, Postman contract updated.

**oms-react:** a store search box and a failure-reason select beside the status select on the
campaign page. All three filters and the page live in the page address; any filter change resets to
page one; the empty state says *nothing matches the filter* (not *no jobs*) when a filter is set.
View is enough. English + Arabic strings.

## Spine reach

DataSync door + query · contract · model/api · view state · grid · i18n · test

## Proof (→ `tdd` red-green cycles)

- [x] `Jobs_StoreFilter_PartialAndCaseInsensitive` — seed ≥ 8 stores; `p01` finds exactly the P01… jobs · DataSync.IntegrationTests (`CampaignReadTests` family)
- [x] `Jobs_FailureReasonFilter_CombinesWithStatusAndStore` · DataSync.IntegrationTests
- [x] `Jobs_UnknownFailureReason_Refused` · DataSync.IntegrationTests
- [x] `Jobs_Filtered_PagesOverTheFilteredSet` · DataSync.IntegrationTests
- [x] Postman contract run green · `test.ps1`
- [x] `jobsQuery` / jobs-view address round-trip with `store` + `failureReason`, page reset on change · pure (oms-react)
- [x] `tools/data-sync-jobs-drive.mjs` (or the 560 drive extended) — typing a code and picking a reason reach the door; the filtered-empty text shows · stubbed drive

## Boundaries

DataSync package deploy; no migration. No flag, no new grant.

## Done when

All Proof boxes green; on the demo kit a fleet campaign's job is found by typing part of its code on
page one.

## Blocked by

None — can start immediately.
