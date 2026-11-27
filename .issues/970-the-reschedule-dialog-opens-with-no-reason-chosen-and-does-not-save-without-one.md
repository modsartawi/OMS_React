---
status: done
spec: BackOffice 4354
blocked-by: —
---

# 970 — The reschedule dialog opens with no reason chosen and does not save without one

Spec: BackOffice `.issues/4354-the-sourcing-advisor-plans-an-orders-shipments-and-comparison-runs-judge-it-before-anything-obeys-spec.md` (the sourcing advisor spec; sections 11, 17 and 19 for the screens).

## What to build

- The web reschedule dialog opens with no reason chosen and does not save a move without one, as the till does. Today a reason is already chosen when it opens.
- It shows the server's refusal when a move with no reason is sent.
- Ship this before the BackOffice ticket that makes the server refuse a move with no reason.

## Spine reach

oms-react: dialog / locales / tests

## Proof (→ `tdd` red-green cycles)

- [x] `reschedule-model.test.ts` — no reason is chosen on open, and save is off until one is · vitest (`npm test`)
- [x] `tools/reschedule-drive.mjs` — open the dialog, try to save, choose a reason, save · Playwright drive, run by hand against stubs

## Boundaries

Deploy before the server refusal.

## Done when

The model test is green and the drive passes.

## Blocked by

None — can start immediately

## Comments

**2026-11-27 — built.** `src/features/oms/document/reschedule-model.ts` (`seedReschedule` seeds the first
day and never a reason; `canSaveReschedule` needs the lists, a day, a time and a chosen reason) with
`reschedule-model.test.ts` (7 tests, red then green). `RescheduleDialog.tsx` uses both, shows a disabled
"Choose a reason" placeholder and a hint line until a reason is chosen. The server's refusal of a move is
toasted in its own words by the page's existing `notify.apiError` path; the drive proves it with a stubbed
400 (`RESCHEDULE_REASON_REQUIRED` is a placeholder code — BackOffice 4384 has not named it yet).

The drive found a reopen bug that predates this ticket: a reopen onto an unchanged slot list cleared the
time while the browser still showed the first window, so save stayed off. The time is now re-seeded on
every open. `tools/reschedule-drive.mjs`: 9/9 against the stubbed wire (`npx vite --port 5277` +
`DRIVE_PORT=5277 PLAYWRIGHT_CHANNEL=msedge node tools/reschedule-drive.mjs`; the channel variable is for a
machine without Playwright's own Chromium). `typecheck`, `npm test` and `lint` pass. Arabic keys not added:
`ar/document.json` has no `reschedule` block yet.

**2026-11-27 — reconciled with BackOffice 4384 at pricing2 35a4e56be.**
- The real refusal code is **`SDS-00054`** (`SdDocumentScheduleErrorCodes.RescheduleReasonRequired`), thrown by both
  reschedule doors (`SdDocumentService_MoveReason.RefuseRescheduleWithNoReason`) as a 400 in the usual envelope. The
  placeholder `RESCHEDULE_REASON_REQUIRED` is gone. `reschedule-model.ts` names the code
  (`RESCHEDULE_REASON_REQUIRED = 'SDS-00054'`, `rescheduleRefusalKey`), and the page words that one refusal in the
  user's language with its code (`reschedule.reasonRefused`, the code through `fsi`), since the server's message is
  English only; every other refusal is still toasted in the server's own words. `reschedule-model.test.ts` +2.
- The reason list already came from the server (`GET Slots/RescheduleReasons`, `lookupQueries.rescheduleReasons`);
  nothing to change there.
- Arabic: `ar/document.json` now holds the dialog's words (`reschedule.*`, `actions.reschedule`, `dialog.cancel`,
  `toast.done/doneDetail/failed/failedDetail`).
- `tools/reschedule-drive.mjs` stubs the real refusal and an `SDS-00053`, runs LTR and RTL, and checks the Arabic
  words exist: 28/28 on Edge.

**Gaps.** The hand-move reason list (group `HMOV`, BackOffice 4384) has no SIS.Api door: only the WPF back office's
Change Store window reads it, and the server refuses no web hand move that names no reason. The web Change Store
therefore still sends none (SERVER GAP, outside this ticket).
