---
status: open
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

Reference look: [Insurance Rules Builder](https://claude.ai/code/artifact/5qwrpEcu9o6ThdwsQphb4y)
(`C:\Work\DMSCO\BackOffice\.scratch\proto\3096-insurance-rules\index.html`).

## Spine reach

logic (pure editor reducer, group depth) · components · i18n · test

## Proof (→ `tdd` red-green cycles)

- [ ] `groupDepth_refusesAFourthLevel` — pure
- [ ] `defaultCodes_followTheFirstBlock_untilEdited` — pure
- [ ] drive (stubbed) — build G-007 from the palette and save

## Boundaries

Stubbed Validate per the brief. Rules: `feature-structure`, `i18n-zero-literal`, `logical-tailwind`, `api-envelope`, `bidi` (patient keys and codes `Ltr`, Arabic text `<bdi>`). Local time only.

## Done when

Gates green; the drive builds G-007.

## Blocked by

[607](607-the-insurance-rules-area-lists-guard-rules-by-folder-with-their-flags-and-opens-a-rule-rea.md)

## Open questions

- **Layout follows the insurance team's walk** of the prototype (https://claude.ai/code/artifact/5qwrpEcu9o6ThdwsQphb4y, BackOffice map ticket 3096, still open). Reactions recorded there before this is built amend this ticket.
