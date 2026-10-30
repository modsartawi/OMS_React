---
status: done
spec: BO 3271 (brief C:\Work\DMSCO\BackOffice\.issues\assets\3271-oms-react-fhir-insurance-rules-brief.md)
blocked-by: 692
---

# 693 — A condition's operators follow the fact's type and cardinality

## What to build

Stories 15, 16; F8–F12. Once a FHIR fact is picked, the condition offers only what its type allows:

- **money:** compared within one currency, at 3 decimals, and the currency is part of the value entered;
- **quantity:** a value and a unit;
- **code:** system + code, with the code offered from the fact's declared system;
- **list facts:** `anyOf` / `noneOf` / `count`. A single fact offers no list operator.

The sentence view reads each of them in words, EN and AR, and the guard's `onUnknown` stays visible, because a FHIR fact
can read unknown or unparsed.

## Spine reach

model (condition shapes for the new types) · store/logic (operators per type, validation) · component (condition fields,
sentence view) · i18n (en + ar) · test (pure + drive)

## Proof (→ `tdd` red-green cycles)

- [x] operators per type and cardinality; a money value with more than 3 decimals is refused at the field — pure
- [x] each new condition round-trips through the guard wire shape unchanged — pure
- [x] build one condition of each type, save, reopen, read its sentence; under `ar` too — flow (Playwright drive)
      (RTL layout + Arabic data labels on screen; the `ar` sentences proved against the locale in the pure test: 692's
      `lng: 'en'` finding still holds)

## Boundaries

The client never converts a unit or a currency: that is the engine's. Money stays a string on the way through, never a
JS float. The formula box only changes if the new keys fail it today. Doors stubbed; 711 reconciles.

## Done when

No condition can be built that its fact's type cannot answer, and the sentence reads it correctly.

## Blocked by

692.

## Open questions

- The wire spelling of the money, quantity and code conditions is not in the brief. It belongs to SIS.Rules 2.0.0: read
  the engine ticket's shape if it has landed, otherwise guess and list it for 711.

## Comments

**2026-10-30, built, all stubbed (no live SIS.Api). Replaces 692's stopgap `pickedFact`.** SIS.Rules 2.0.0 (BO 3272) is still
open, so every spelling below is a guess.

Shape guesses for 711:
- Money: `{ check, field, atLeast | under: { amount: "100.500", currency: "BHD" } }`. The amount is a string.
- Quantity: `{ check, field, atLeast | under: { value: "20.5", unit: "%" } }`. The value is a string too.
- Code: `{ check, field, anyOf | noneOf: [...], system: "<url>" }`.
- `noneOf` is spelled literally on a code or a `claim` / `claimResponse` / line FHIR fact. Any other fact stays `anyOf` under
  `not`, so phase-1 rules are byte-identical.
- Count: `count: { atLeast: n }` or `count: { under: n }`, on the editor's ops `countAtLeast` / `countBelow`.
- `is` and `before` / `onOrBefore` / `after` / `onOrAfter` on a FHIR message, as the eligibility block spells them.
- `GET InsuranceRules/CodeSystems/Codes?system=` answers `[{ code, label: { en, ar } }]`. No door ticket names this read
  (3296 loads the labels). If it fails or is empty, the code box still takes raw codes.

**Asks for 711:**
- `guardRulesetIn` still pins `schema: 1`, and 3272 says a ruleset using the new types declares a new schema version. I did
  not guess the number or who stamps it, so it must be settled against the built engine. Until then a ruleset with new types
  goes out as `schema: 1`.
- The `fact` block in `RuleConditions` (coverage rules) was not touched: it has no catalog picker and draws only the phase-1
  operators. A coverage rule holding a new-type fact would not draw properly there.

Overrulable decisions:
- "A single fact offers no list operator" is read as no `count`. A single code or text fact keeps any of / none of (F12 tests
  a code with them).
- A list of numbers, money or quantities offers count only, because any of has nothing to match by.
- Beyond the ticket's list, a flag offers `is` yes / no and a date the four day tests, since 692 left both on `anyOf`.
- A refused value (too many decimals, a bad currency) stays in the box with its reason and never reaches the condition.
  Leaving the box puts back the last good value.
- Picks start at amount `0`, in the row's currency if `unit` is three capitals, else `SAR`. A quantity starts in the row's unit.
- The system box defaults to the declared system and can be edited. Emptied, it drops the key (the engine's default). Codes
  are offered only while it holds the declared system.
- An eligibility `is` or single written-day test stays an `eligibility` block on the wire (674's test stands), and the guard
  editor now draws it as a fact, so it can be edited after a reopen. `today+30` and multi-test blocks stay as written.
- A registry fact keeps its phase-1 reading (a flag is read by codes); only a catalog row gets the new types. An operator its
  fact cannot answer, on a rule saved earlier, stays selected with a warning so the rule still opens.
- The catalog is now read when a block or a rule's sentence reads a FHIR path, including any `$eligibility` key, not only when
  the picker opens. `$patient` and similar paths still do not read it. Denied, the value's shape decides.
- `onUnknown` stays where it was, and a guard's FHIR fact also says beside it what unknown or unparsed does. Coverage rules
  have no `onUnknown`, so they do not show this.
- 692's drive now expects the new starting tests (money object, flag `is: true`).
