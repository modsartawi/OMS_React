---
status: open
spec: C:\Work\DMSCO\BackOffice\.issues\assets\2848-oms-react-promotions-brief.md
blocked-by: 535 (live: BackOffice 2847)
---

# 536 — An author makes a promotion by hand and assigns campaigns to it

> Rewritten by ticket 539 (2026-10-21) to BackOffice 2862's words: promotion, `promotionCode`, `Rules/Authoring/Promotions/*`,
> `RULES_PROMOTION_*`. No scope changed.

## What to build

The brief's D3. A **hand-made promotion** is a label (BackOffice 2847, ADR 0097's addendum): an author creates it, names
it, assigns published campaigns to it and takes them out, and deletes it once empty. **No version and no approval**:
every write happens at once. Contract: the 2848 brief § "a promotion's page" (hand-made) and § "Refusals", and the 2737
brief's `Promotions/Create|Update|Assign|Unassign|Delete` rows.

- **New promotion** on the Promotions list (534): a dialog of promotion code (letters, digits, `.`, `_`, `-`, at most 38; "it never
  changes" said beside it), English name (required), Arabic name, note → `Promotions/Create`. Success opens the promotion's
  page.
- **On a hand-made promotion's page** (535), for an author:
  - **Rename**: names and note → `Promotions/Update` (the code shown, not editable). Send the current Arabic name and note
    as they are (a null keeps it on HQ's side; the dialog always sends what it shows). Also offered on an **uploaded**
    promotion, which may be named (only the names and note).
  - **Assign campaigns**: a dialog that searches every campaign (`Promotions/Campaigns { all: true, q }`, the first page
    of results) with checkboxes, then `Promotions/Assign { promotionCode, campaigns }`. The success line names how many were
    assigned and which were **moved** from another promotion (`moved[{ id, from }]`).
  - **Unassign**: row checkboxes in the table and an Unassign action → `Promotions/Unassign { campaigns }`; they go to no
    promotion.
  - **Delete**, enabled only when the promotion has no campaigns → `Promotions/Delete { promotionCode }`, then back to `/campaigns`.
- **Refusals** in the dialog that made the call (HQ's message, the code, details one line each), the promotion unchanged:
  409 `RULES_PROMOTION_EXISTS`, 409 `RULES_PROMOTION_OWNED` (an uploaded campaign; Delete of an uploaded promotion), 409
  `RULES_PROMOTION_NOT_EMPTY`, 404 `RULES_PROMOTION_CAMPAIGN_NOT_FOUND`, 404 `RULES_PROMOTION_NOT_FOUND`, 400 `RULES_PROMOTION_BAD`, and a
  bare 403.
- After every write, the promotions list and the touched promotions' pages (both sides of a move, and no-promotion) refresh.

## Spine reach

api (feature `api.ts`: create, update, assign, unassign, delete) · logic (promotion-code check, assignment summary,
refusal view) · dialogs · i18n EN · test

## Proof (→ `tdd` red-green cycles)

- [ ] `promotionCodeError`: empty, 39 characters, a space or `/` are refused; `0001-W43_ad.hoc` passes (vitest)
- [ ] `assignmentSummary`: `{ changed: [a, b, c], moved: [{ id: c, from: X }] }` reads "3 assigned, 1 moved from X" (vitest)
- [ ] `promotionRefusalView`: each code above maps to its message and keeps the `errors` detail lines (vitest)
- [ ] `tools/campaign-promotions-drive.mjs` gains: create a promotion, assign two campaigns (one moved), unassign one, delete refused while not empty then allowed, an uploaded campaign's assign refused `RULES_PROMOTION_OWNED` with the promotion unchanged, a taken code refused `RULES_PROMOTION_EXISTS`. LTR and RTL
- [ ] `npm run typecheck`, `npm run lint`, `npm test` green

## Boundaries

- Doors: `Promotions/Create|Update|Assign|Unassign|Delete` (BackOffice 2847, built). Stubbed until 538.
- No promotion-wide disable and no promotion budget (out of scope in the brief).

## Done when

The Proof boxes are ticked: on the running app (stubbed), an author makes a promotion, fills it, empties it and deletes it,
and every refusal reads in its dialog.

## Blocked by

[535](535-a-promotion-s-page-lists-its-campaigns-paged-and-filtered-on-the-server.md)
