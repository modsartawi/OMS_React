---
status: done
spec: BackOffice 3173 (brief C:\Work\DMSCO\BackOffice\.issues\assets\3173-oms-react-loyalty-groups-brief.md)
blocked-by: 629
---

# 635 — The member screen shows the member's active groups as chips, and only for users allowed to view groups

## What to build

On the existing member lookup (`features/loy/member`), the `LoyWeb/*` member response gains
`groups: string[]` (active codes, sorted). Under the view-groups grant, the member header shows them as
chips, each named from the core groups list (`@/core/loy-groups`; a code missing from the list shows as
its code). 🚩 **Absent or `[]` without the grant means "not shown", never "in no group"** — the chips row
appears only when the caller holds view and the field is present; present-and-empty under the grant says
"in no group".

## Spine reach

model (`LoyMember.groups?` in `core/models/loy.ts`) · logic (chips-or-hidden decision, code → name) · component (header chips via `core/ui/Chip`) · i18n (keys in `loy`, EN-only as today) · test

## Proof (→ `tdd` red-green cycles)

- [x] `member group chips: absent hides, empty under grant says none, codes resolve to names` · pure
- [x] `loy member drive shows group chips under the grant only` · flow (extend the member drive)

## Boundaries

Field from BackOffice 3176 (stubbed). Touches `features/loy/member` + `core/models/loy.ts`; consumes
`core/loy-groups` only (no import of `features/loy/groups`). Arabic names shown as stored.

## Done when

On stubs, the member header shows the group chips with the grant and nothing without it, and the gates are green.

## Blocked by

[629](629-the-loyalty-groups-list-shows-each-groups-code-name-active-flag-mobile-count-and-live-bonus-buys.md)

## Comments

- 2026-10-28 — Done — built 2026-10-28 on spec/3173-loyalty-groups (worktree C:\Playground\oms-react-spec3173, unpushed), all envelopes stubbed; commit 802c8225.
- 2026-10-28 — Owner: chips are `StatusBadge`, not `core/ui/Chip` (Chip is a toggle, aria-pressed); names come from the list incl. inactive; chip tooltip shows the code; codes match case-insensitively (review fix).
