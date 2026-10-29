---
status: open
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

- [ ] `dataRoundTrip` (extend) — history, reference, eligibility facts of each type, and the payer round-trip; empty
      sections stay empty arrays or objects, as the door expects — pure
- [ ] drive: add a history event and an eligibility fact in the form and see both in the JSON; the payer section
      shows only for coverage — flow

## Boundaries

No new door. The exact `reference` and `payer` shapes are written from the brief's names and reconciled in 691.

## Done when

The whole `data` shape is editable as a form, and an empty section reads "none". Vitest and drive are green.

## Blocked by

[682](682-the-form-and-the-json-edit-one-dataset-request-patient-lines-and-their-attributes.md)
