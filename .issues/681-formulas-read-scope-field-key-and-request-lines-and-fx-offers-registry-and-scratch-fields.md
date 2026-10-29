---
status: open
spec: BO 3243 (brief C:\Work\DMSCO\BackOffice\.issues\assets\3243-oms-react-rule-playground-brief.md; ADR C:\Work\DMSCO\BackOffice\docs\adr\0117-insurance-rule-formulas-read-registry-fields-and-the-whole-request.md; stories 28, 32, 33)
blocked-by: 679, 680
---

# 681 — Formulas read `<scope>.field.Key` and `request.lines`, and ƒx offers registry and scratch fields

## What to build

The language of ADR 0117, in the playground.

**`core/rules/expr`.** Verified on main 880090d6: the parser **already** reads `line.field.HouseBrand` as a generic
dotted path and `lines(request.lines)` as a generic call. So this slice adds the rules the language now has, not a
tokenizer:
- `field` is a **reserved segment**. A path holding it must be exactly `line|request|patient` + `.field.` + one key
  segment. `line.field` alone, `line.field.A.B` and `eligibility.field.X` are refused with a new problem code
  (`badField`, en + ar words in every namespace that renders `fx.problem.*`).
- `request.lines` prints and reads round-trip, inside `filter(request.lines, line.quantity > 1)`, `sum(…)`,
  `count(…)` and `lines(…)`.

**ƒx in a playground formula block** (`GuardFormulaBox`, moved to core by 676, gains optional props so the real guard
screens are unchanged):
- a **Fields** group listing registry fields (`GET InsuranceRules/Fields`, the existing `fieldsQuery`) and the
  experiment's scratch fields, each inserted as `<scope>.field.<Key>` with its type;
- `request.lines` in the fields, and `lines`, `filter`, `sum`, `count` in the function list, with the note "`count`
  sums units, `lines` counts lines";
- a recipe for the cross-line check: `count(filter(request.lines, line.item == '200021')) > 0`.

**Fields drawer:** pick registry fields, or declare scratch ones (key, scope `line|request|patient`, type
`text|number|date|flag`). Both are written into the document's `fields` block `[{ key, scope, type }]`. A duplicate
key is refused in the drawer. Scratch fields are **never** posted to the registry.

**Decision (overrulable):** the real guard and coverage screens' ƒx stays exactly as it is. Offering fields there
needs the `fields` declaration plus BackOffice validate (stories 51-62), which is not this wave.

## Spine reach

store/logic (`expr` cases, fields block edit, fx entries from registry + scratch) · component (drawer, ƒx props) ·
i18n (`insurance-playground` + the `fx.problem.badField` words) · test

## Proof (→ `tdd` red-green cycles)

- [ ] `expr.test.ts` (extend) — `line.field.HouseBrand`, `request.field.X` and `patient.field.Y` read and print
      round-trip; `line.field`, `line.field.A.B` and `eligibility.field.X` are `badField`; `lines(request.lines)` and
      `filter(request.lines, line.item == '200021')` round-trip — pure
- [ ] `fieldsBlock` — picking a registry field and declaring a scratch one write `{ key, scope, type }` once each; a
      duplicate is refused; removing one drops it — pure
- [ ] drive: open ƒx in a playground formula block, insert a registry field and a scratch field, and see them in the
      JSON's `fields`; the real guard editor's ƒx is unchanged (guard-editor drive green) — flow

## Boundaries

`GET InsuranceRules/Fields` (existing, 3132; the playground role is granted its read). The `fx.problem.*` words live
in more than one namespace. Add `badField` to each one that renders the problem.

## Done when

A playground formula reads registry and scratch fields and `request.lines`, ƒx offers them, and the `fields` block is
written. `expr` vitest and drives are green.

## Blocked by

[679](679-a-guard-mini-ruleset-is-built-with-the-real-editors-and-the-engine-json-is-live-beside-them-both-ways.md),
[680](680-coverage-and-category-mini-rulesets-are-built-with-their-real-editors.md)
