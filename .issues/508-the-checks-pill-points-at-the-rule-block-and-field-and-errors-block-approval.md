---
status: open
spec: BO 2737 (brief C:\Work\DMSCO\BackOffice\.issues\assets\2737-oms-react-rule-engine-brief.md)
blocked-by: 505
---

# 508 — The checks pill points at the rule, block and field, and errors block approval

## What to build

The builder's header carries a **checks pill** ("2 errors · 1 warning", or "All checks pass"). HQ validates the
draft on save (BackOffice 2758), and each message points at **rule → condition/effect → field**. Opening the pill lists them, and
clicking one expands the rule, opens the block's panel and focuses the field, where the message also shows.
**Errors block "Ask for approval"** (511 reads the same state), and warnings don't.

## Spine reach

model/api (`validate`) · logic (message → location, blocking verdict) · component (pill, field marks) · i18n · test

## Proof (→ `tdd` red-green cycles)

- [ ] `checks_locateEachMessage_atRuleBlockField_byIds` · pure
- [ ] `checks_errorsBlockApproval_warningsDoNot` · pure
- [ ] drive: a stubbed error → pill → click → the field is focused with its message (stubbed) · flow

## Boundaries

Provisional validate endpoint (BackOffice 2758), stubbed. HQ's message text is passed through as data inside `<bdi>`, with the
labels around it from i18n.

## Done when

The drive jumps from the pill to the exact field, and the approval verdict follows errors only.

## Blocked by

[505](505-a-marketer-adds-and-edits-blocks-from-a-palette-with-undo-redo-cancel-save.md)
