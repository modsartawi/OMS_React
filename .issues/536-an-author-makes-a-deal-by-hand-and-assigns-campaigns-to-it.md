---
status: open
spec: C:\Work\DMSCO\BackOffice\.issues\assets\2848-oms-react-deals-brief.md
blocked-by: 535 (live: BackOffice 2847)
---

# 536 — An author makes a deal by hand and assigns campaigns to it

## What to build

The brief's D3. A **hand-made deal** is a label (BackOffice 2847, ADR 0097's addendum): an author creates it, names
it, assigns published campaigns to it and takes them out, and deletes it once empty. **No version and no approval**:
every write happens at once. Contract: the 2848 brief § "a deal's page" (hand-made) and § "Refusals", and the 2737
brief's `Deals/Create|Update|Assign|Unassign|Delete` rows.

- **New deal** on the Deals list (534): a dialog of deal code (letters, digits, `.`, `_`, `-`, at most 38; "it never
  changes" said beside it), English name (required), Arabic name, note → `Deals/Create`. Success opens the deal's
  page.
- **On a hand-made deal's page** (535), for an author:
  - **Rename**: names and note → `Deals/Update` (the code shown, not editable). Send the current Arabic name and note
    as they are (a null keeps it on HQ's side; the dialog always sends what it shows). Also offered on an **uploaded**
    deal, which may be named (only the names and note).
  - **Assign campaigns**: a dialog that searches every campaign (`Deals/Campaigns { all: true, q }`, the first page
    of results) with checkboxes, then `Deals/Assign { dealCode, campaigns }`. The success line names how many were
    assigned and which were **moved** from another deal (`moved[{ id, from }]`).
  - **Unassign**: row checkboxes in the table and an Unassign action → `Deals/Unassign { campaigns }`; they go to no
    deal.
  - **Delete**, enabled only when the deal has no campaigns → `Deals/Delete { dealCode }`, then back to `/campaigns`.
- **Refusals** in the dialog that made the call (HQ's message, the code, details one line each), the deal unchanged:
  409 `RULES_DEAL_EXISTS`, 409 `RULES_DEAL_OWNED` (an uploaded campaign; Delete of an uploaded deal), 409
  `RULES_DEAL_NOT_EMPTY`, 404 `RULES_DEAL_CAMPAIGN_NOT_FOUND`, 404 `RULES_DEAL_NOT_FOUND`, 400 `RULES_DEAL_BAD`, and a
  bare 403.
- After every write, the deals list and the touched deals' pages (both sides of a move, and no-deal) refresh.

## Spine reach

api (feature `api.ts`: create, update, assign, unassign, delete) · logic (deal-code check, assignment summary,
refusal view) · dialogs · i18n EN · test

## Proof (→ `tdd` red-green cycles)

- [ ] `dealCodeError`: empty, 39 characters, a space or `/` are refused; `0001-W43_ad.hoc` passes (vitest)
- [ ] `assignmentSummary`: `{ changed: [a, b, c], moved: [{ id: c, from: X }] }` reads "3 assigned, 1 moved from X" (vitest)
- [ ] `dealRefusalView`: each code above maps to its message and keeps the `errors` detail lines (vitest)
- [ ] `tools/campaign-deals-drive.mjs` gains: create a deal, assign two campaigns (one moved), unassign one, delete refused while not empty then allowed, an uploaded campaign's assign refused `RULES_DEAL_OWNED` with the deal unchanged, a taken code refused `RULES_DEAL_EXISTS`. LTR and RTL
- [ ] `npm run typecheck`, `npm run lint`, `npm test` green

## Boundaries

- Doors: `Deals/Create|Update|Assign|Unassign|Delete` (BackOffice 2847, built). Stubbed until 538.
- No deal-wide disable and no deal budget (out of scope in the brief).

## Done when

The Proof boxes are ticked: on the running app (stubbed), an author makes a deal, fills it, empties it and deletes it,
and every refusal reads in its dialog.

## Blocked by

[535](535-a-deal-s-page-lists-its-campaigns-paged-and-filtered-on-the-server.md)
