---
status: done
spec: 863
blocked-by: —
---

# 866 — A technician retries a store that dropped out, from its drawer or for the whole campaign

## What to build

The page side of DataSync's **Retry** (engine spec §2.6, already built on the server — no DataSync
change):

- Model: `Job.retryable` and `Campaign.retryableJobs`; API: `POST DataSync/Jobs/{id}/Retry` and
  `POST DataSync/Campaigns/{id}/Retry` with the optional control note.
- **Job drawer:** a Retry control when the job is `retryable`.
- **Campaign header:** *Retry N retryable* beside Pause / Resume / Cancel when `retryableJobs > 0`.
- Both behind `canOperate`, both through the existing control confirm dialog (563) with its optional
  note. The dialog says the store resumes from where it stopped and finished tables are not redone.
- Refusals in words, added to the control refusal words: 409 `DATASYNC_INVALID_STATE` on Retry
  (nothing retryable any more, or the campaign is cancelling/cancelled), `DATASYNC_STORE_BUSY` (pause
  ActionSync for the store first), `DATASYNC_STORE_WPF_HOSTED`.
- After a retry the page's poll picks up the new state (a `Completed` campaign shows `Running` again).

## Spine reach

model/api · logic · drawer/header · i18n · test

## Proof (→ `tdd` red-green cycles)

- [x] `jobControls` / `campaignControls` — Retry offered exactly when `retryable` / `retryableJobs > 0` and `canOperate`, never otherwise · pure
- [x] `controlRefusalWords` — the Retry refusals map to their sentences · pure
- [x] `tools/data-sync-controls-drive.mjs` — with stubs: drawer Retry and header Retry post to the right doors with the note, refusals show in the dialog, no Retry without `canOperate` · stubbed drive

## Boundaries

oms-react only; DataSync doors exist on the deployed build. No flag, no new grant.

## Done when

All Proof boxes green; on the demo kit a `StoreUnreachable` job retried from its drawer runs again and
keeps its finished tables.

## Blocked by

None — can start immediately.
