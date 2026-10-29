---
status: done
spec: BO 3126 (brief C:\Work\DMSCO\BackOffice\.issues\assets\3126-oms-react-insurance-rules-brief.md); owner walk 2026-10-29
blocked-by: 617
---

# 674 — A coverage rule's item-list and eligibility conditions are shown and edited, not a bare word

## What to build

Found on the owner's walk: the owner selected `A01-NO-CONTRACT` on the Coverage page. Its IF showed a single row
reading **NOT line**, with no list and no value. The owner could not see any logic in the rule. The "Reads as" pane
beside it read it correctly ("the item is in `a01-no-contract`"). The **NOT** on the row is the negate toggle, and it is
switched off.

Cause: `src/features/insurance-rules/coverage/RuleConditions.tsx` (`Leaf`) handles only `patient`, `request` and
`fact`. Any other block falls through to `<code>{c.check}</code>`. The 15 seeded coverage rules (BackOffice SQL 059
and 060, versions 1 and 2 of the coverage line) use two blocks the editor does not handle:

- **`{ "check": "line", "inList": "<list id>" }`**: the item is in one of the **document's own** lists (`lists[]` in
  the coverage document; seeded `a01-no-contract`, `a01-master-update`, `a01-contract`, `a02-approval`,
  `a02-approval-elite`, `a02-approval-sabic`, `a02-approval-aramco`). Each list filters on the line attributes
  that the coverage call writes from the payer's item master (`Insurer.ItemMaster`, `ItemCustomer.Row`,
  `ItemCustomer.DiscountZero`, `ItemCustomer.NeedApproval*`; BackOffice
  `InsuranceCoverageService.ContractAttributesAsync`). 12 of the 15 rules use it.
- **`{ "check": "eligibility", "field": "benefit[13/day].benefit", "atLeast": 10000 }`**: a fact from the insurer's
  eligibility answer. `C-ELITE`, `A02-ELITE-APPROVAL` and `A02-ELITE` use it. The block is not in the `GuardCondition`
  union (`src/core/insurance-rules/model.ts`), but SIS.Rules reads it and both seeded versions published with it.

Also: `{ "check": "request", "field": "payer", "anyOf": [...] }` shows as read-only text (`conditions.requestReads`).
The text is legible, but the author cannot change the payer.

Build:

- **Item list.** A `line` + `inList` row shows a list picker over the document's `lists[]`, by name (EN or AR as
  the page language), with the list id `Ltr`. NOT toggles as on the other rows. Next to the picker, a short
  read-only line says what the list filters on (e.g. "item master = Y · ItemCustomer row = N"), so the
  rule can be read without opening the list.
- **Eligibility fact.** An `eligibility` row shows the field by its registry name (fall back to the raw field `Ltr`
  when the registry has no entry), the operator (`atLeast` / `atMost` / `anyOf` as written) and the value. The value
  and the operator can be edited. Add the block to the model union. A row the editor cannot name is still shown as
  field + operator + value, never as a bare word.
- **Payer.** A `request` + `payer` + `anyOf` row edits its codes (`CodesInput`, as the fact rows do).
- **Fallback.** Any block the coverage editor still does not know (`history`, `supply`, …) shows the same
  sentence the "Reads as" pane gives it, plus a note that it cannot be edited here. Never just the check name.
- **Wire unchanged.** A rule nobody edits goes back exactly as it was read. The `eligibility` block keeps its own
  shape and is never rewritten as a `fact` with an `$eligibility…` path.
- The `Add a condition…` palette offers **Item list** when the document has lists. Adding or editing the lists
  themselves is out of scope.

## Spine reach

components · test

## Proof (→ `tdd` red-green cycles)

- [x] drive (stubbed with the 059 + 060 document): `A01-NO-CONTRACT` shows the list picker on `a01-no-contract` with
      its filter line; `C-ELITE` shows payer `0001100041` and "benefit[13/day] at least 10,000"; no row renders a
      bare check name
- [x] drive: pick another list, toggle NOT, change the 10,000 → Save sends exactly those changes; an untouched rule
      round-trips byte-identical
