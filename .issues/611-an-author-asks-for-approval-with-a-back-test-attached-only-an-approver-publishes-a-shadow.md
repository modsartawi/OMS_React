---
status: open
spec: BO 3126 (brief C:\Work\DMSCO\BackOffice\.issues\assets\3126-oms-react-insurance-rules-brief.md)
blocked-by: 608
---

# 611 — An author asks for approval with a back-test attached, only an approver publishes, a shadow rule is promoted, and a version restores as a draft

## What to build

The approval panel by role: an author **asks for approval** (disabled until a back-test of the current
revision exists); an approver approves or sends back. A shadow rule shows its shadow figures and days in shadow;
the approver **promotes** it (or skips shadow with a reason). **Versions**: who, when, note; restore as a new draft.

**HQ contract:** the brief's sections for BackOffice 3139, BackOffice 3140. Build against those shapes, stubbed in the drive; a shape the
BackOffice ticket changes is recorded in the brief and reconciled in the live-doors ticket.

Reference look: [Insurance Rules Builder](https://claude.ai/code/artifact/91vLtKjq47zeaDritTwyJS)
(`C:\Work\DMSCO\BackOffice\.scratch\proto\3096-insurance-rules\index.html`).

## Spine reach

logic (pure actionsFor / gates) · components · test

## Proof (→ `tdd` red-green cycles)

- [ ] `actionsFor_roleStateAndBacktest` — pure
- [ ] `promoteGate_14DaysOrReason` — pure, local days
- [ ] drive (stubbed)

## Boundaries

— Rules: `feature-structure`, `i18n-zero-literal`, `logical-tailwind`, `api-envelope`, `bidi` (patient keys and codes `Ltr`, Arabic text `<bdi>`). Local time only.

## Done when

Gates green; drive passes.

## Blocked by

[608](608-an-author-edits-a-guard-from-a-palette-with-nested-all-of-any-of-groups-and-not-severity-e.md)

## Open questions

- **Layout follows the insurance team's walk** of the prototype (https://claude.ai/code/artifact/91vLtKjq47zeaDritTwyJS, BackOffice map ticket 3096, still open). Reactions recorded there before this is built amend this ticket.
