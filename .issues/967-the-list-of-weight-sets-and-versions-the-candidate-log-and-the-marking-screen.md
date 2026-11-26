---
status: open
spec: BackOffice 4354
blocked-by: 963, BO 4360, BO 4395
---

# 967 — The list of weight sets and versions, the candidate log and the marking screen

Spec: BackOffice `.issues/4354-the-sourcing-advisor-plans-an-orders-shipments-and-comparison-runs-judge-it-before-anything-obeys-spec.md` (the sourcing advisor spec; sections 11, 17 and 19 for the screens).

## What to build

- Start with a quick prototype shown to the owner (HITL); the spec gives the content and not the look.
- The list of sets and versions: owner, note, what differs between two versions, a retired set shown as retired, which version is the candidate set.
- The candidate log: who, when, the version before and after, the reason, the trial's number and its figures.
- The marking screen, under the marking grant: the plans changed against the candidate set, the orders refused, the promise check per mode under the new version, every shelf chance figure that differs with "enough", "too few" or "not steady", and a written reason that must speak to each "too few" or "not steady". A refusal shows its reason.

## Spine reach

oms-react: pages / models / locales / tests

## Proof (→ `tdd` red-green cycles)

- [ ] `version-diff-model.test.ts` — what differs between two versions · vitest (`npm test`)
- [ ] `marking-model.test.ts` — the figures shown, and the reason required per "too few" or "not steady" · vitest (`npm test`)
- [ ] `tools/sourcing-sets-drive.mjs` — list, compare two versions, try to mark without a trial and read the refusal · Playwright drive, run by hand against stubs

## Boundaries

HITL prototype first.

## Done when

The owner has seen the prototype; the model tests are green and the drive passes.

## Blocked by

[963](963-pins-and-the-weight-set-panel-pin-from-a-plan-change-values-on-a-draft-save-as-a-named-set.md),
BackOffice 4360 (`.issues/4360-weight-sets-are-saved-as-numbered-versions-a-draft-runs-unsaved-and-the-candidate-set-is-marked.md`),
BackOffice 4395 (`.issues/4395-a-marking-is-refused-without-a-recent-clean-trial-and-the-candidate-log-keeps-the-trials-figures.md`)
