---
status: done
spec: BO 3953 (C:\Work\DMSCO\BackOffice\.issues\3953-every-web-oms-document-shows-its-whole-family-spec.md)
blocked-by: BO 3954
---

# 906 — An order page shows its family and every delivery opens in one click

## What to build

BackOffice spec [3953](C:\Work\DMSCO\BackOffice\.issues\3953-every-web-oms-document-shows-its-whole-family-spec.md) ("Family panel"). The prototype is BackOffice
`.issues/assets/3943-family-panel-prototype.html`.

- **A pure family-tree model**, next to the document feature (prior art: `delivery-money-strip.ts`). It
  turns the endpoint's nodes into an ordered tree from the root, and gives each node:
  - its depth;
  - "is the open document";
  - its link: `/oms/delivery/:no` for D/T, `/oms/document/:no` for Q/O/X/R/E, none for a billing or
    for the open document.

  It also gives the member count. A single member means the section is hidden.
- **The "Family (n)" `Disclosure`:** open by default, first in `FactsColumn`, on both routes (one
  component). It renders only when there is more than one member.
- **The call:** `GET SdDocumentWeb/Document/{no}/Family?category=` starts after the record loads, using
  the record's `documentCategory`.
- **Each node shows:**
  - a category badge with the name as a tooltip;
  - the number, as a link;
  - category name, type, store and date (local time) on one muted line, cut short with an ellipsis;
  - a status chip.

  Indentation uses logical properties.
- **The open document:** tinted, with an inline-start accent bar and a "You are here" tag. It is not a
  link, and it scrolls into view (`block: nearest`).
- **Clicking a member** uses normal router navigation, so Recent records it.
- **Strings:** EN and AR.

## Spine reach

SIS.Api Family route (BackOffice 3954) → api client → tree model → UI.

## Proof (→ `tdd` red-green cycles)

- [x] `family-tree` model: tree order and depth from the root, sibling order kept, links per category,
  no link for a billing or for the open document, the count, and a single member is hidden · vitest
- [x] i18n keys exist in EN and AR (prior art: `delivery-money-strip-i18n-keys.test.ts`) · vitest
- [ ] By eye: an order with two deliveries on the sandbox, opened from each delivery

## Boundaries

oms-react only. It needs BackOffice 3954 deployed to the SIS.Api it talks to.

## Done when

The model tests are green, and on the sandbox an order with two deliveries reaches each one from the
section, and back.

## Blocked by

BackOffice [3954](C:/Work/DMSCO/BackOffice/.issues/3954-an-order-with-two-deliveries-answers-its-whole-family-from-either-delivery.md)

## Comments

**2026-11-16 — client half built, stubbed; live walk owed on BackOffice 3954.** "Done" here is the client
half only, as prior waves mark it ("done, stubbed"): BO 3954 (the Family endpoint) is not deployed
anywhere yet, so the api client is built against spec 3953's fixed shape ("Family endpoint", ruling
3944) and has never met a real answer.

- **Model:** `src/features/oms/document/family-tree.ts` (`familyTree`, `familyLink`, `familyCategoryKey`,
  `familyKey`), proved by `family-tree.test.ts` (tree order and depth from the root, sibling order kept
  from the answer, a billing and a return order sharing a 30… number kept apart, the open document by
  number + category, links per category with none for B/C/V or the open document, the count, a lone
  member / no answer / a missing root hidden, a repeated member or loop drawn once). Wire type in
  `src/core/models/document-family.ts`; `documentApi.getFamily` in `api.ts`.
- **i18n:** `document:family.*` in `src/locales/en/document.json` and `src/locales/ar/document.json`,
  proved by `family-i18n-keys.test.ts`. The app's `lng` stays `en` (`core/i18n.ts`), so Arabic words
  show only once Arabic is switched on; RTL direction already mirrors.
- **UI:** `FamilyPanel.tsx`, first in `FactsColumn` on both routes, open by default; the read waits on
  the record and asks with its `documentCategory`; a failed read draws nothing (907 adds the quiet
  line); the page's Refresh re-reads it. The status chip is neutral (`StatusBadge sev="mute"`): the
  endpoint sends a status description, not a severity.
- **Drive:** `tools/document-family-drive.mjs` against a stubbed Family route (the prototype's Bupa
  order with two deliveries), LTR + RTL: 28/28 — section first and open, "Family (4)", tree order, the
  open delivery tagged and not a link, one click to the sibling, to the order and back, inline-start
  indentation in both directions, a lone document and a failed read draw nothing.
- **Not done:** the by-eye sandbox proof (an order with two deliveries opened from each delivery) —
  it cannot be done until BO 3954 is deployed to a SIS.Api. Left unticked; that walk is owed.
- `npm run lint`'s boundary gate fails on four pre-existing imports in
  `src/features/insurance-rules/aliases/door-shapes.test.ts` (not this ticket); the other four gates pass.

### 2026-11-16 - drift check

BackOffice 3954-3956 are done and merged to BO `pricing2` (b281ff971, 11 commits ahead of origin, unpushed). `DocumentFamilyModel` and the `GET SdDocumentWeb/Document/{documentNo}/Family?category=` route match `src/core/models/document-family.ts` field for field; no client change was needed. Server refinements (54773acf): an over-long number is refused SDD-02252, the walk up is uncapped (the depth cap bounds the walk down only), and the partner reference may sit on a root ERX as well as O/X; the client already draws it on the root whatever its category. The route is NOT on staging yet (172.23.10.110:4321 answers 404 for Family, 401 for Logs), so the live walk is still owed.
