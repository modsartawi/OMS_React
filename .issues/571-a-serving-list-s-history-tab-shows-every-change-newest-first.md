---
status: done
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

- [x] change row view: each action's label; a rename's before → after; a create's names; a list-level row has no store;
      an unknown action renders raw (vitest)
- [x] drive script, LTR and RTL, against a stub serving Changes (every action, an Arabic note): store filter finds one
      store's add and removal; "Show more" asks for a larger `take`
- [x] `npm run typecheck`, `npm run lint`, `npm test` green

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

## Comments

### Built (2026-10-25, stubbed)

- `HistoryTab.tsx` (the 568 seam): `GET ServingListWeb/Lists/{id}/Changes?take=` through `changesQuery(id, take)`,
  keyed `[...SERVING_LIST_CHANGES_KEY, id, take]` with `SERVING_LIST_CHANGES_KEY = ['oms','serving-lists','changes']`
  in `api.ts` — a write on a list invalidates `[...SERVING_LIST_CHANGES_KEY, id]`. Grid (`history-columns.tsx`):
  when, who, action in words, store, names, note; client paging at 50; grid-xlsx export
  (`serving-list-history-*.xlsx`, store and who written as text). `SVL-00001` → "does not exist", bare 403 →
  "You do not have access", as the Members tab.
- Pure `change-row.ts` (action key or raw, store blank on Create / Rename / Deactivate / Reactivate, create /
  rename names) and `history-filter.ts` (action + store filter, action options, `take` 200 → +200 → 1000,
  `canShowMore`). Locale keys under `history.*`, EN + AR (six Arabic plurals).
- Proof: vitest `change-row.test.ts`, `history-filter.test.ts`, `history-i18n.test.ts`; `npm test` 6346 green;
  typecheck + lint green; `tools/serving-list-history-drive.mjs` **61/61 stubbed**, LTR + RTL. 568's members
  drive check 9 now looks for `[data-history-tab]` instead of the placeholder (102/102); 567's drive 49/49.
- Decisions (overrulable):
  - the filters are local state, not in the URL, and apply as typed (the rows are already read);
  - the store filter is an exact, case-insensitive code match (P019 does not catch P0190), not a substring;
  - the action filter offers the eight actions plus any unlisted action the rows carry (raw);
  - Show more steps `take` by 200 and goes when a read comes back short; at 1000 a line says only the newest
    1000 can be shown;
  - names read as words ("From EN (AR) to EN (AR)", "Named EN (AR)"), each name its own `<bdi>`, not an arrow;
  - action labels are past-tense phrases ("Store removed", "Renamed").
- **Review fixes (2026-10-25, branch ticket/3042-review):** denied / not-found cards come from the shared
  `StateCards.tsx` with neutral `notFound.*` keys (no longer borrowing `members.notFound*`); the unused
  `HistoryTabProps.list` is gone.
