---
status: open
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

- [ ] `campaignControls` / `jobControls`: every status × `canOperate` gives exactly the allowed actions · pure
- [ ] `controlRefusalWords`: each 409 code maps to its sentence key · pure
- [ ] `tools/data-sync-controls-drive.mjs`: with stubs, each control posts to the right door with the note, the refusals show in the dialog, and no control renders without `canOperate`

## Boundaries

New endpoints: `POST DataSync/Campaigns/{id}/{Pause|Resume|Cancel}`, `POST DataSync/Jobs/{id}/{Pause|Resume|Cancel}`.

## Done when

From stubs, every allowed control works and every refusal reads in words; the helpers and the drive
are green.

## Blocked by

[560](560-a-technician-follows-a-campaign-s-jobs-and-each-store-s-tables-as-they-run.md)
