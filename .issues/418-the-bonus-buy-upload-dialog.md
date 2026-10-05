---
status: done
spec: C:/Work/DMSCO/BackOffice/.issues/2374-marketing-authors-bonus-buys-in-oms-on-a-copy-of-sap-screen-spec.md
blocked-by: 416
---

# 418 — SAP's upload file loads from the promotion screen

**Source:** BackOffice spec 2374, *Marketing authors bonus buys in OMS on a copy of SAP's screen and uploader*, at `C:/Work/DMSCO/BackOffice/.issues/2374-marketing-authors-bonus-buys-in-oms-on-a-copy-of-sap-screen-spec.md`. The screen is read field by field in `C:/Work/DMSCO/BackOffice/.issues/2330-SAP-BBY-SCREEN.md`. The owner-approved prototype is on BackOffice branch `proto/2335-bby-editor-sap-copy` (`.scratch/proto/bby-editor-sap-copy/index.html`), a layout and flow reference, not code to port.

**Standing preference:** marketing must not feel the move from SAP. When "like SAP" and "better" conflict, like SAP wins.

## What to build

The **Upload** dialog on the promotion screen loads marketing's SAP bonus-buy file (`POST BbyMaintainWeb/Upload`, multipart):

- **The file:** SAP's 22-column tab-separated file, unchanged except that its `AKTNR` must be a `P…` number.
- **Options:** **Check only** (`validateOnly`) and **Activate new bonus buys** (`activate`).
- **The result:**
  - the created and updated `OMS…` numbers; or
  - every refused row with its row number, serial, `BBY-` code and EN/AR reason. In that case nothing was written, and the
    dialog says so.
- **After a successful load** (not a check-only run), the overview refreshes.

## Spine reach

UI (oms-react feature) · API client (Upload)

## Proof (→ `tdd` red-green cycles)

- [x] `upload result lists created, updated and refused rows` · vitest
- [x] `a refused file says nothing was written` · vitest
- [x] `a check-only run never refreshes the overview` · vitest

## Boundaries

Same rules. Needs BackOffice 2381–2382 for the live walk.

## Done when

The owner uploads one of the sample files (`.requirements/NewPromoEngine/`, `AKTNR` re-keyed to `P…`) twice: the first run creates, the second updates, and nothing duplicates.

## Blocked by

416 (+ BackOffice 2381, 2382 for the endpoint)

## Comments

**Built 2026-10-05** on branch `ticket/418-bby-upload` (worktree `C:\Playground\oms-react-418`, off `bb868ee`), because a
417 session was editing the same files on `main` at the same time. Merge after 417 commits.

- **Wire, from the SHIPPED door, not the spec:** `BbyUploadResult { status: saved|valid|refused, promoNumber,
  promotionCreated, created[], updated[], refusals[], warnings[] }`. Created/updated rows are `{ row, serial, buyGroup,
  getGroup, bbyNumber, bbyStatus }`. Refusals are `{ row, serial, code, english, arabic }`, and row 0 means the whole file.
  The texts come as `english`/`arabic`, not the `en`/`ar` that 416's `BbyRefusal` uses. That is why the shape has its own
  file, `@/core/models/bonus-buy-upload.ts`. Multipart parts are `file`, `validateOnly` and `activate` (`"true"`/`"false"`).
- **Pure seam:** `upload.ts` has `uploadForm`, `uploadFileProblem` and `readUpload`, with 19 vitest cases. The three Proof
  names are its `describe` blocks.
  - A refused answer never shows created or updated rows.
  - "Nothing was written" is said for a refusal and for a check-only pass. It is never said for a status the client cannot read.
  - `refreshOverview` is computed from the options that were SENT, so a check-only run never refreshes. An unreadable answer
    to a load does refresh, because re-reading is harmless.
- **Dialog:** `UploadDialog.tsx`.
  - The file goes up as bytes. Empty files and files over 10 MB are refused before the round trip, matching the door's cap.
  - The result shows tables of the refused rows, the created rows, the updated rows (check-only runs show "would be" rows,
    without numbers) and the warnings.
  - A promotion the file created is named. When the file's `AKTNR` is another promotion, a link to it is offered and that
    promotion's cache is invalidated.
  - "Upload another file" keeps the ticked options.
- **Drive:** `tools/bby-maintenance-drive.mjs` steps 12–16, **48/48, all STUBBED**.
- **Gates:** typecheck, lint, build and `npm test` (3637) are all green.
- **Reviews:**
  - Standards: no hard violations. I applied `BbyStatusCode` on `bbyStatus`, a status→outcome lookup map, and the 10 MB
    figure interpolated from its constant. I left alone the bilingual-reason markup that repeats `RefusalList`, because the
    two field shapes differ.
  - Spec: faithful, with nothing material.
- ⚠ **Done when is NOT yet met.** The owner's live walk is outstanding: upload a sample file twice on a dev SIS.Api
  (create, then update, with no duplicates). Closed on 416's precedent, with that walk still owed.
