---
status: done
spec: BO 3271 (brief C:\Work\DMSCO\BackOffice\.issues\assets\3271-oms-react-fhir-insurance-rules-brief.md)
blocked-by: —
---

# 692 — The FHIR catalog opens from a condition, and picking a field writes its rule key

## What to build

Stories 1–3, 17, 18; 3262 V1, C1–C5; doors 3282, 3284. **The tracer of the wave.** In the guard editor, a condition's
field opens a catalog of FHIR facts, grouped by message (eligibility, claim, claim response, communication, payment)
and then message-level against line-level. Each field shows its EN and AR labels, its type, a dot per channel
(answers / sometimes / never) and, on demand, its FHIRPath. Picking one stores the rule key as written
(`$eligibility.<key>`, `$claim.<key>`, `$claimResponse.<key>`, `$line.claim.<key>`, `$line.claimResponse.<key>`).
The Fields page lists the same catalog.

A line field is written once against the line's own `Claim.item`: the author never sees a sequence number. The phase-1
eligibility keys appear with their names and types unchanged, and a rule that already uses them opens as before.

**Decision (overrulable):** the picker lives in `core/insurance-rules`, because the guard and monitor editors both need
it and a feature may not import a feature.

Look: the 3262 prototype (`C:\Work\DMSCO\BackOffice\.scratch\proto\3262-fhir-value-picker\index.html`), as corrected by
3262's Answer. The stubbed rows are the first rows of spec 3271, with C1–C5 applied.

## Spine reach

model/api (registry row gains moment, FHIRPath, cardinality, declared system) · store/logic (grouping, key from a pick)
· component (picker, Fields page) · i18n (en + ar) · test (pure + drive)

## Proof (→ `tdd` red-green cycles)

- [x] grouping by message then level, and the key a pick writes, for a message row and for each line side — pure
- [x] the stubbed rows hold C1–C5: line copay reads `copay`; the not-in-force reason at the root, marked legacy; site
      eligibility reads root and `insurance`; the selection reason names its extension; `benefit.allowed` is the
      three-way choice — pure
- [x] a phase-1 rule opens and saves with its keys unchanged — flow (Playwright drive)
- [x] pick from the catalog, see the key stored, open the FHIRPath on demand, read the channel dots; under `ar` too — flow
      (RTL layout + Arabic data labels only: see the finding in Comments)

## Boundaries

No rule evaluates anything here. Data values follow `bidi`: FHIRPath and keys are `Ltr`, an Arabic label is `<bdi>`.
Keep the existing `$` phase-1 pickers working until 693 replaces their operators. Doors stubbed; 711 reconciles.

## Done when

An author finds a field by message, sees who answers it and what it reads, and the rule holds the right key. typecheck,
lint, `npm test` and the drive are green, and the shape guesses are listed in Comments for 711.

## Blocked by

None (can start immediately).

## Open questions

- No door ticket's "What to build" names the catalog `GET`; 3282 is the closest. Guess the shape and raise it in 711.

## Comments

**2026-10-30, built, all stubbed (no live SIS.Api).**

Shape guesses for 711:
- `GET InsuranceRules/Fields/Catalog` answers the rows, a door separate from `GET InsuranceRules/Fields`, so nothing that
  reads the registry changes. Query key sits under `FIELDS_KEY`.
- Row: `key`, `label`, `moment`, `level` (`message` | `line`), `type` (the registry's four + `code`, `money`, `quantity`),
  `unit`, `fhirPath`, `cardinality` (`single` | `list`), `system`, `channels: [{ channel, answer }]` (`answers` |
  `sometimes` | `never`), `parameter` (`category` or null, with `[*]` in the key), `choice` (FHIR types or null),
  `legacy: { removedOn, replacement }` or null, `retired`.
- Wire blocks: `{ check: claim | claimResponse, field }`, and a line fact as `{ check: line, field: claim.<key> }` (from
  3256's "line (`claim.x`, `claimResponse.x`)"). `under` stays `under` on these line blocks in the editor's `below`.
- The channel rates, the two `benefit.*` phase-1 paths and the `day-benefit` code in the stubbed rows are invented.

Overrulable decisions:
- The picker is added beside the existing `$` Select, which stays until 693. It sits in `ConditionEditor`, so the coverage
  editors' and playground's fact block that use it get the button too; RuleConditions' own fact row does not.
- A parameterised field is listed but cannot be picked yet: a pick would store `[*]` with no code. 694 lifts this.
- A pick starts a number, money or quantity at `atLeast 0`, and anything else at `anyOf []`, including `date` and `flag`.
  That is a stopgap: 693 owns operators per type, and money as a string.
- A message or level with no field is left out, so communication and payment do not show until they have rows.
- `legacy` is carried but not drawn (694). A retired row is hidden from the picker and badged on the Fields page.

Finding: `core/i18n.ts` holds `lng: 'en'` and nothing calls `changeLanguage`, so `oms.locale=ar` gives the RTL layout with
English chrome. The drive's `ar` run therefore proves RTL and the Arabic labels from data. The `ar` chrome keys are proved
only by the mirror test, never on screen.

**2026-10-30, review fixes (branch `t3271-review-fix`), all stubbed.** `failureWords` is now one file, `fields/failure-words.ts` (the raw-path and tree screens, 695 and 697, shared two copies).
