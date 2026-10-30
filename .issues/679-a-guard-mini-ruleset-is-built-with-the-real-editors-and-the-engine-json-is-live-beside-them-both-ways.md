---
status: done
spec: BO 3243 (brief C:\Work\DMSCO\BackOffice\.issues\assets\3243-oms-react-rule-playground-brief.md; stories 24-27, 29, 34)
blocked-by: 676, 678
---

# 679 — A guard mini-ruleset is built with the real editors, and the engine JSON is live beside them both ways

## What to build

The Rule pane of a **guard** experiment stops being only a JSON box.

- **A mini ruleset:** 1..n guard rules in order. Add, remove, move up and down. Each rule is edited with core's real
  condition, audience and effect editors (moved by 676), exactly as on the guard rule screen.
- **The engine JSON is live beside the editors.** A click in an editor rewrites the JSON. Editing the JSON (once it
  parses) makes the editors follow. The wire codec is `core/insurance-rules/guard-wire`, the same one the guard
  screen saves through. A rule whose JSON the editors cannot show (a shape `guard-wire` does not read back) stays
  **JSON-only**, with a note saying so. It still runs.
- **The sentence view** (`GuardSentenceView`) under each rule.
- **Reader errors pointed at the block.** An `errors[]` path such as `rules[0].when[1].expr` is shown on that block,
  using the same marking the guard editor uses for its checks (`blockKey`/`fieldIssues`). An error whose path matches
  no shown block stays in the outcome's error list.

Auto-run (678) keeps working on every edit.

## Spine reach

store/logic (document ⇄ editor rules, error path → block key) · component (Rule pane) · i18n · test

## Proof (→ `tdd` red-green cycles)

- [x] `rulesetRoundTrip` — a guard document read into the editors' rules and printed back is the same document; a
      rule `guard-wire` cannot read stays JSON-only and is kept byte-for-byte — pure
- [x] `errorAtBlock` — `rules[0].when[1].expr` maps to rule 0, condition path [1], field `expr`; a path into nothing
      shown maps to none — pure
- [x] drive: add a second rule, move it first, and the JSON follows; change the JSON, and the editor follows; a
      stubbed reader error shows on its block — flow

## Boundaries

No new door. Uses `GET InsuranceRules/Fields` and keyed lists only as the guard editors already do. No new namespace.

## Done when

A guard ruleset is built and reordered with the real editors, the JSON stays in step both ways, and a reader error
lands on its block. Drive and vitest are green.

## Blocked by

[676](676-the-guard-coverage-and-category-block-editors-live-in-core-and-every-insurance-rules-screen-stays-green.md),
[678](678-the-outcome-refreshes-shortly-after-an-edit-a-stale-reply-is-dropped-and-kind-and-as-of-pick-what-runs.md)

## Comments

- 2026-10-30 (679 built, branch `impl/3243-679`). vitest `ruleset.test.ts` (9: round trip, JSON-only byte-for-byte,
  undrawable blocks, edit spelling, unreadable docs, errorAtBlock ×3, rulesetIssues) + `i18n-keys.test.ts` (+1).
  Drive `tools/insurance-playground-drive.mjs` 168/168 (LTR + RTL; steps 13–20 new). No stub change: 677's stub
  already refuses any non-`line` block at `rules[i].when[j].check`, which the drive uses as the error on a block.
  typecheck, lint, test, build green.
- **Layout for 680:** `playground/ruleset.ts` is kind-agnostic — a kind is one `RuleCodec { in, out, blank, drawable }`
  in `CODECS` (only `guard` today; `hasEditors(kind)`). `readRuleset(kind, text)` → slots `{ key, editable, raw, read,
  rule }`; `printRuleset` prints an untouched or JSON-only slot as its `raw`, an edited one through `out` minus the
  defaults the reader filled (an absent `name`/`folder`/`state` stays absent). `errorAtBlock(path, slots)` /
  `rulesetIssues(errors, slots)` walk `when`/`then` of any kind; `editorField` maps the engine field to the editors'
  (`expr`→`formula`, `under`→`below`, a fact's bound→`value`). `RulePane.tsx` holds the pane; `GuardRuleEditors` is the
  guard-only part 680 swaps per kind. `JsonPane` gained a `before` slot (drawn above the box).
- **Decisions (overrulable):** a rule is editable only when every block is one the guard palette draws and every
  effect is `effect: "guard"`, AND `guard-wire` reads it back unchanged — otherwise JSON-only with a note. While the
  JSON does not parse, the editors keep the last good rules, disabled (`fieldset disabled`) with a note. The editors
  show WHEN / IF / THEN (no name inputs, no onUnknown radios — those stay in the JSON, so the controls ratchet is
  unchanged). A new rule is `{ id: G-NNN, name, onUnknown, when: [], then: [newGuardRule's effect] }`. Errors placed on
  a block leave the outcome list; the outcome says how many ("Shown on their block in the Rule pane: n"); an error
  whose path names no shown block (a JSON-only rule, `lists[…]`, a missing block) stays in the list. Errors are
  placed only when the answer was asked for the current kind, against the current text.
- **Shape guess for 691:** reader error paths read as `rules[i].when[j](.conditions[k])*.<field>` /
  `rules[i].then[j].<field>` / `rules[i](.<field>)` — the 3139 `blockPath` grammar under a `rules[i]` prefix.
- **Review fixes (3243-review):** a guard rule's `name` (EN / AR, core `Field` + `Input`) and `onUnknown` (core `Select`,
  the guard screen's own `insurance-guards:editor.onUnknown.*` words) are edited in the Rule pane; no control-ratchet
  line. The JSON follows both ways (round-trip tests + drive step 15b); `onUnknown` set back to `none` on a rule that
  had none adds no default. The playground's plain-object guard, storage type and refusal banner are now one each
  (`core/util/plain-object`, `core/util/storage-like`, `playground/RefusalBanner`); `playground/experiment.ts` is now
  `playground/boxes.ts`.
