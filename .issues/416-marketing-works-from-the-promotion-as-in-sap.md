---
status: done
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

- [x] `promotion overview maps blank/1/2 to Activated/Planned/Deactivated` · vitest
- [x] `multi-select activate reports each number outcome and keeps going` · vitest
- [x] `promotion activate shows every refused bonus buy and changes nothing` · vitest
- [x] `delete promotion is disabled while it holds bonus buys` · vitest
- [x] `nav entry hidden when screenAllowed is false` · vitest

## Boundaries

Rules: `feature-structure`, `api-envelope`, `i18n-zero-literal` (EN + AR), `logical-tailwind`, `bidi`. No flag: the grant gates the nav. Needs BackOffice 2376 + 2380 live on a dev SIS.Api for the walk; the tests can run against fakes before then.

## Done when

The owner walks the promotion screen against a dev SIS.Api and it matches SAP's flow.

## Blocked by

— (+ BackOffice 2376, 2380 for the endpoints)

## Comments

**Built 2026-10-05 — code-complete, proven on stubs; the owner's live walk is still outstanding.** BackOffice 2376 and 2380
had not shipped, so the "Done when" walk on a dev SIS.Api has not happened. It also needs 417 (editor) and 418 (upload)
before it can match SAP's flow end to end.

**As built** — `features/pricing/bonus-buy-maintenance/`, under `/pricing/bonus-buy-maintenance`:
- `BonusBuyMaintenancePage` lists the promotions and has Create promotion. It posts `promoNumber: null` and opens the
  promotion the server mints.
- `PromotionPage` is "Change promotion: Bonus Buy Overview":
  - the header: number, name (≤ 40), `SACH` SA-Promo Chain, and the On-sale window, with Purchase and Listed shown equal
    and disabled;
  - Save, Activate, Deactivate and Delete promotion (Delete only while empty);
  - the one Bonus Buy tab and its overview grid, with multi-select;
  - Create, Change, Display, Copy, Activate, Deactivate, Delete and Copy from SAP….
- `BonusBuyEditorPage` is a **placeholder** behind the grant. 417 replaces its body. The routes `…/:promo/bonus-buy/new` and
  `…/:promo/bonus-buy/:bby[?mode=display]` and `editorPath` are already wired.
- The pure seam is `overview.ts`: `overviewStatus`, `runEach`, `readPromotionFlip`, `canDeletePromotion` and `editorPath`.
- The wire model is `core/models/bonus-buy-maintenance.ts`, and the nav leaf is gated in `layout/menu-model.ts`.
- `CONTEXT.md`: **BBY status** is re-read as blank/`1`/`2` (the old A/I/D/X marked as the inquiry's until BackOffice 2384),
  and **Promotion (OMS)** is added.

**Proof:** `overview.test.ts` and `layout/menu-bby-maintain.test.ts` pass (16 tests). The full suite passes (3618), as do
typecheck, lint and build. `tools/bby-maintenance-drive.mjs` passes **26/26**, with every `BbyMaintainWeb` envelope stubbed.

**Decisions taken while building (owner sign-off wanted):**
- 🚩 **The wire shapes are this client's reading of spec 2374.** Reconcile them when 2376 and 2380 ship:
  - the body keys `promoNumber`, `bbyNumber` and `sourceNumber`;
  - the list fields `bonusBuyCount` and `bonusBuys[]`;
  - the refusal shape `{ code, en, ar, number?, field? }`. The promotion-flip report groups refusals by `refusals[].number`,
    which the spec never names.
- 🚩 **A missing status reads as *unknown*, never Activated.** Only a present blank string means Activated, so a drifted
  field cannot paint every row as live. (Raised by the spec review.)
- **Copy targets the current promotion.** Story 47 says "under a promotion I pick", and there is no picker yet. Copy calls
  `BonusBuy/Copy` and then opens Change on the new Planned `OMS…`, as SAP's create-with-reference does. Cancelling in the
  editor therefore leaves a Planned copy behind, which the user can delete.
- **Upload is rendered disabled** until 418 builds the dialog.
- **Confirms were added:** on promotion activate, deactivate and delete, and on a multi-delete. They are not in SAP's
  screen, so drop them if "like SAP" should win here.
- **No Arabic locale file.** The repo has no `locales/ar/` anywhere yet. Server refusals render both their `en` and `ar`
  text.

**Reviews:**
- `/code-review` found 4 issues, all fixed:
  - a not-found header save read as Saved;
  - the selection went stale after deleting every row;
  - a not-found promotion flip showed an empty refusal list;
  - Cancel during a pending create still navigated.
- `/standards-review`, Standards axis: the hard findings are fixed. Those were `fsi` in a cell renderer (the unknown status
  code is now `Ltr` beside the badge), an un-isolated `field` interpolation, and the CONTEXT.md drift. Of the smells, the
  root path is now shared; the rest were left as judgement calls.
- `/standards-review`, Spec axis: the null-status mapping and the notFound and delete-status strictness are fixed. The other
  findings are recorded above.
