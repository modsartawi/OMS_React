---
status: open
spec: BO 3126 (brief C:\Work\DMSCO\BackOffice\.issues\assets\3126-oms-react-insurance-rules-brief.md)
blocked-by: 608
---

# 612 — An author simulates a draft on a patient and reads the back-test report

## What to build

**Simulator**: type a request (lines, channel, payer, policy, class, store) and a patient key; see per-line
outcomes and the condition trace with true / false / unknown. **Back-test**: pick 30 / 90 / 180 days, start the job,
follow progress, read fires by severity, the requests it would have stopped (patient key masked), SAR, distinct
patients / stores / pharmacists, and overlap with live guards.

**HQ contract:** the brief's sections for BackOffice 3140. Build against those shapes, stubbed in the drive; a shape the
BackOffice ticket changes is recorded in the brief and reconciled in the live-doors ticket.

Reference look: [Insurance Rules Builder](https://claude.ai/code/artifact/91vLtKjq47zeaDritTwyJS)
(`C:\Work\DMSCO\BackOffice\.scratch\proto\3096-insurance-rules\index.html`).

## Spine reach

components · test

## Proof (→ `tdd` red-green cycles)

- [ ] drive (stubbed) — simulate G-007 on a stub patient; read a back-test

## Boundaries

— Rules: `feature-structure`, `i18n-zero-literal`, `logical-tailwind`, `api-envelope`, `bidi` (patient keys and codes `Ltr`, Arabic text `<bdi>`). Local time only.

## Done when

Gates green; drive passes.

## Blocked by

[608](608-an-author-edits-a-guard-from-a-palette-with-nested-all-of-any-of-groups-and-not-severity-e.md)

## Open questions

- **Layout follows the insurance team's walk** of the prototype (https://claude.ai/code/artifact/91vLtKjq47zeaDritTwyJS, BackOffice map ticket 3096, still open). Reactions recorded there before this is built amend this ticket.
