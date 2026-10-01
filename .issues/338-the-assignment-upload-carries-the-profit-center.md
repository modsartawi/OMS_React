---
status: done
spec: 334
blocked-by: — (+ BackOffice 2157)
---

# 338 — The assignment upload carries the profit center

BackOffice spec 2149 D7; web spec 334 item 4. Server: BackOffice 2157.

## What to build

The assignment upload's template gains an optional `ProfitCenter` column, and its preview shows each branch's current and new profit center.

- Template header becomes `StoreCode, ProfitCenter, AccountantId, CollectorId`.
- A row whose only change is the profit center counts and shows as a change.
- The dialog's help text says a blank profit center leaves the stored value unchanged.
- The server's new refusal (an over-long value) is shown like the other row refusals.

## The seam

Build and test against a stub of EXACTLY the shape recorded under `## Web contract` in the BackOffice ticket(s) named above (`C:/Work/DMSCO/BackOffice/.issues/`). Never invent a field. If that heading is missing, the BackOffice ticket has not landed and this ticket is not startable. **Do not edit the BackOffice repo.**

## Spine reach

oms-react screen / wire model / vitest

## Proof (→ `tdd` red-green cycles)

- [x] `assignment template carries the ProfitCenter column` · vitest (`assignment-template.test.ts`)
- [x] `preview shows current and new profit center` · vitest (`assignment-upload.test.ts`, on `profitCenterChange`)
- [x] `a profit-center-only row is shown as a change` · vitest (`assignment-upload.test.ts`, on `reviewUpload`)

## Boundaries

Web only. English locale only (Arabic appears inline where labels already carry it). No new dependency.

## Done when

Uploading a branch file with profit centers shows them in the preview and, after commit, on the collection screens.

## Blocked by

BackOffice 2157 (its `## Web contract`)

## Comments

**Built (2026-10-01).** Built against BackOffice 2157's `## Web contract` (worktree `C:\Work\DMSCO\BackOffice-2149`,
commit e44716bc5), which amends 1996's. The wire types match it field for field; nothing was invented. No new call,
route, grant, probe flag or dependency. The BackOffice repo was not touched.

- **Template** (`inquiry/assignment-template.ts`): the header is now `StoreCode,ProfitCenter,AccountantId,CollectorId`,
  in the ticket's order (the contract lists ProfitCenter last; the door reads columns by name, so either works; see
  `.afk/HITL-338.md`).
- **Wire model** (`inquiry/assignment-upload.ts`): `currentProfitCenter`, `profitCenter`, `profitCenterChanges` on the
  preview row, typed optional so a door older than 2157 reads as "none recorded, unchanged". They are read through
  `profitCenterChange(row)`, and the change is the server's flag, read `=== true`. The screen never compares the
  strings itself, because the server compares case-sensitively. `reviewUpload` already counted off each row's
  `changes`, so a profit-center-only row counts, and Apply is offered for it.
- **Refusals:** the four `PROFIT_CENTER_*` codes are shown in the server's English line, like any code the screen has
  no words for. They hang on their row, or on the file at row 0 (`PROFIT_CENTER_UNAVAILABLE`). The over-long sentence
  names the live column's limit, which a key could not know. `STORE_REQUIRED`'s copy now says "a person or a profit
  center", since 2157 raises it for a row that names only a profit center.
- **Dialog** (`inquiry/AssignmentUploadDialog.tsx`):
  - the template list gains `ProfitCenter` ("optional"), plus the sentence that a blank profit center leaves the stored
    one;
  - the preview gains a Profit Center column drawn current → new;
  - the slot cells and the new one share one `BeforeAfter` cell (a standards-review extraction);
  - the done line reads "N branches changed from the file", not "assigned", because a profit-center-only branch is in
    `appliedStoreCodes`.
- **Collection screens after the commit:** they are separate routes whose list queries carry no `staleTime`, so they
  refetch on mount and show the new `profitCenter` / `storeText` (the server proves the read in 2157's
  `AssignmentCommit_WritesTheProfitCenter_AndTheCollectionReadShowsIt`).

**Proof.**
- vitest: the three Proof tests, plus an older door without the fields, the over-long refusal on its row in the
  server's words, and the file-level unavailable refusal. 163 files / 2796 tests green.
- Drive: `tools/assignment-upload-drive.mjs` was extended to steps 9 and 10, stubbed from 2157's samples verbatim, and
  passes 58/58. It covers the template's four columns and the download, the blank-profit-center sentence, current →
  new, a profit-center-only change counted and applied, and the over-long refusal named on row 5 and above the grid.
- `typecheck`, `lint` (three gates) and `build` are green.
- ⚠️ Not driven against a live SIS.Api. The "after commit, on the collection screens" half of Done-when is owed to the
  owner's smoke on dev, once migration 096 is on POS_Server (minted as 092; BackOffice renumbered it in `a2c729f00`).

**Reviews.**
- `/code-review` (medium): no findings.
- `/standards-review`, Standards axis: no hard violations.
  - Applied: the duplicated before→after cell, extracted to `BeforeAfter`.
  - Declined: "branch" vocabulary (the namespace's established word), the `done.applied` key name, and the drive's
    copies of the fixtures (`.mjs` cannot import TS).
- `/standards-review`, Spec axis:
  - Applied: the `STORE_REQUIRED` copy fix.
  - Recorded as a ruling: the template order (HITL).
  - Owed to the live run: the collection-screen proof.
