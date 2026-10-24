---
status: done
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

- [x] `buildCreateRequest`: report-only, tables omitted when all are picked, `fleet: 'all'` vs `storeCodes`, name trimmed and dropped when blank · pure
- [x] `parseStoreCodes`: lines, commas and tabs split; duplicates collapsed; malformed codes reported with their line · pure
- [x] `createRefusalWords`: every create code above maps to a sentence key · pure
- [x] `tools/data-sync-create-drive.mjs`: with stubs, a create posts the exact body, lands on the campaign page, Start posts and the status moves to Running; each refusal shows in the dialog; no button without `canOperate`

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

## Comments

**Built 2026-10-24** (branch `ticket/561`). Vitest `create-helpers.test.ts` 19/19; drive
`tools/data-sync-create-drive.mjs` 36/36 against stubs; typecheck, lint, `npm test` green.

What landed: `create-helpers.ts` (`buildCreateRequest`, `parseStoreCodes`, `createRefusalWords`,
`startRefusalWords`, `CREATE_REFUSAL_CODES`), `NewCampaignDialog.tsx` (`NewCampaignButton` beside the
campaigns status filter), `StartCampaignButton.tsx` (filled into the campaign page's `headerActions`
seam), `dataSyncApi.createCampaign` (`postEnvelope`, so 564 reads the create warnings in `errors[]`)
and `.startCampaign`, `TargetStoreRef` in `core/models/data-sync.ts` (`client` optional), i18n
`create.*`, `start.*`.

Decisions an owner may overrule:
- **What counts as a malformed store code:** letters, digits, `-`, `_`, at most 20, starting with a
  letter or digit. A space inside a piece (`P 9`) or `;` is malformed, not a separator: the ticket
  names lines, commas and tabs only.
- **De-duplication is case-insensitive**, keeping the first spelling (`P003` and `p003` are one).
  Codes are sent as typed, not upper-cased.
- **Start has no confirm dialog** — the campaign is already reviewed on its page and Start runs
  report-only. 564 may want one for Apply.
- A Start refusal re-reads the page (so a campaign someone else started shows Running, and Start goes).
- A bare 403 from create closes the dialog and hides New campaign for the page's life; same for Start.
- `buildCreateRequest` already sends `reason` (trimmed) for `mode: 'Apply'`, and
  `CREATE_REFUSAL_CODES` already words `DATASYNC_REASON_REQUIRED`, `DATASYNC_PROFILE_NO_APPLY_TABLES`
  and `DATASYNC_STORE_BUSY`, so 564 adds the mode switch and the reason field without a rewrite.

Deferred: DataSync ask A — stores are sent as `{ code }` alone; the live door refuses that with a 400
until ask A is built (566 owns it). Create warnings on success (`errors[]`) are not shown: a
report-only create never carries any; they are 564's.
