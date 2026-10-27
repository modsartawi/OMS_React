---
status: done
spec: BO 3126 (brief C:\Work\DMSCO\BackOffice\.issues\assets\3126-oms-react-insurance-rules-brief.md)
blocked-by: 607
---

# 608 — An author edits a guard from a palette, with nested All of / Any of groups and NOT, severity, EN and AR message, codes and suggestion, and checks that point at the block

## What to build

The guard editor: blocks from a palette (history, supply, volume, line, reference, patient / request
conditions, formula), **All of / Any of groups nested up to 3 levels** with a NOT toggle per condition (a 4th level
cannot be added), typed fields with units, severity, EN + AR message with placeholder chips (no `{lastStore}`),
codes shown as defaulted from the block and editable, an optional suggestion, `onUnknown`. Undo / Redo / Cancel /
Save the draft whole; the checks pill shows HQ's Validate errors at rule / block / field.

**HQ contract:** the brief's sections for BackOffice 3130, BackOffice 3131. Build against those shapes, stubbed in the drive; a shape the
BackOffice ticket changes is recorded in the brief and reconciled in the live-doors ticket.

Reference look: [Insurance Rules Builder](https://claude.ai/code/artifact/91vLtKjq47zeaDritTwyJS)
(`C:\Work\DMSCO\BackOffice\.scratch\proto\3096-insurance-rules\index.html`).

## Spine reach

logic (pure editor reducer, group depth) · components · i18n · test

## Proof (→ `tdd` red-green cycles)

- [x] `groupDepth_refusesAFourthLevel` — pure
- [x] `defaultCodes_followTheFirstBlock_untilEdited` — pure
- [x] drive (stubbed) — build G-007 from the palette and save

## Boundaries

Stubbed Validate per the brief. Rules: `feature-structure`, `i18n-zero-literal`, `logical-tailwind`, `api-envelope`, `bidi` (patient keys and codes `Ltr`, Arabic text `<bdi>`). Local time only.

## Done when

Gates green; the drive builds G-007.

## Blocked by

[607](607-the-insurance-rules-area-lists-guard-rules-by-folder-with-their-flags-and-opens-a-rule-rea.md)

## Open questions

- **Layout follows the insurance team's walk** of the prototype (https://claude.ai/code/artifact/91vLtKjq47zeaDritTwyJS, BackOffice map ticket 3096, still open). Reactions recorded there before this is built amend this ticket.

## Comments

**2026-10-27 — built on `impl/3126-608`.** Proof: `src/core/insurance-rules/guard-edit.test.ts`
(groupDepth_refusesAFourthLevel, defaultCodes_followTheFirstBlock_untilEdited, reference blocks default too),
`editor-history.test.ts` (undo / redo / cancel / save whole; a re-read keeps an unsaved edit), `checks.test.ts` (block
path, issues at rule / block / field); drive `tools/insurance-guard-editor-drive.mjs` 88/88 STUBBED (LTR + RTL): builds
G-007 from the palette under a new id, the PUT's conditions, filter, name, onUnknown and THEN deep-equal G-007's. 607's
drive still 86/86. Typecheck, lint and vitest green.

**For 609 / 611 / 612 / 617 — shared pieces in core:**
- `core/insurance-rules/guard-edit.ts` — path-based pure edits (`addCondition` / `updateCondition` / `removeCondition` /
  `toggleNot`, `canAddGroup`, `MAX_GROUP_LEVELS = 3`), `PALETTE`, `newCondition`, `FACTS` / `LINE_FIELDS`, codes
  (`blockCodes`, `defaultCodes`, `editRule` / `editGuard` keep codes following the first block), `withListFilter`,
  `nextGuardId`, `newGuardRule`, placeholders (`GUARD_PLACEHOLDERS`, `refusedPlaceholders`, `insertPlaceholder`),
  `SUGGESTIONS`.
- `core/insurance-rules/editor-history.ts` — generic undo / redo / cancel / saved / load over ONE draft document.
- `core/insurance-rules/checks.ts` — `GuardIssue`, `parseBlockPath`, `indexChecks`, `fieldIssues`, `checksVerdict`
  (611's "errors block, warnings never do").
- `core/insurance-rules/api.ts` — `saveGuardDraft`, `validateGuardDraft`, and `rulesetDraftDoors(kind)` for
  `Guards` / `Categories` / `Coverage` (617), `STALE_REVISION`.
- Model: `FactCondition` (`check: 'fact'`, `$`-path + op + value) and `FormulaCondition` (`check: 'formula'`), with
  their sentences. Paths: `guardEditPath`, `GUARD_NEW_PATH`.
- Stubs `// --- 608 ---`: `newGuardStore()`, `validateGuards(doc)`, `guardEditorStub(method, path, body, { store })` —
  call it first and fall through to `insuranceRulesStub`.

**Guesses where the brief is silent (618 reconciles):**
- `PUT InsuranceRules/Guards/Draft` takes the whole document with the `revision` it was read at and answers the saved
  document with its new revision; a stale one is 409 with code `STALE_REVISION` (spelling guessed; also read by status).
- `POST InsuranceRules/Guards/Validate` takes the draft document as on screen and answers
  `[{ ruleId, blockPath, field, severity: 'error' | 'warning', en, ar }]`; `blockPath` is the rule's JSON path
  (`when[0].conditions[2]`, `then[0]`), null/empty = the rule; an unknown severity blocks.
- The patient / request block is `check: 'fact'` with provisional `$`-paths (`$patient.age`, `$line.icd`,
  `$request.payer`, …); the formula block is `check: 'formula'` holding the expression text.
- A new rule's id is minted client-side (`G-` + highest + 1, three digits) — the brief has no minting door.
- A new rule starts on every channel, every store, no window, one OVERRIDE effect with empty messages and no codes.
- Codes table per block is 3093's (`blockCodes`); a block not in it defaults no codes.
- Supply "consumed below" is typed as a percent and stored as a fraction (0.75).
- Layout follows the prototype; the insurance team's walk (BackOffice 3096) has not amended it yet.

**Follow-up after 610 lands (not yet on spec/3126-insurance-rules when 608 merged):** 610 adds
`core/insurance-rules/registry.ts` + `registry-api.ts` (Fields, field values, patient / policy lists) and narrows
`GuardListAttribute` to exactly one of `anyOf` / `noneOf`. 608's editor names patient / policy lists by a typed id
(`CodeInput`) and its `FACTS` / `LINE_FIELDS` are local constants; once 610 is in, the patient / policy pickers and
the fact list should read the registry instead (whoever merges 610 after 608, or 617 / 618).

**2026-10-27 — the 610 follow-up is done in 617** (`impl/3126-617`): the palette's facts, the line block's numbers and
"after" day, and the patient / policy list pickers now read 610's registry (`core/insurance-rules/registry-facts.ts`,
`fieldsQuery`, `keyedListsQuery`); `FACTS` / `LINE_FIELDS` / `factOf` are removed from `guard-edit.ts`;
`guardSentence` takes the registry fields as an optional third argument. This drive serves 610's stubs and picks the
lists from a select (88/88). Detail on ticket 617.


**2026-10-27 — 3126 review (P3, P4).** The editor now sets the rule's WHEN (`guards/AudienceEditor.tsx`): channels,
stores (none = every store), patient / policy lists left out of the audience, and the window; `newGuardRule` only
seeds the defaults. The `supply` block edits `eligibleDaysBeforeDueFor` (a list's own days, the SFDA 7 for controlled
drugs; read as "7 days for Controlled drugs"); the `history` block narrows to the same payer / policy / channel /
store (read as "counting only dispenses with the same payer and store"). Pure edits in `guard-edit.ts`
(`toggleNarrow`, `addDaysFor` / `setDaysFor` / `removeDaysFor`, `toggleChannel`, `setAudienceStores`,
`toggleAudienceExclude`, `setWindow`), proven by `core/insurance-rules/rule-scope.test.ts`.
**Guesses (618 reconciles):** history narrowing spelled `narrowTo: ('payer'|'policy'|'channel'|'store')[]` (absent =
estate-wide); audience exclusions spelled `audience.excludePatientLists` / `audience.excludePolicyLists` (ids of
610's lists); a per-list refill value names a RULESET list id directly (no rule filter alias); a new per-list row
starts at 7 days.
