---
status: open
spec: BO 2737 (brief C:\Work\DMSCO\BackOffice\.issues\assets\2737-oms-react-rule-engine-brief.md)
blocked-by: 501
---

# 512 — Versions list who, when and the note, and restore one as a new draft

## What to build

The workspace's **Versions** page lists each published version, newest first, with its number, **who**, **when** (local)
and **note**, and marks the live one. A version can be opened read-only, as its rules in sentences (or its JSON when
504 has not landed). **Restore** makes that version the campaign's **new draft**, never an in-place rollback, and asks
first when a draft with unsaved work exists.

## Spine reach

model/api (versions, restore) · logic (live marker, restore guard) · component (page) · i18n · test

## Proof (→ `tdd` red-green cycles)

- [ ] `restoreGuard_asksWhenADraftHasWork` · pure
- [ ] drive: versions list → restore v2 → the dashboard shows a draft, live version unchanged (stubbed) · flow

## Boundaries

Provisional versions / restore endpoints (BackOffice 2759), stubbed.

## Done when

The drive restores an earlier version as a draft.

## Blocked by

[501](501-a-marketer-sees-the-campaigns-list-by-state-and-opens-a-campaigns-dashboard.md)
