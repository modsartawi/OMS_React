---
status: open
spec: C:/Work/DMSCO/BackOffice/.issues/2374-marketing-authors-bonus-buys-in-oms-on-a-copy-of-sap-screen-spec.md
blocked-by: —
---

# 416 — Marketing works from the promotion, as on SAP's Bonus Buy Overview

**Source:** BackOffice spec 2374, *Marketing authors bonus buys in OMS on a copy of SAP's screen and uploader*, at `C:/Work/DMSCO/BackOffice/.issues/2374-marketing-authors-bonus-buys-in-oms-on-a-copy-of-sap-screen-spec.md`. The screen is read field by field in `C:/Work/DMSCO/BackOffice/.issues/2330-SAP-BBY-SCREEN.md`. The owner-approved prototype is on BackOffice branch `proto/2335-bby-editor-sap-copy` (`.scratch/proto/bby-editor-sap-copy/index.html`), a layout and flow reference, not code to port.

**Standing preference:** marketing must not feel the move from SAP. When "like SAP" and "better" conflict, like SAP wins.

## What to build

A new **Bonus Buy Maintenance** feature under the `pricing` area, beside Bonus Buy Download and Bonus Buy Inquiry, per
`feature-structure`. It goes in the nav only when the `BbyMaintain` grant holds (the `GET BbyMaintainWeb/Access` probe).

- **Promotion list:** OMS `P…` promotions with name, sales window and bonus-buy count, plus Create promotion (name + window;
  the number is minted by the server).
- **"Change promotion: Bonus Buy Overview"**, copying SAP's (screenshots `1.png`, `11.png`):
  - **Header:** the number (display), an editable name (at most 40), type `SACH` "SA-Promo Chain" (fixed), and the On-sale
    from/to window. The Purchase and Listed periods are shown equal to it and disabled.
  - **Promotion actions:** Activate (all-or-nothing; shows every refused bonus buy), Deactivate, Delete (enabled only when
    empty) and Upload (opens the upload dialog ticket).
  - **One tab, Bonus Buy.** SAP's other promotion tabs are not shown.
  - **The Bonus Buys – Overview grid:** number, text, valid from, valid to, and status (blank = Activated, `1` = Planned,
    `2` = Deactivated), with multi-select.
  - **SAP's buttons:** Create, Change, Display, Activate, Deactivate, Delete, plus Copy and Copy from SAP… (a number prompt).
    Create, Change, Display and Copy open the editor ticket's page. Multi-select actions loop one number per call
    (`BonusBuy/Activate|Deactivate|Delete`) and show each outcome. A delete of an activated bonus buy comes back refused with
    "deactivate it first".
- **Endpoints:** `GET Promotion/List`, `GET Promotion/{number}`, `Promotion/Save|Activate|Deactivate|Delete`.

## Spine reach

UI (oms-react feature + router + nav) · API client (BbyMaintainWeb)

## Proof (→ `tdd` red-green cycles)

- [ ] `promotion overview maps blank/1/2 to Activated/Planned/Deactivated` · vitest
- [ ] `multi-select activate reports each number outcome and keeps going` · vitest
- [ ] `promotion activate shows every refused bonus buy and changes nothing` · vitest
- [ ] `delete promotion is disabled while it holds bonus buys` · vitest
- [ ] `nav entry hidden when screenAllowed is false` · vitest

## Boundaries

Rules: `feature-structure`, `api-envelope`, `i18n-zero-literal` (EN + AR), `logical-tailwind`, `bidi`. No flag: the grant gates the nav. Needs BackOffice 2376 + 2380 live on a dev SIS.Api for the walk; the tests can run against fakes before then.

## Done when

The owner walks the promotion screen against a dev SIS.Api and it matches SAP's flow.

## Blocked by

— (+ BackOffice 2376, 2380 for the endpoints)
