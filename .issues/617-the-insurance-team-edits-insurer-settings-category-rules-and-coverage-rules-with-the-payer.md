---
status: open
spec: BO 3126 (brief C:\Work\DMSCO\BackOffice\.issues\assets\3126-oms-react-insurance-rules-brief.md)
blocked-by: 608
---

# 617 — The insurance team edits insurer settings, category rules and coverage rules, with the payer-override mark shown

## What to build

**Insurer settings** per insurer with the change log. **Category rules**: an ordered list (first match wins)
setting Generic / Brand / NonMed. **Coverage rules**: covered, prior approval, deductible % + max, price cap,
quantity cap, segment — each value marked filled vs **overrides payer**. Eligibility facts appear in the palette.

**HQ contract:** the brief's sections for BackOffice 3144, BackOffice 3145, BackOffice 3146. Build against those shapes, stubbed in the drive; a shape the
BackOffice ticket changes is recorded in the brief and reconciled in the live-doors ticket.

Reference look: [Insurance Rules Builder](https://claude.ai/code/artifact/91vLtKjq47zeaDritTwyJS)
(`C:\Work\DMSCO\BackOffice\.scratch\proto\3096-insurance-rules\index.html`).

## Spine reach

components · test

## Proof (→ `tdd` red-green cycles)

- [ ] drive (stubbed) — K-001 and "no deductible for these policies"

## Boundaries

— Rules: `feature-structure`, `i18n-zero-literal`, `logical-tailwind`, `api-envelope`, `bidi` (patient keys and codes `Ltr`, Arabic text `<bdi>`). Local time only.

## Done when

Gates green; drive passes.

## Blocked by

[608](608-an-author-edits-a-guard-from-a-palette-with-nested-all-of-any-of-groups-and-not-severity-e.md)

## Open questions

- **Layout follows the insurance team's walk** of the prototype (https://claude.ai/code/artifact/91vLtKjq47zeaDritTwyJS, BackOffice map ticket 3096, still open). Reactions recorded there before this is built amend this ticket.
