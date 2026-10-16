---
status: done
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

- [x] `restoreGuard_asksWhenADraftHasWork` · pure — `src/features/campaigns/workspace/versions.test.ts` (13 tests: the guard, `restoreHeld`, `versionMark`, `newestFirst`)
- [x] drive: versions list → restore v2 → the dashboard shows a draft, live version unchanged (stubbed) · flow — `tools/campaigns-drive.mjs` §512 checks 90–99, whole drive 450/450 on :5199, every door stubbed

## Boundaries

Provisional versions / restore endpoints (BackOffice 2759), stubbed.

## Done when

The drive restores an earlier version as a draft.

## Blocked by

[501](501-a-marketer-sees-the-campaigns-list-by-state-and-opens-a-campaigns-dashboard.md)

## Outcome (2026-10-16)

- Versions page at `/campaigns/:id/versions` (a new **Versions** item in the campaign's menu). It lists versions newest first with number, who, when (local) and note. The live one is marked; a disabled campaign's last version reads "Last published, disabled". **View rules** opens a version read-only as sentences, with its EN + AR lines.
- **Restore as draft** calls `POST …/Versions/{n}/Restore`. HQ answers the campaign as a draft; the live version is untouched and the dashboard says which version tills still run. Over a `draft`, it asks first ("Replace the draft?"). It is held while a request waits, and on a disabled campaign, with the reason shown. A refusal shows the envelope's message and code.
- An Activate now re-reads the versions list (`rememberTransition`, only when the live version moved).
- Gates: typecheck, `npm test` 5397, lint (4 gates), build — all green.
- Decisions are in `.afk/HITL-512.md` (status-based "draft has work", context for an opened version, holds on waiting and disabled, no role gate).
- **Outstanding (not AFK):** live doors (ticket 520 / BackOffice 2759), and the owner's sign-off on the decisions above.
