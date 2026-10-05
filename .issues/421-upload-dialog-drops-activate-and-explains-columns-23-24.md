---
status: done
spec: C:/Work/DMSCO/BackOffice/.issues/2396-an-oms-bonus-buy-is-tested-before-it-goes-live-and-authoring-scales-to-real-campaigns-spec.md
blocked-by: 418
---

# 421 — The upload dialog drops "activate" and explains the optional Score and tier columns

**Source:** BackOffice spec 2396.

## What to build

- Remove the **Activate new bonus buys** option, and stop sending the `activate` multipart part (the door now answers `400` to
  it). Uploads always land Planned.
- The help text says the file may carry two OMS-only columns: 23 `SCORE` and 24 `LOY_TIERS`. A file using them will not load
  into SAP until they are dropped.
- A refusal of a locked serial (not Planned) shows serial, number and status like any other refused row. A row 0 refusal still
  means the whole file.

## Spine reach

UI (UploadDialog) · `upload.ts` form

## Proof (→ `tdd` red-green cycles)

- [x] `the upload form never sends activate` · vitest
- [x] `a locked-serial refusal renders with its status` · vitest

## Boundaries

Ship with or after BackOffice 2398 (an older client would send `activate` and get a `400`).

## Done when

- [ ] **OWNER, outstanding:** the owner uploads a 24-column file and sees Planned bonus buys carrying its Score and tiers
  (needs a dev SIS.Api carrying BackOffice 2398 and 2399, both open).

## Blocked by

418 (+ BackOffice 2398, 2399)

## Comments

**Built 2026-10-05 (AFK).** BackOffice 2398/2399 are open. The upload's wire shape does not change in spec 2396 (only
the `activate` part goes and the server learns columns 23/24), so the drive stubs 418's SHIPPED `BbyUploadResult`.

- `upload.ts`: `UploadOptions` is `{ validateOnly }` only; `uploadForm` sends `file` + `validateOnly` and never `activate`
  (the door answers `400` to it). `UploadDialog.tsx`: the checkbox, its state and its reset are gone.
- Help copy (`upload.omsColumns`): columns 23 `SCORE` and 24 `LOY_TIERS` are OMS-only, and SAP will not load a file using
  them until they are dropped. `upload.landsPlanned` adds that uploads always land Planned and a file reaching a
  non-Planned bonus buy is refused whole (spec stories 15 and 24). `upload.hint` now says "(22 columns)" for SAP's file.
  Keys `upload.activate` / `upload.activateHint` removed.
- A locked-serial refusal uses the UNCHANGED refusal shape (`row, serial, code, english, arabic`; row 0 = whole file):
  the number and status are in the server's text and render through the existing refused-row table. No number/status
  fields were invented. Its vitest is a characterization pin (it was green before the change, since no code needed to change).
- `bonus-buy-upload.ts`: the `bbyStatus` comment no longer says a row is blank "when the upload activated it".
- **2374 reversals retired, not kept:** `upload.test.ts`'s "names the parts" no longer asserts `activate=false`; drive
  step 22 now asserts NO activate part on a check or a load (it asserted `false`/`true`), and step 25's load lands Planned
  (it ticked activate and read Activated). New drive block: steps 35 (no activate option, columns 23–24 help) and 36 (a
  locked serial refused: row, serial, code, number + status in EN + AR, row 0, nothing written, no refetch).
- Proof: vitest 201 files / 3691 tests green; typecheck, lint (4 gates) and build clean; `tools/bby-maintenance-drive.mjs`
  141/141 **stubbed** (run twice clean; one earlier run missed 419's step 28 once, a timing read after an uncheck, not this slice).
- Guesses and decisions: `.afk/HITL-421.md`.