- [x] unit: the `eligibility` block parses into the model and serialises back unchanged
- [x] mutation: restore the `<code>{c.check}</code>` fallback for `line` → the drive fails
- [x] walk on the owner's local SIS.Api: the Coverage page shows the logic of all 15 seeded rules

## Boundaries

No SIS.Rules or BackOffice change. Editing the document's `lists[]` is out of scope (follow-up if the team asks for
it). Rules: `feature-structure`, `i18n-zero-literal` (EN + AR), `logical-tailwind`, `bidi` (list ids, payer codes and
field paths `Ltr`).

## Done when

Every seeded coverage rule's IF shows what it tests, and the item-list and eligibility conditions can be edited and
saved without changing what was not touched.

## Blocked by

[617](617-the-insurance-team-edits-insurer-settings-category-rules-and-coverage-rules-with-the-payer.md)

## Done (2026-10-30)

- **Model.** `EligibilityCondition` joins the `GuardCondition` union (`core/insurance-rules/model.ts`, with
  `ELIGIBILITY_TESTS` / `eligibilityTests`, as SIS.Rules `RulesetReader.ReadEligibility` reads it). The 618 codec is
  unchanged: an eligibility block with ONE `atLeast` / `under` / `anyOf` test is still the editor's `fact` on
  `$eligibility.<field>` (C-ELITE) and goes back as the eligibility block; every other one (`atMost`, two bounds, a unit,
  `is`, a day) now stays a typed block. `guard-wire`'s `FACT_TESTS` is derived from `ELIGIBILITY_TESTS`.
- **Editor** (`coverage/RuleConditions.tsx`, pure parts `coverage/conditions.ts`): an **item list** row picks from the
  document's `lists[]` by name with the id beside it, and a filter line ("Insurer.ItemMaster = Y · ItemCustomer.Row = N");
  an **eligibility** row shows the field (registry name, else the raw field `Ltr`), each test's operator (switchable
  within its family, in place) and value, and the unit; a codes-only **request** block (the payer) edits its codes; any
  other block (`history`, a request block with a bound, …) shows its Reads-as sentence and clauses with "Kept as
  written". The palette offers **Item list** when the document has lists. The Reads-as pane names a list by its name.
- **Sentence.** `core/insurance-rules/sentence.ts` reads an `eligibility` block in words (every test, the unit as a
  clause), EN + AR.
- **Added at the owner's request on the walk:** a **JSON** button per coverage / category rule (656's `JsonButton`)
  showing the rule as the engine reads it (`guard-wire` `otherRuleOut`), unsaved edits included.
- **Proof.** vitest: `guard-wire.test.ts` (the 059 + 060 document's 15 rules round-trip byte for byte; a kept
  eligibility block is typed and goes back unchanged), `sentence.test.ts` (eligibilitySentence), `coverage/conditions.test.ts`
  (listSummary, testChoices / renameTest); full suite 540 files / 7720 tests green; typecheck + lint green. Drive
  `tools/insurance-coverage-seeded-drive.mjs` on `tools/insurance-coverage-seeded.json` (built from the SQL text) 52/52
  LTR + RTL; mutation (the `<code>{c.check}</code>` fallback restored for `line`) → the drive fails at step 1. 617's
  coverage drive 172/172, 608's guard editor 158/158; 607's insurance-rules drive 84/86 with the same two "one read of
  the ruleset" failures on the base commit (not this ticket). Walk on the owner's local SIS.Api (2026-10-30, user
  14419): all 15 seeded rules show their logic as controls, none a bare word or kept-as-written; JSON of
  A01-NO-CONTRACT matches the seed.
- **Left as is (reviews):** C-ELITE's field reads `$eligibility.benefit[13/day].benefit` in the fact picker and
  "… at least 10000 units" in Reads-as (617's fact row and unit default for a field the registry does not hold); the
  `=` / `≠` / `·` filter-line separators live in the locales; saving the document still adds 618's empty
  `articles` / `categories` / `include` / `exclude` defaults to each list (lists are out of scope).
