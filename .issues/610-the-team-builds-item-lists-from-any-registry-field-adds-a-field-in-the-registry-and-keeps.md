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
master-data grant. **Patient lists**, **policy lists** and **class lists**: entries with added-by, reason, optional
expiry, and the change log. A class list is a third tab beside the other two: an entry is a policy class code
(upper case, up to 29 characters, no `|`) and an optional insurer (its SAP customer id, shown with its name; blank =
any insurer), and the list shows which entries are for one insurer and which are for any.

**HQ contract:** the brief's sections for BackOffice 3132, BackOffice 3133, BackOffice 3172 (class lists: `InsuranceRules/ClassLists`, the same doors as patient / policy lists with `payer` on entries). Build against those shapes, stubbed in the drive; a shape the
BackOffice ticket changes is recorded in the brief and reconciled in the live-doors ticket.

Reference look: [Insurance Rules Builder](https://claude.ai/code/artifact/91vLtKjq47zeaDritTwyJS)
(`C:\Work\DMSCO\BackOffice\.scratch\proto\3096-insurance-rules\index.html`).

## Spine reach

components · logic · test

## Proof (→ `tdd` red-green cycles)

- [ ] `listCycle_isRefusedBeforeSave` — pure
- [ ] drive (stubbed) — GLP-1 list from ECode values; add an ItemInfo field; add a VIP entry; add a class entry for one
  insurer and one for any insurer, then expire one

## Boundaries

— Rules: `feature-structure`, `i18n-zero-literal`, `logical-tailwind`, `api-envelope`, `bidi` (patient keys and codes `Ltr`, Arabic text `<bdi>`). Local time only.

## Done when

Gates green; drive passes.

## Blocked by

[607](607-the-insurance-rules-area-lists-guard-rules-by-folder-with-their-flags-and-opens-a-rule-rea.md)

## Open questions

- **Layout follows the insurance team's walk** of the prototype (https://claude.ai/code/artifact/91vLtKjq47zeaDritTwyJS, BackOffice map ticket 3096, still open). Reactions recorded there before this is built amend this ticket.
