---
status: done
spec: BackOffice 2680
blocked-by: — (live: BackOffice 2683)
---

# 495 — The jobs grid shows which file each upload was

**Source:** BackOffice spec 2680 (grilled 2026-10-15), slice 3. Server side: BackOffice 2683.

## What to build

In the coupons admin Import workspace:

- Creating an import job sends the preview's **file name** and the file's **size in bytes** alongside
  the codes.
- The per-template jobs grid gains a **File** column: the file name, with the size on hover; "—" when
  the job has no recorded file (older jobs, API callers). A deleted job keeps its file name.
- The import-job model and the create-job request gain the two fields.

## Spine reach

UI → models → existing create-job and jobs-by-template doors.

## Proof (→ `tdd` red-green cycles)

- [x] `formatImportFile` — name shown, size formatted (B / KB / MB), "—" when the name is blank · `coupons/helpers.test.ts`
- [x] Run the app (**stubbed** — `tools/coupon-import-file-drive.mjs` 30/30, LTR + RTL; the live walk on a host carrying
      BackOffice 2683 + migration 011 is still owed): upload a file, see its name in the grid; an older job shows "—".

## Boundaries

oms-react only. Needs BackOffice 2683 deployed (an older API ignores the extra fields and returns
none — the column then shows "—").

## Done when

A fresh upload shows its file name and size in the jobs grid.

## Blocked by

BackOffice [2683](../../../Work/DMSCO/BackOffice/.issues/2683-every-coupon-import-job-remembers-the-uploaded-files-name-and-size.md) live.

## Comments

**Done 2026-10-15.** `CreateImportJobRequest` gains `fileName` / `fileSizeBytes` (BackOffice 2683's
wire names); the preview keeps `file.size` beside `file.name` and the create-job call sends both.
`ImportJob` gains both as optional — an API older than 2683 sends neither. The jobs grid has a File
column after Job: the name in a `<bdi>` (truncated at 16rem), the size on hover through `fsi`
(1024-based, `512 B` / `1.5 KB` / `2.3 MB`); "—" with a "No file recorded" hover when the name is
blank or absent. A Deleted row keeps its name (the server keeps it; the cell does not look at status).

- Size units are locale keys (`import.jobs.file.bytes|kb|mb`, EN + AR) — the AR spellings are mine,
  not owner-supplied.
- Proof: `helpers.test.ts` 4 new (red first), full suite 5156/5156; `coupon-import-file-drive` 30/30
  stubbed; `coupon-import-delete-drive` 65/65 unchanged; typecheck, lint (4 gates), build green.
- Review: self-reviewed (correctness + rules) on this ticket's diff only — the working tree still
  carries another session's uncommitted 493 work, which a tool-driven review would sweep in.
- Live: needs BackOffice 2683 deployed and migration 011 run on OMS-HQ — until then every row shows "—".
