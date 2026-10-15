---
status: open
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

- [ ] `formatImportFile` — name shown, size formatted (B / KB / MB), "—" when the name is blank · `coupons/helpers.test.ts`
- [ ] Run the app: upload a file, see its name in the grid; an older job shows "—".

## Boundaries

oms-react only. Needs BackOffice 2683 deployed (an older API ignores the extra fields and returns
none — the column then shows "—").

## Done when

A fresh upload shows its file name and size in the jobs grid.

## Blocked by

BackOffice [2683](../../../Work/DMSCO/BackOffice/.issues/2683-every-coupon-import-job-remembers-the-uploaded-files-name-and-size.md) live.
