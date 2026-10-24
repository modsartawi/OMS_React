---
status: done
spec: 558
blocked-by: 560
---

# 563 — A technician pauses, resumes or cancels a campaign or one store's job

## What to build

Controls on the campaign page (560), for holders of `canOperate`:

- **Campaign:** Pause, Resume and Cancel in the header; **job:** the same three in the job's row and
  drawer. Only the moves the current status allows are offered (engine spec §2 state machines):
  e.g. Pause from Running, Resume from Paused, Cancel from anything non-terminal; nothing on
  Completed, Cancelled, Succeeded or Failed.
- **Dialog:** names what it acts on, takes an optional note (`ControlRequest.reason`) for Pause and
  Cancel, and says that Cancel never rolls back chunks already applied and that Pause takes effect at
  the next chunk boundary (Pausing → Paused).
- **Refusals in the dialog:** 409 `DATASYNC_INVALID_STATE`; on a job resume, 409
  `DATASYNC_STORE_BUSY` (pause the store on ActionSync first) and `DATASYNC_STORE_WPF_HOSTED` (it can
  never be applied). A bare 403 hides the controls.
- After a control, the page's poll (560) picks up the new state; the answer's own state is shown at
  once.

## Spine reach

model/api · store/logic · component/route · i18n · test

## Proof (→ `tdd` red-green cycles)

- [x] `campaignControls` / `jobControls`: every status × `canOperate` gives exactly the allowed actions · pure
- [x] `controlRefusalWords`: each 409 code maps to its sentence key · pure
- [x] `tools/data-sync-controls-drive.mjs`: with stubs, each control posts to the right door with the note, the refusals show in the dialog, and no control renders without `canOperate`

## Boundaries

New endpoints: `POST DataSync/Campaigns/{id}/{Pause|Resume|Cancel}`, `POST DataSync/Jobs/{id}/{Pause|Resume|Cancel}`.

## Done when

From stubs, every allowed control works and every refusal reads in words; the helpers and the drive
are green.

## Blocked by

[560](560-a-technician-follows-a-campaign-s-jobs-and-each-store-s-tables-as-they-run.md)

## Comments

**Built 2026-10-24 (ticket/563).** `control-helpers.ts` (`campaignControls`, `jobControls`,
`controlTakesNote`, `controlBody`, `controlRefusalWords`, `isOperateDenied`; vitest 13 tests),
`dataSyncApi.controlCampaign` / `controlJob`, `ControlDialog.tsx` (the shared confirm dialog for
564/565), `Controls.tsx` (`CampaignControls`, `JobControls`, `jobRowControls`, `jobDrawerControls`,
`useCanOperateDataSync`). Drive `tools/data-sync-controls-drive.mjs` 50/50 against stubs; 560's
campaign drive still 60/60. Nothing driven against a live DataSync (566).

Decisions an owner may overrule:
- **Legal moves are the service's [CODE] tables**, not the ticket's shorthand: Cancel is offered on
  a Ready campaign and on a Pausing campaign or job, never on Cancelling. A job's moves ignore its
  campaign's status (a queued job may be paused before Start), as the service does.
- **Resume takes no note** (the ticket gives one to Pause and Cancel); it posts `{}`. A blank note
  is not sent.
- **A bare 403 on a control** drops `canOperate` from the cached `DataSync/Access` answer, so EVERY
  Operate control on the page hides (561's Start and 562's Changes link too, if they read that
  answer), with one warning toast. No re-probe.
- After a control the door's answer goes straight into the cache (header, the job's row on every
  jobs page held, the drawer) and the campaign's reads are invalidated at once (rollup), not left
  to the next poll tick. A refusal invalidates too, so INVALID_STATE's "the page now shows the
  current state" holds. A success toast names the new status.
- The 404 not-found codes also get words in the dialog (beyond the ticket's 409s).
- 560's `actions` column is now pinned to the reading end (`pinEnd`, 180px) with compact row
  buttons: the row is wider than the grid and the actions scrolled off its end.
- The dialog is portalled to `<body>` so the grid never sees keystrokes typed into the note.
