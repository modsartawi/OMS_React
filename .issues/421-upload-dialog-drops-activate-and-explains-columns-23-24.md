---
status: open
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

- [ ] `the upload form never sends activate` · vitest
- [ ] `a locked-serial refusal renders with its status` · vitest

## Boundaries

Ship with or after BackOffice 2398 (an older client would send `activate` and get a `400`).

## Done when

The owner uploads a 24-column file and sees Planned bonus buys carrying its Score and tiers.

## Blocked by

418 (+ BackOffice 2398, 2399)
