---
status: done
spec: 308
blocked-by: —
---

# 318 — An assignment file is uploaded with a preview, then committed

## What to build

An upload view on `CollectionAssignmentPage`: pick xlsx/csv, show the preview (changes per store, refused
rows named), commit once (idempotent re-press), and download a template (StoreCode, AccountantId, CollectorId;
a blank cell means unchanged). Follow the settlement bulk upload's shape.

## Contract

Build against the envelope recorded under `## Web contract` in the BackOffice ticket(s) below, stubbed exactly.
Do not add fields the contract does not name.

## Proof

- [x] criteria / columns / projection modules under vitest for the behaviour above
- [x] the screen renders against the contract stub (loading, empty, error, refusal)

## Blocked by

- BackOffice [1996](C:\Work\DMSCO\BackOffice-spec1976\.issues\1996-an-assignment-file-is-previewed-and-committed-as-one-act.md) must be **done** and its `## Web contract` written

## Comments

**Built (2026-09-25).** Built against BackOffice 1996's `## Web contract` and cross-checked with the committed
`AssignmentUploadModels.cs` / `CollectionAssignmentUploadEndpoints.cs` / `CollectionAssignmentUploadService.cs` on
BackOffice main. **No drift**: the contract and the code agree field for field. No new grant, probe flag, route, area
or npm dependency.

- **Calls** (`inquiry/api.ts`): `assignmentUploadPreview(file)` and `assignmentUploadCommit(file, contentHash)`. Both
  are multipart through `api.upload`, on `CollectionWeb/Assignment/Upload/Preview` and `…/Commit`.
- **Pure module** (`inquiry/assignment-upload.ts`):
  - the wire types;
  - `reviewUpload`: rows by refusal, changes per store counted from the server's per-row flags, file-level issues.
    Apply is offered only on `canCommit === true`, no errors, and at least one row that changes something;
  - `describeIssue`: copy keyed off the six codes, with the store, staff id and slot named. An unknown code shows the
    server's English line;
  - `commitOutcome`: `accepted === true` is required. It returns applied / nothingApplied (a re-press) /
    hashMismatch / rowErrors / refused;
  - `withCommitRowErrors`, `fileRefusalKey` and `englishLine` (the web is English-only).
- **Template** (`inquiry/assignment-template.ts`): the header `StoreCode,AccountantId,CollectorId` alone, as a CSV. It
  has no example rows: the file is all or nothing, and an example row left in would refuse the whole sheet.
- **View** (`inquiry/AssignmentUploadDialog.tsx`), opened by "Upload a file…" on the Branches tab's bulk bar:
  - **File step:** the columns, the blank-cell rule, the template download and the picker.
  - **Preview step:** the summary, the refused rows named above the grid and on their own row, and each slot shown
    before → after in the roster's names. "No change" is shown where the file leaves a branch as it is.
  - **Done step:** the count, the changed codes and the unchanged count.
- **Commit:** re-sends the same file with the preview's hash. A press in flight is held by a ref, so a re-press cannot
  apply twice or overwrite the answer. An answer from an earlier opening of the dialog is not drawn.
- **After a commit:** the Branches grid refetches and pins the applied rows.

**Proof.**
- vitest **2444 green** (142 files). New suites: `assignment-upload` 21 and `assignment-template` 3.
- `tools/assignment-upload-drive.mjs` **46/46** against stubs of the contract samples. It covers:
  - the gate;
  - the template columns and download bytes;
  - loading;
  - the contract's preview sample (changes per store, names, the refused row named, Apply withheld);
  - a clean file where a double press sends ONE commit carrying the file and the hash;
  - the done panel and grid refetch, and the re-press answer;
  - refusals: `HASH_MISMATCH`, `ROW_ERRORS`, a `400` in the server's own words (English only), a `400` in the
    screen's own words, a 500 and the bare 403;
  - a stale answer, and re-picking the file;
  - nothing to apply;
  - no raw key and no page error.
- `collection-drive` 220/220 is unchanged. typecheck, lint (3 gates) and build are green.

**Review.**
- `/code-review` found two issues, both fixed and driven: a stale in-flight answer leaking into a reopened dialog, and
  "preview again" re-sending a stale file handle.
- `/standards-review` found no hard violations. From its smells, the Arabic fallback is now English-only, the template
  example rows are gone (which also removed a duplicated `csvCell`), the column → slot mapping is a lookup, and two
  names were clarified.
- Left as-is: the dialog's structure deliberately mirrors settlement's, and features may not share it.

**Outstanding (not this ticket's):** no drive against a live SIS.Api. Every envelope is stubbed. Decisions are in
`.afk/HITL-318.md`.
