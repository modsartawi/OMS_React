---
status: done
spec: BO 3126 (brief C:\Work\DMSCO\BackOffice\.issues\assets\3126-oms-react-insurance-rules-brief.md); owner ask 2026-10-29
blocked-by: 608
---

# 657 — The guard formula box has the ƒx helper

## What to build

The guided **ƒx** helper the promotion rule's formula box has (ticket 507) — Fields / Functions / Recipes tabs and the
operator chips, each put in where the cursor was — on the insurance **guard's formula block**:

- The reusable helper moves to core, `@/core/rules/fx-helper/`: `FxHelper` (the tabs, fed a guide by its caller),
  `FxToggle` (the ƒx button), `useCaretInsert` (the box's cursor, kept while the helper has the focus) and `insert`
  (`insertAtCursor`, operator / text chips; a chip may now leave a placeholder **selected**). The words stay
  feature-owned: the helper reads the caller's namespace under `fx.*`. The promotion box keeps its behaviour and
  its `data-fx-*` hooks.
- A guard formula guide, `@/core/insurance-rules/guard-formula-guide`: Fields grouped Patient / Request / Line /
  Eligibility with type badges — exactly the `$`-paths SIS.Rules lets a guard formula read
  (`RulesetReader.Guards.cs` `FactPaths` + `EligibilityPathType` over `GuardEligibilityKeys`); the keyed eligibility
  fields `benefit[<code>].<field>` and `tob[<code>]` go in with `<code>` selected; the functions that type-check in a
  guard (`in`/`list`, `if`, `min`, `max`, `abs`, `round`, `floor`, `ceil`, `band`); eight true/false recipes.
- The codec (`@/core/rules/expr`) reads and prints a path segment with one bracketed key
  (`eligibility.benefit[GEN].copayPct`); a `<code>` placeholder never reads.
- `GuardFormulaBox` in the guard editor: the box, ƒx, and a line saying whether the text reads. EN + AR words in
  `insurance-guards` (`fx.*`).

Left out, by the engine: `items` / `sum` / `count` (a guard formula has no item filters or item list), and any
DATE path (`line.supplyEndsOn`, `eligibility.coverage.periodEnd` …) or `line.icd` — SIS.Rules reads those with a
block's tests only, so "supply runs past coverage end" and "ICD starts with" stay blocks, not formula recipes.

## Spine reach

ui · test

## Proof (→ `tdd` red-green cycles)

- [x] the guard field list pinned against `RulesetReader.Guards.cs` / `GuardEligibility.cs`; no date path offered
- [x] every guard recipe and function example reads through `expr.ts` and types as true/false over the guide's paths
- [x] insert-at-cursor selects a snippet's placeholder (`insertAtCursor_selectsTheSnippetsPlaceholder`); a keyed
      field does not read until its code is typed — mutation-checked (dropping the selection fails the test)
- [x] the bracketed key round-trips through the codec
- [x] `tools/insurance-guard-editor-drive.mjs` step 10 (LTR + RTL): open ƒx, insert a field and operators, a keyed
      field with `<code>` selected, a recipe; the saved rule stores the engine's `expr`
- [x] the campaigns drive unchanged; tsc, lint, the whole vitest suite green

## Boundaries

Feature boundaries: the helper and the guides are core; each feature owns its words. Rules: `feature-structure`,
`i18n-zero-literal` (EN + AR), `bidi`, `logical-tailwind`. The control ratchet moves the helper's two hand-styled
buttons from `campaigns/workspace` to `core/rules`.

## Done when

The guard formula box opens the ƒx helper and everything it inserts is a path, function or test the engine reads.
