---
status: open
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

- [ ] `rulesetRoundTrip` — a guard document read into the editors' rules and printed back is the same document; a
      rule `guard-wire` cannot read stays JSON-only and is kept byte-for-byte — pure
- [ ] `errorAtBlock` — `rules[0].when[1].expr` maps to rule 0, condition path [1], field `expr`; a path into nothing
      shown maps to none — pure
- [ ] drive: add a second rule, move it first, and the JSON follows; change the JSON, and the editor follows; a
      stubbed reader error shows on its block — flow

## Boundaries

No new door. Uses `GET InsuranceRules/Fields` and keyed lists only as the guard editors already do. No new namespace.

## Done when

A guard ruleset is built and reordered with the real editors, the JSON stays in step both ways, and a reader error
lands on its block. Drive and vitest are green.

## Blocked by

[676](676-the-guard-coverage-and-category-block-editors-live-in-core-and-every-insurance-rules-screen-stays-green.md),
[678](678-the-outcome-refreshes-shortly-after-an-edit-a-stale-reply-is-dropped-and-kind-and-as-of-pick-what-runs.md)
