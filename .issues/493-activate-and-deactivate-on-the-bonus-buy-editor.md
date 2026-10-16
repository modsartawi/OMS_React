---
status: done
spec: —
blocked-by: —
---

# 493 — Activate and Deactivate on the bonus buy editor

**Source:** grilled 2026-10-15 (no spec). An owner correcting a live bonus buy (the source sent 1+1 when
it meant 50% on the 2nd piece) had to go editor → overview → editor → overview: Back to Planned and
Mark Tested are in the editor, but Activate and Deactivate only exist on the promotion overview. The
rule stays (only a Planned bonus buy can change, ADR 0063; the test gate stays for a source correction
too). Only the act moves: a second place to press it.

## What to build

- The editor toolbar offers the status acts the open bonus buy's status allows:

  | Status | Toolbar offers |
  |---|---|
  | Planned | Save · Mark Tested (unchanged) |
  | Tested | **Activate** · Back to Planned |
  | Deactivated | **Activate** · Back to Planned |
  | Activated | **Deactivate** · Back to Planned |

- OMS bonus buys only, never SAP; in Display and Change alike (status acts, not edits — as Mark Tested
  and Back to Planned already are). Never on Create, unreadable status never offers Activate.
- **Both ask first.** Activate: the bonus buy goes live at every till. Deactivate: it stops pricing at
  every till.
- **Activate is held while the form has unsaved changes** (as Mark Tested is), with the same kind of hint.
- Calls the existing `BbyMaintainWeb/BonusBuy/Activate` / `Deactivate { bbyNumber }` — no new door.
- On `done` the editor reloads the bonus buy so status, toolbar and lock hint update; the outcome shows
  in the editor's `ActReport`. A `refused` shows the server's refusals; the client never guesses.

## Spine reach

UI (editor toolbar, confirm) · pure (`editorAccess`) · API client (existing)

## Proof (→ `tdd` red-green cycles)

- [x] `editorAccess offers Activate on a Tested or Deactivated OMS bonus buy and Deactivate on an Activated one` · vitest
- [x] `neither is offered on Planned, SAP, Create or an unreadable status` · vitest
- [x] drive: Tested → Activate asks, then the editor shows Activated with Deactivate offered · stubbed

## Boundaries

Client only. Overview acts unchanged.

## Done when

The owner takes a live bonus buy Back to Planned, edits it, saves, marks it Tested and activates it,
all without leaving the editor.

- [ ] **OWNER, outstanding:** the walk above, on a SIS.Api carrying `BbyMaintainWeb` (doors already shipped).

## Blocked by

—

## Comments

**Built 2026-10-15.** `editorAccess` gains `canActivate` (Tested/Deactivated) and `canDeactivate` (Activated),
OMS only, both modes, never Create/SAP/unreadable. `BonusBuyEditorPage` adds `flip(act)`: confirm first,
then the existing `statusAct` (refusal shown, re-read on done). Activate held while unsaved (moot in practice:
a non-Planned form is a disabled fieldset). i18n `activate.*` / `deactivate.*`. Glossary: Mark Tested's
four-eyes clause removed to match the 2026-10-07 owner ruling. Proof: vitest 5145 green (3 new), typecheck,
lint (4 gates), build clean; `tools/bby-maintenance-drive.mjs` 210/210 **stubbed** (new block 45–47, stub
moves status only while `flipMoves` is on so step 6 is untouched).

**Live finding 2026-10-15 (owner on 172.23.27.111:8099).** Deactivated OMS000001139 showed the SAP hint and no
Back to Planned. Cause: since BackOffice 2398 the server's `readOnly` is `!OmsBonusBuyNumber.IsMatch(number) ||
IsLocked(status)` (`BbyMaintainWebService.cs:597`), i.e. SAP **or** a non-Planned OMS bonus buy; the client read it
as "SAP" (`editorAccess`, model comment). So 419's Back to Planned had never shown live on any non-Planned OMS bonus
buy, and this ticket's Activate/Deactivate would not have either. Both drives stubbed the OLD meaning, so they passed.
- Owner ruling: SAP-ness from the number, `^OMS[0-9]{9}$`, the server's own regex (no BackOffice change).
  `readOnly` on an OMS bonus buy now only locks. Model comment corrected. 3 new vitest; the drive's read stub now
  sends `readOnly` on non-Planned OMS bonus buys as the live server does. vitest 5148, lint, build, drive 210/210.
- Owner asked to unblock now: OMS000001139 was taken Back to Planned by a direct `POST BonusBuy/BackToPlanned
  { bbyNumber }` from the owner's session → `saved`; re-read `bbyStatus: "1"`, `readOnly: false`, test mark cleared.
- The deployed frontend needs this rebuild before the toolbar acts appear on any non-Planned OMS bonus buy.
