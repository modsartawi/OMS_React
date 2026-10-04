---
status: open
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

- [ ] `upload result lists created, updated and refused rows` · vitest
- [ ] `a refused file says nothing was written` · vitest
- [ ] `a check-only run never refreshes the overview` · vitest

## Boundaries

Same rules. Needs BackOffice 2381–2382 for the live walk.

## Done when

The owner uploads one of the sample files (`.requirements/NewPromoEngine/`, `AKTNR` re-keyed to `P…`) twice: the first run creates, the second updates, and nothing duplicates.

## Blocked by

416 (+ BackOffice 2381, 2382 for the endpoint)
