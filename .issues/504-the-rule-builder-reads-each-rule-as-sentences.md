---
status: done
spec: BO 2737 (brief C:\Work\DMSCO\BackOffice\.issues\assets\2737-oms-react-rule-engine-brief.md)
blocked-by: 501
---

# 504 — The rule builder reads each rule as sentences

## What to build

The workspace's **Rule builder** page shows the campaign's rules top to bottom as collapsible cards, each
with a one-line summary. Inside a card:

- the rule's **named cart-item filters** as a chain ("Shampoos = category X, not Prescription");
- **When** (all / any) conditions as sentences ("the subtotal of Shampoos is at least SAR 100.00");
- **Then** effects as sentences ("take 15% off each item of Shampoos");
- a rule with **no condition** is legal and reads "always", as for a bundle, a value map or "for each item in X".

Sentences are built by a pure `core/rules/sentence.ts` from the **block catalogue** (types, fields, units,
palette groups), which is fetched once and cached. Filters are shown by their current name, looked up by
id. Values are isolated by kind (money and counts in `Ltr`, names in `<bdi>`), and each sentence is formatted whole.

## Spine reach

model/api (`catalogue`) · logic (`sentence.ts`) · component (builder page, read-only) · i18n · test

## Proof (→ `tdd` red-green cycles)

- [x] `sentence_rendersEveryCatalogueBlock_ofThePrototypeCampaigns` — no raw type id leaks · pure
- [x] `sentence_namesAFilterByItsCurrentName_viaId` · pure
- [x] drive: the builder shows a stubbed campaign's rules as sentences; collapse / expand · flow

## Boundaries

Provisional catalogue endpoint (BackOffice 2758), stubbed. Sentence templates live in the namespace JSON (zero
literal). Values go in through `<Trans>` slots, following the bidi rule.

## Done when

Every prototype sample campaign renders as sentences with no raw keys, and the gates are green.

## Blocked by

[501](501-a-marketer-sees-the-campaigns-list-by-state-and-opens-a-campaigns-dashboard.md)

## As built

- **Catalogue (PROVISIONAL):** `RuleBlockCatalogue` in `core/models/rule-campaign.ts` (blocks with typed fields: kind, options, `variant`, `unitFrom`, `clause`, `plural`, `role`); door `GET RuleCampaign/Catalogue` in `core/rules/api.ts`; `ruleCatalogueQuery` never goes stale, so the catalogue is read once per page load (the drive asserts one read across two campaigns).
- **Logic:** `core/rules/sentence.ts` is pure. A block becomes a locale key plus typed values (money, number, percent, code, formula, name, day, phrase, list), with trailing clauses and its EN + AR lines kept apart by role. Filters are read by id under their current name. A formula is shown as written, never parsed. Currency comes from the audience (SA→SAR, BH→BHD, both→no code), PROVISIONAL.
- **Screen:** `workspace/RulesPage.tsx` at `/campaigns/:id/rules` (menu item "Rule builder", landed), with `RuleCard.tsx` and `SentenceView.tsx`. Each sentence renders through `<Trans>` with EMPTY slots, and each slot component isolates its value by kind (`Ltr` for machine values, `<bdi>` for names). The EN + AR lines show the Arabic `dir="rtl"`. A rule with no (leaf) condition reads "Always". A refused catalogue shows the door's message and a Try again button.
- **Proof:** `src/core/rules/sentence.test.ts` (14 tests) reads the drive's own fixtures (`tools/campaigns-fixtures.mjs`, typed by `tools/campaigns-fixtures.d.mts`). It renders every sample block (19 types) and every catalogue block (26), with no raw key and no camelCase type id, and checks that a renamed filter reads through. `tools/campaigns-drive.mjs` passes 123/123, stubbed. 504's checks are 16–23: every sample campaign, isolation by kind, EN + AR, "Always", rename by id, collapse / expand / all, and the refusal with retry. 501's check 5 now expects Dashboard and Rule builder in the menu.
- **Gates:** typecheck, `npm test` (5288), lint (4 gates) and build are all green.
- **Outstanding (not AFK's):** the owner's sign-off on the rulings in `.afk/HITL-504.md` (catalogue shape, currency from countries, summary always shown, codes not yet named). The live catalogue door is 520's.

