---
status: open
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

- [ ] `fillTemplate_blanksBecomeRuleValues` — pure
- [ ] drive (stubbed) — refill template → draft; save as template; move to folder

## Boundaries

— Rules: `feature-structure`, `i18n-zero-literal`, `logical-tailwind`, `api-envelope`, `bidi` (patient keys and codes `Ltr`, Arabic text `<bdi>`). Local time only.

## Done when

Gates green; drive passes.

## Blocked by

[608](608-an-author-edits-a-guard-from-a-palette-with-nested-all-of-any-of-groups-and-not-severity-e.md)

## Open questions

- **Layout follows the insurance team's walk** of the prototype (https://claude.ai/code/artifact/5qwrpEcu9o6ThdwsQphb4y, BackOffice map ticket 3096, still open). Reactions recorded there before this is built amend this ticket.
