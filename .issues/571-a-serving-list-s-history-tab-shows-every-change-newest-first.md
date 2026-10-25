---
status: open
spec: C:\Work\DMSCO\BackOffice\.issues\3042-serving-lists-and-store-duty-for-callouts-spec.md
blocked-by: 568 (live: BackOffice 3045 deployed)
---

# 571 — A serving list's History tab shows every change, newest first

## What to build

**The History tab** on the list detail (568), for BackOffice spec 3042 (stories 39, 40). The contract is the spec's
`## Comments` → "oms-react hand-off (2026-10-25)".

- **Door:** `GET ServingListWeb/Lists/{id}/Changes?take=` (Display 03). Rows come newest first. `take` defaults to 200,
  at most 1000; offer a "Show more" that raises `take` (there is no cursor).
- **Grid:** when (`changedAt`), who (`changedBy`), the action as words, the store (blank for list-level actions) and the
  note. A `Create` or `Rename` row shows the names: `oldNameEn/Ar → newNameEn/Ar` on a rename, `newNameEn/Ar` on a
  create.
- **Action labels** (EN + AR) for `Create | Rename | Deactivate | Reactivate | AddStore | RemoveStore | EnableStore |
  DisableStore`. An unlisted action still renders its raw value.
- **Filters**, client-side: action and store code ("who took store X off, and when").
- `grid-xlsx` export of the grid.

## Spine reach

api · logic (action labels, rename / create text) · tab · i18n EN + AR · test

## Proof (→ `tdd` red-green cycles)

- [ ] change row view: each action's label; a rename's before → after; a create's names; a list-level row has no store;
      an unknown action renders raw (vitest)
- [ ] drive script, LTR and RTL, against a stub serving Changes (every action, an Arabic note): store filter finds one
      store's add and removal; "Show more" asks for a larger `take`
- [ ] `npm run typecheck`, `npm run lint`, `npm test` green

## Boundaries

- Door: BackOffice 3045, on branch `spec3042`, stubbed until deployed.
- The log is append-only and read-only. There is no undo from the history.

## Done when

The Proof boxes are ticked: on the running app (stubbed), a View holder reads who changed a list, what changed, and
when, newest first.

## Blocked by

- [568](568-a-serving-list-s-members-show-their-duty-today-filtered-by-city-enabled-and-duty.md)

## Open questions

—
