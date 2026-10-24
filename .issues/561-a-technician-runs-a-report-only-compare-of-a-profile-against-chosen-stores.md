---
status: open
spec: 558
blocked-by: 560
---

# 561 — A technician runs a report-only compare of a profile against chosen stores

## What to build

The **New campaign** dialog, in **ReportOnly** mode only (Apply is 564), opened from the Campaigns
page by holders of `canOperate`:

- **Profile:** choose one; its tables are listed with a check box each (all checked by default).
  Unchecking narrows the run; all checked sends no `tables` at all.
- **Targets:** either **the whole fleet** (`fleet: 'all'`), or stores pasted or typed as codes (one
  per line, comma or tab separated, de-duplicated, malformed codes flagged before the call).
- **Name:** optional.
- **Create** → the campaign is **Ready**; the dialog closes onto its campaign page (560), which shows
  a **Start** button while it is Ready. Start → Running.
- **Refusals in the dialog**, each in words: 404 `DATASYNC_PROFILE_NOT_FOUND`; 422
  `DATASYNC_TABLE_NOT_IN_PROFILE`, `DATASYNC_UNKNOWN_STORE` (naming the store),
  `DATASYNC_SOURCE_UNAVAILABLE`; 400 `DATASYNC_INVALID_REQUEST`. A bare 403 hides the button.

## Spine reach

model/api · store/logic · component/route · i18n · test

## Proof (→ `tdd` red-green cycles)

- [ ] `buildCreateRequest`: report-only, tables omitted when all are picked, `fleet: 'all'` vs `storeCodes`, name trimmed and dropped when blank · pure
- [ ] `parseStoreCodes`: lines, commas and tabs split; duplicates collapsed; malformed codes reported with their line · pure
- [ ] `createRefusalWords`: every create code above maps to a sentence key · pure
- [ ] `tools/data-sync-create-drive.mjs`: with stubs, a create posts the exact body, lands on the campaign page, Start posts and the status moves to Running; each refusal shows in the dialog; no button without `canOperate`

## Boundaries

New endpoints: `POST DataSync/Campaigns`, `POST DataSync/Campaigns/{id}/Start`. Codes as above, plus
409 `DATASYNC_INVALID_STATE` on Start.

## Done when

From stubs, a technician creates and starts a report-only campaign for the fleet or for pasted
stores; the helpers and the drive are green.

## Blocked by

[560](560-a-technician-follows-a-campaign-s-jobs-and-each-store-s-tables-as-they-run.md)

## Open questions

- **DataSync ask A (store by code alone).** DataSync's `storeCodes[]` entries are `{client, code}`; the
  estate's store pickers know only `code`. Proposed in spec 558: `client` may be omitted and defaults
  to `DataSync:FleetClient`. The stubbed slice can send `{code}` alone. The live walk (566) needs ask A
  built in `C:\Work\Replicate_SqlDataCompare`, or picked stores are refused 400 there; `fleet: 'all'`
  works either way.
