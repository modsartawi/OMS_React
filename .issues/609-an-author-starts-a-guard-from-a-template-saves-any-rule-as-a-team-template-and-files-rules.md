---
status: done
spec: BO 3126 (brief C:\Work\DMSCO\BackOffice\.issues\assets\3126-oms-react-insurance-rules-brief.md)
blocked-by: 608
---

# 609 — An author starts a guard from a template, saves any rule as a team template, and files rules in folders

## What to build

The **template gallery** (phase-1 templates with their DUR conflict code, plus team templates); filling a
template's blanks creates an independent draft rule. **Save as template** from any rule, choosing which values
become blanks. **Folders**: create, rename, move rules — authoring only, no approval.

**HQ contract:** the brief's sections for BackOffice 3139. Build against those shapes, stubbed in the drive; a shape the
BackOffice ticket changes is recorded in the brief and reconciled in the live-doors ticket.

Reference look: [Insurance Rules Builder](https://claude.ai/code/artifact/5qwrpEcu9o6ThdwsQphb4y)
(`C:\Work\DMSCO\BackOffice\.scratch\proto\3096-insurance-rules\index.html`).

## Spine reach

components · logic (fill blanks) · test

## Proof (→ `tdd` red-green cycles)

- [x] `fillTemplate_blanksBecomeRuleValues` — pure
- [x] drive (stubbed) — refill template → draft; save as template; move to folder

## Boundaries

— Rules: `feature-structure`, `i18n-zero-literal`, `logical-tailwind`, `api-envelope`, `bidi` (patient keys and codes `Ltr`, Arabic text `<bdi>`). Local time only.

## Done when

Gates green; drive passes.

## Blocked by

[608](608-an-author-edits-a-guard-from-a-palette-with-nested-all-of-any-of-groups-and-not-severity-e.md)

## Open questions

- **Layout follows the insurance team's walk** of the prototype (https://claude.ai/code/artifact/5qwrpEcu9o6ThdwsQphb4y, BackOffice map ticket 3096, still open). Reactions recorded there before this is built amend this ticket.

## Comments

**2026-10-27 — built on `impl/3126-609`.** Proof: `src/core/insurance-rules/templates.test.ts`
(fillTemplate_blanksBecomeRuleValues, an unfilled blank keeps its default, the draft is independent of the template,
a non-blank path is ignored, missingBlanks, blankCandidates, every stub phase-1 blank points at a value),
`folders.test.ts` (empty kept folders, childPath / renamedPath, a name refused empty / with `/` / a sibling's in any
case), `templates/i18n-keys.test.ts` (en/ar mirror for `insurance-templates`, blank words), menu test; drive
`tools/insurance-templates-drive.mjs` 90/90 STUBBED (LTR + RTL): the gallery (16 phase-1 templates from 3093, conflict
codes LTR), T-QTY filled → G-012 opened in the editor with the blanks' values and the template untouched, G-012 saved
as a team template with two blanks, refilled → G-013, G-013 moved to an empty kept folder, a new folder (sibling name
refused) and a rename (the rule follows), a bare 403 on the gallery. 607's drive 86/86 and 608's 88/88 still pass.
Typecheck, lint and vitest green.

**Shared pieces:** `core/insurance-rules/templates.ts` (GuardTemplate, TemplateBlank, path helpers `parsePath` /
`valueAt`, `fillTemplate`, `missingBlanks`, `blankCandidates`, `blankKind`, `BLANK_WORDS`, `GUARD_TEMPLATES_KEY`),
`core/insurance-rules/BlankLabel.tsx` (words under `insurance-rules:template.blank.*`), `folders.ts`
(`folderTree(rows, kept)`, `childPath`, `renamedPath`, `folderPaths`, `folderNameProblem`). Guards feature:
`guardFoldersApi` + `guardFoldersQuery` in `guards/api.ts`, `FolderActions.tsx` under the tree, `OrganizeCard.tsx` on
the rule page. New feature `features/insurance-rules/templates/` at `/insurance-rules/templates`, ns
`insurance-templates`. Stubs `// --- 609 ---`: `TEMPLATES`, `EMPTY_FOLDERS`, `newTemplatesState()` (on 608's guard
store), `templatesStub` (GET Guards rows from the stateful draft; falls through to `guardEditorStub`).

**Guesses where the brief is silent (618 reconciles):**
- `GET …/Templates` → `[{ id, source: phase1|team, name {en,ar}, conflictCode, rule, blanks: [{ path, label? }],
  createdBy?, createdAt? }]`; a template's `rule` holds each blank's default (a number) or an empty value.
- A blank `path` is the rule's JSON path in the Validate `blockPath` grammar (`when[0].conditions[2].windowDays`).
- `POST …/Templates` body `{ ruleId, name {en,ar}, blanks: [path] }` → the template. HQ (the stub) empties a ticked
  text / list / message blank and keeps a ticked number as its default; a team blank has no label (named by its key
  + path).
- `POST …/Templates/{id}/Create` body `{ values: { [path]: value }, folder }` → the created draft `GuardRule`; HQ
  mints the id and adds it to the draft (revision + 1). The client opens the editor on it.
- `GET …/Folders` → `string[]` of every path (an empty one too); `POST` `{ path }`; `PUT` `{ from, to }` renames a
  folder (rules and sub-folders follow) or `{ rules: [id], to }` moves rules; each answers the paths. A taken path
  is a 409 `FOLDER_EXISTS` (spelling guessed). Moving / renaming bumps the draft revision, so an editor open on
  another tab would meet a stale save.
- Move and Save as template live on the rule page (not the editor's side column, which 611/612 are changing, and a
  move while the editor holds unsaved edits would stale its save). No bulk move from the grid.
- The fill dialog's folder box offers the draft rules' folders (the Folders door is the Guards feature's).
- Phase-1 messages for the reference templates (SFDA pack, PA, age, indication) are not in 3093; written in the stub.
- The insurance team's walk of the prototype (BackOffice 3096) is still open; nothing amended this ticket.
