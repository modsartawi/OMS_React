---
status: done
spec: 334
blocked-by: — (+ BackOffice 2156)
---

# 337 — A people file is uploaded with a preview, then committed

BackOffice spec 2149 D6; web spec 334 item 3. Server: BackOffice 2156. Pattern to copy: the assignment upload dialog (ticket 318).

## What to build

The People tab gains an upload, shaped like the assignment upload beside it: download a template, pick an `.xlsx` or `.csv`, see a preview, then commit.

- Template columns: `StaffId`, `Name`, `Role`, `SupervisorId`. Written with no BOM, as the other templates are.
- The preview lists each row as added / updated / unchanged, with current and new values, and each refused row with the server's reason. Apply is enabled only when the server says the file can be committed.
- Commit re-sends the same file with the preview's hash. A changed file is refused by the server; show that refusal.
- After a commit the people list refreshes.
- A bare 403 hides the upload, as on the assignment upload.

## The seam

Build and test against a stub of EXACTLY the shape recorded under `## Web contract` in the BackOffice ticket(s) named above (`C:/Work/DMSCO/BackOffice/.issues/`). Never invent a field. If that heading is missing, the BackOffice ticket has not landed and this ticket is not startable. **Do not edit the BackOffice repo.**

## Spine reach

oms-react screen / wire model / vitest

## Proof (→ `tdd` red-green cycles)

- [x] `people template has the four columns and no BOM` · vitest
- [x] `preview shows added, updated, unchanged and refused rows with reasons` · vitest
- [x] `apply is disabled while any row is refused` · vitest
- [x] `commit sends the file with the preview hash and refreshes the list` · vitest

## Boundaries

Web only. English locale only (Arabic appears inline where labels already carry it). No new dependency.

## Done when

A finance administrator uploads a sheet of people from the People tab and sees them in the list.

## Blocked by

BackOffice 2156 (its `## Web contract`)

## Comments

**Built (2026-10-01).** Built against BackOffice 2156's `## Web contract`, committed on branch `spec2149` (worktree
`C:\Work\DMSCO\BackOffice-2149`, commit 9f6632020). The wire types match the contract field for field, and nothing
was invented. No new grant, probe flag, route, area or npm dependency.

- **Calls** (`inquiry/api.ts`):
  - `peopleUploadPreview(file)` and `peopleUploadCommit(file, contentHash)`, both multipart through `api.upload`, on
    `CollectionWeb/Assignment/People/Upload/Preview` and `…/Commit`.
  - `ASSIGNMENT_ROSTER_KEY`, moved out of the page.
  - `markRosterChanged`: when a commit wrote anybody, it invalidates the roster (the People list refetches) and the
    four screens' Served-by picker, as the single-person save does.
- **Pure module** (`inquiry/people-upload.ts`):
  - the wire types;
  - `reviewPeopleUpload`: counts added / updated / unchanged from the server's per-row `change`. Apply needs
    `canCommit === true`, no errors, and at least one row added or updated;
  - `describePeopleIssue`: copy for the ten row codes. An unknown code shows the server's English line;
  - `previewRole`: an unknown role word shows as written, never as "Supervises only";
  - `peopleCommitOutcome`, `withPeopleCommitRowErrors` and `peopleFileRefusalKey`.
- **Template** (`inquiry/people-template.ts`): the header `StaffId,Name,Role,SupervisorId` alone, as a CSV with no
  BOM. It has no example rows, since the file is all or nothing.
- **View** (`inquiry/PeopleUploadDialog.tsx`), opened by "Upload a file…" on the People tab:
  - **File step:** the four columns, with a warning that a blank cell is a value (it clears) and that the role words
    are English. It also offers the template download and the picker.
  - **Preview step:** the summary, each row's Added / Updated / Unchanged, name, role and supervisor shown current →
    new, and the refused rows named above the grid and on their own row. A supervisor that the same file adds is named
    from the file.
  - **Done step:** the counts, the added and updated ids, and the unchanged count.
  - **Commit:** re-sends the same file with the preview's hash, held by a ref against a double press.
    `HASH_MISMATCH` shows the refusal and "Preview the file again". `ROW_ERRORS` folds the rows back onto the preview.
  - **After a commit:** the list refetches and a notice is shown. A person open in the edit form whom the file changed
    is cleared from the form.
  - **A bare 403** (no error code) shows "not allowed" in place of the picker and takes the button off the tab. A 403
    envelope that carries a code shows the server's words and keeps the upload.

**Proof.**
- vitest: **2791 green** (163 files). New suites:
  - `people-template` 2 tests;
  - `people-upload` 22 tests, including the four Proof names verbatim. The commit test mocks `@/core/api`, asserts the
    path and the FormData parts (the same bytes plus the hash verbatim), then asserts `markRosterChanged` invalidates
    the roster and the picker.
- `tools/people-upload-drive.mjs`: **42/42** against stubs of 2156's samples. It covers:
  - the People-tab placement;
  - the template columns and download bytes, with no BOM;
  - the verbatim preview sample: three change kinds, current → new, both reasons on row 4, Apply disabled;
  - a clean file: one commit for a double press, the same file and hash, the list refetched, and the added person in
    the list (Done when);
  - a re-press;
  - `HASH_MISMATCH`, `ROW_ERRORS` and a 400 in the server's words;
  - a coded 403 and a bare 403, which hides the upload;
  - no raw keys and no page error.
- `tools/assignment-upload-drive.mjs`: 46/46. No regression from the shared roster key.
- Typecheck, lint (all three gates) and build are green.

**Reviews.**
- `/code-review` found five minor issues; three were fixed:
  - only a bare 403 hides the upload;
  - the same-file supervisor name is looked up without regard to case;
  - a stale edit form is reset after a commit that changed that person.

  Two were declined:
  - the pending state across a re-opening, which the 318 precedent shares;
  - the "fix refused rows" label on a zero-row file, which the door answers with a 400 and can never produce.
- `/standards-review`, Standards axis: no hard violations. Applied:
  - `markRosterChanged` reads `peopleCommitOutcome`;
  - the re-export pass-through and the `ROSTER_KEY` alias are gone;
  - the `NameOf` type is used;
  - the arrow mirrors under RTL.

  Declined: extracting a shared upload hook and shared helpers with the 318 dialog, which the ticket asked to copy.
- `/standards-review`, Spec axis: nothing missing or wrong. Its judgement points are in `.afk/HITL-337.md`.

**Not proven:** no live SIS.Api with 2156 was driven; every envelope is a stub.

