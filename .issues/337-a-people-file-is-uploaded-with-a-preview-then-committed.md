---
status: open
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

- [ ] `people template has the four columns and no BOM` · vitest
- [ ] `preview shows added, updated, unchanged and refused rows with reasons` · vitest
- [ ] `apply is disabled while any row is refused` · vitest
- [ ] `commit sends the file with the preview hash and refreshes the list` · vitest

## Boundaries

Web only. English locale only (Arabic appears inline where labels already carry it). No new dependency.

## Done when

A finance administrator uploads a sheet of people from the People tab and sees them in the list.

## Blocked by

BackOffice 2156 (its `## Web contract`)
