---
status: open
spec: BO 3271 (brief C:\Work\DMSCO\BackOffice\.issues\assets\3271-oms-react-fhir-insurance-rules-brief.md)
blocked-by: 702, 705, 706
---

# 708 — A labels-only re-pin shows text before and after, and labels and package items reach the review list

## What to build

Stories 24, 61, 64; D9, L5, L9; doors 3295, 3296, 3297. Three connected pieces:

- A **labels-only re-pin draft**, on 705's list: the rule's text before and after, no back-test, a separate approver.
- A **labels-changed** review item and badge on the published ruleset, opening that draft.
- An **upload-due** review item, opening the upload (706), and a **package** review item showing the IG diff: profiles,
  extensions and CodeSystems added, removed or renamed.

**Decision (overrulable):** the package item is added here. Door 3295 raises it, but the brief's review row does not list
it, so it would otherwise have no screen.

## Spine reach

model/api (draft kind, item kinds, IG diff) · store/logic (before / after pairs) · component (draft, rows, badge) ·
i18n (en + ar) · test (pure + drive)

## Proof (→ `tdd` red-green cycles)

- [ ] the before / after pairs, and no back-test demanded for this draft kind — pure
- [ ] labels-changed item → draft → approve as another user; upload-due item → upload; package item → diff — flow

## Boundaries

The builder shows the latest labels, and a published ruleset's text stays pinned until its draft is approved. Doors
stubbed; 711 reconciles.

## Done when

Better wording reaches a published rule only through an approved draft, and the team learns when a Nphies release needs
attention.

## Blocked by

702, 705, 706.

## Comments
