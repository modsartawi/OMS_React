---
status: done
spec: BackOffice 3173 (brief C:\Work\DMSCO\BackOffice\.issues\assets\3173-oms-react-loyalty-groups-brief.md)
blocked-by: 629
---

# 636 — Bonus-buy maintenance picks loyalty groups from the defined groups, and the server's unknown-group refusal and inactive-group warning are listed against the field

## What to build

In the bonus-buy editor's engine rules, the free-text **Loyalty groups** field becomes a **multi-select of
defined groups** (options from `LoyGroupWeb/Groups?includeInactive=true`): code + name in the active locale,
inactive groups greyed and marked. The selection is encoded as the comma-separated upper-case code string the
wire already carries (`loyGroups`), so the save body is unchanged in shape.

Decision D2: a code already on the bonus-buy that is not a defined group (authored before the picker) is
kept as a flagged **unknown** chip, not silently dropped — the server's new refusal names it on save.

Save and check-only runs: the new **unknown group** refusal and **inactive group** warning (BackOffice 3179,
EN/AR) are listed against the "Loyalty groups" field like the other 2342/2377 findings.

Without the view-groups grant the field falls back to **read-only text** of the current codes.

🚩 The picker is shared with simulation (637), so it is built in core: a generic `core/ui` multi-select
(none exists — `features/materials/search/FilterPicker` is feature-local) and `core/loy-groups/LoyGroupPicker`
over it. Inquiry and download keep showing codes.

## Spine reach

model/api (core groups list, already from 629) · logic (selection ⇄ comma string, unknown codes) · component (core multi-select + picker, editor field) · i18n (`loy-groups` for the picker, `bonus-buy-maintenance` keys for the field) · test

## Proof (→ `tdd` red-green cycles)

- [x] `picker selection round-trips the comma code list` — `'GOLD,STAFF_X'` with STAFF_X undefined → GOLD selected + STAFF_X unknown → back to the same string; order normalised as `normaliseEngineList` does · pure
- [x] `editor save body carries the picked groups as one comma string` — extends `editor.test.ts` · pure
- [x] `bby maintenance loyalty-group picker drive` — inactive greyed, unknown chip, refusal + warning listed on the field, read-only without grant · flow

## Boundaries

Doors: groups list (3174, stubbed), save findings (3179, stubbed). New `core/ui` control → check the
control ratchet (`tools/control-baseline.txt`) for `pricing/bonus-buy-maintenance` drops, not grows.

## Done when

On stubs, the editor picks groups, keeps unknown codes, lists the new refusal/warning on the field, falls back without the grant, and the gates are green.

## Blocked by

[629](629-the-loyalty-groups-list-shows-each-groups-code-name-active-flag-mobile-count-and-live-bonus-buys.md)

## Comments

- 2026-10-28 — Done — built 2026-10-28 on spec/3173-loyalty-groups (worktree C:\Playground\oms-react-spec3173, unpushed), all envelopes stubbed; commit 9575d536.
- 2026-10-28 — Finding codes reconciled to the shipped `BBY-LOYGROUP-UNKNOWN` / `BBY-LOYGROUP-INACTIVE` (7a89f957); 3179 raises them on a save only.
- 2026-10-28 — Review fix 9c27d39c (OWNER DECISION, overrulable): read-only text only when the probe ANSWERS `canView:false`; pending / errored / 404 keeps the editable free-text field, so shipping before 3174 does not lock the field.
- 2026-10-28 — Owner: duplicates collapse (`GOLD,GOLD` → `GOLD`); the client meter caps 500 while `BbyMaintainWidths.LoyGroups` is 300 (pre-existing).
