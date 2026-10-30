---
status: done
spec: BO 3243 (brief C:\Work\DMSCO\BackOffice\.issues\assets\3243-oms-react-rule-playground-brief.md; stories 12-15)
blocked-by: 682
---

# 683 — History, reference rows, eligibility facts and the coverage payer are edited in the form, and an empty section reads "none"

## What to build

The rest of the `data` shape in 682's form:

- **history** events: on (date), item, quantity, days supply, store, payer, `attributes`;
- **reference** rows (SFDA / CHI, the engine's `GuardReference`);
- **eligibility facts:** key (`benefit[66].approvalLimit`), type (number/text/flag/date), value, unit;
- **payer** (coverage experiments only: the engine's `CoveragePayer`).

An empty history or reference section reads **"none"** (a first-time patient), not a blank. Kept in the same Form ⇄
JSON round-trip as 682.

## Spine reach

store/logic · component · i18n · test

## Proof (→ `tdd` red-green cycles)

- [x] `dataRoundTrip` (extend) — history, reference, eligibility facts of each type, and the payer round-trip; empty
      sections stay empty arrays or objects, as the door expects — pure
- [x] drive: add a history event and an eligibility fact in the form and see both in the JSON; the payer section
      shows only for coverage — flow

## Boundaries

No new door. The exact `reference` and `payer` shapes are written from the brief's names and reconciled in 691.

## Done when

The whole `data` shape is editable as a form, and an empty section reads "none". Vitest and drive are green.

## Blocked by

[682](682-the-form-and-the-json-edit-one-dataset-request-patient-lines-and-their-attributes.md)

## Comments

- 2026-10-30 (683 built, branch `impl/3243-683`). vitest: `data-form.test.ts` +11 (25 in all: round trip of every
  section, empty sections, payer only for coverage, unholdable sections kept as JSON, history add/remove, facts of each
  type, fact type change, `readEligibility`/`writeEligibility`, reference rows add/edit/remove, payer edits);
  `i18n-keys.test.ts` +1. Drive `tools/insurance-playground-form-drive.mjs` extended (step 7) 80/80 LTR + RTL; 677
  116/116, raw 52/52, reads 46/46 still green. typecheck, lint, test (7963), build green. No new door, no stub section.
- **Layout:** `data-form.ts` now holds every section. `formFromData(data, { payer })` / `formFromText(text, { payer })`
  — the payer is a form section only when `payer: true` (DataPane passes `kind === 'coverage'`); otherwise `payer` is
  kept as JSON and named in `more`. `DataForm` gained `history` (`FormEvent[]`, like lines, `HISTORY_FIELDS` on, item,
  quantity, daysSupply, store, payer + attributes), `historyPresent`, `reference` (`{ kinds, rows: ReferenceRow[] }`),
  `eligibility` (`{ facts: FactRow[] }`), `payer` (`{ deductibles: DeductibleRow[] }`). Each is **null** when the data
  holds that section in a shape the form cannot show: unlike request/patient/lines this is NOT a refusal of the
  whole form — the section stays JSON, is named in `more`, and the rest of the form works.
- **For 685:** `readEligibility(block) → FormEligibility | null` and `writeEligibility(form) → block` are the pure pair.
  To "use these facts", build the block `{ [key]: { type, [type]: value, unit } }` from the Flatten facts and set
  `form.eligibility = readEligibility(block)` (or replace the data's `eligibility` key and re-read). A fact row is
  `{ key, type, value (text of the slot its type names), unit, base }`; an untouched fact is written back as it was
  (extra keys such as `raw` survive), a changed type moves the value to the new slot.
- **Shape guesses for 691:** reference = the engine's GuardReference as tables keyed by code — `sfda: { code: row }`
  (one per code), `mapped` / `formulary: { code: [rows] }` (a list); any other key whose value is table-shaped is shown
  as a table too, anything else (e.g. `editions`) is kept and named in `more`. A table's one/many is read from the data,
  and a new table guesses by name (`sfda` one, else many). A row's fields are key/value text; an EDITED value keeps the
  JSON type its key had (number, list of codes, flag), a new key is text. Payer = `{ deductibles: { G1|G2|G3:
  { percent, max } } }` (678's seed); absent groups show as empty G1–G3 rows and are written only once typed.
  Eligibility facts: `{ type, number|text|flag|date, unit }` (BackOffice `EligibilityFact`); unit is written only when
  given or already there.
- **Decisions (overrulable):** an empty history, reference AND eligibility read "none" in words (history: "a
  first-time patient"); the payer never reads none (its three groups always show). A new reference row is an SFDA row
  with no code and a new fact a number with no key — neither is written until it has one. A flag value is typed as
  `true`/`false` text (anything else stays text, and the engine says so); a date is typed as text (no date picker, so a
  payer's odd date text is never lost). History events have no reorder (the engine reads them as a set by date).
