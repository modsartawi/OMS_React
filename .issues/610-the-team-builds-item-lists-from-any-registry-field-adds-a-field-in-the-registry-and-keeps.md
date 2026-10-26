---
status: open
spec: BO 3126 (brief C:\Work\DMSCO\BackOffice\.issues\assets\3126-oms-react-insurance-rules-brief.md)
blocked-by: 607
---

# 610 — The team builds item lists from any registry field, adds a field in the registry, and keeps patient and policy lists

## What to build

**Item lists**: filters on registry fields (any of / none of, codes shown with their descriptions),
included and excluded lists (3 deep), a preview of matched items, the "matches no item" warning. **Fields**: the
registry page — add a field from a source, EN + AR label, type / unit; retire (never delete); visible to the
master-data grant. **Patient lists** and **policy lists**: entries with added-by, reason, optional expiry, and the
change log.

**HQ contract:** the brief's sections for BackOffice 3132, BackOffice 3133. Build against those shapes, stubbed in the drive; a shape the
BackOffice ticket changes is recorded in the brief and reconciled in the live-doors ticket.

Reference look: [Insurance Rules Builder](https://claude.ai/code/artifact/5qwrpEcu9o6ThdwsQphb4y)
(`C:\Work\DMSCO\BackOffice\.scratch\proto\3096-insurance-rules\index.html`).

## Spine reach

components · logic · test

## Proof (→ `tdd` red-green cycles)

- [ ] `listCycle_isRefusedBeforeSave` — pure
- [ ] drive (stubbed) — GLP-1 list from ECode values; add an ItemInfo field; add a VIP entry

## Boundaries

— Rules: `feature-structure`, `i18n-zero-literal`, `logical-tailwind`, `api-envelope`, `bidi` (patient keys and codes `Ltr`, Arabic text `<bdi>`). Local time only.

## Done when

Gates green; drive passes.

## Blocked by

[607](607-the-insurance-rules-area-lists-guard-rules-by-folder-with-their-flags-and-opens-a-rule-rea.md)

## Open questions

- **Layout follows the insurance team's walk** of the prototype (https://claude.ai/code/artifact/5qwrpEcu9o6ThdwsQphb4y, BackOffice map ticket 3096, still open). Reactions recorded there before this is built amend this ticket.
