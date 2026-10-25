---
status: done
spec: C:\Work\DMSCO\BackOffice\.issues\3042-serving-lists-and-store-duty-for-callouts-spec.md
blocked-by: 567 (live: BackOffice 3045, 3046 deployed)
---

# 568 — A serving list's members show their duty today, filtered by city, enabled state and duty

## What to build

**The list detail**, for BackOffice spec 3042 (stories 37, 38). The contract is the spec's `## Comments` →
"oms-react hand-off (2026-10-25)".

- **Route** `/oms/serving-lists/:servingListId`. The header shows the names (EN + AR), Active / Deactivated, the member
  counts and the pointing types, taken from the list's `ServingListRow`. It has tabs **Members** (this ticket) and
  **History** (571).
- **Door:** `GET ServingListWeb/Lists/{id}/Members?city=&enabled=&duty=` (Display 03). Unknown id → `SVL-00001`, which
  shows "This serving list does not exist" in place of the grid.
- **Members grid** (AG Grid): store code, store name, city, store closed, enabled on the list, added at / by, updated
  at / by, and the **duty column**:
  - `OnDuty`: "On duty now", plus today's hours;
  - `OffDuty`: "Off duty now", plus today's hours, or "Closed today" when `todayShifts` is empty;
  - `NoRoster`: "No roster". Style it as a warning, because a duty-checking type never bids this store. This is the
    pilot's check before `CalloutDutyCheck` goes on.

  Today's hours come from `todayShifts`, as `open–close` local `HH:mm`. An `overnight` shift shows its close as the next
  morning.
- **Filters**, kept in the URL and sent to the door, and combinable: city (free text), enabled (any / enabled /
  disabled) and duty (any / the three states). Never send an unlisted duty value, because the door refuses it with
  `SVL-00009`.
- The duty column is read-only: the roster is edited elsewhere. A deactivated list still lists its members. The header
  says the list's deliveries are not competed.
- Per-row actions (570) and the add-stores picker (569) hang off this grid but are not built here.

## Spine reach

api · logic (duty cell view, filter ⇄ URL ⇄ query) · route + page · i18n EN + AR · test

## Proof (→ `tdd` red-green cycles)

- [x] duty cell: each state's label; hours from `todayShifts` (one, two, overnight, empty → "Closed today"); an
      unknown state still renders (vitest)
- [x] filters: URL → query and back; blanks are omitted; the duty filter only offers the three states (vitest)
- [x] drive script, LTR and RTL, against a stub serving Members (every duty state, a closed store, a disabled member,
      an overnight shift) and an unknown-list `SVL-00001`
- [x] `npm run typecheck`, `npm run lint`, `npm test` green

## Boundaries

- Doors: BackOffice 3045 / 3046, built on branch `spec3042`, stubbed until deployed (SQL + grant as in 567).
- The door has no paging. A 500-store list is one read: use the grid's client-side paging.
- No roster editing.

## Done when

The Proof boxes are ticked: on the running app (stubbed), a View holder opens a list, filters its members by city,
enabled state and duty, and sees which stores have no roster.

## Blocked by

- [567](567-the-business-team-sees-every-serving-list-and-the-types-pointing-at-it.md)

## Open questions

- BackOffice 3046 reads a store whose valid roster has no row for today's weekday as `OffDuty` with no shifts, not
  `NoRoster` (HITL, owner not yet ruled). Show it as "Closed today" either way.

## Comments

### Built (2026-10-25, stubbed)

- Route `oms/serving-lists/:servingListId` → `ServingListPage.tsx` (ScreenGate on `canViewServingLists`; `canEdit` from
  the same cached probe). Header `ListHeader.tsx` from the Lists read's row (no single-list door); tabs `ListTabs.tsx`
  with `?tab=` (`tab.ts`; Members default writes no key); `MembersTab.tsx` (filters via `useUrlQuery` +
  `members-filter.ts`, grid `member-columns.tsx`, client paging at 50); duty view `duty-cell.ts`. The pointing-type
  chips moved from 567's `columns.tsx` into `PointingChips.tsx`, shared by the grid cell and the header.
- `api.ts`: `SERVING_LIST_MEMBERS_KEY = ['oms','serving-lists','members']`, `membersQuery(id, filter)` keyed
  `[...SERVING_LIST_MEMBERS_KEY, id, filter]` — a write invalidates `[...SERVING_LIST_MEMBERS_KEY, id]`.
- **Seams for the parallel slices** (each a file the slice replaces, so none of them edits the page or the tab):
  - 570 header actions → `HeaderActions.tsx` (`{ list, canEdit }`, rendered at the end of the header's title row);
  - 569 toolbar → `MembersToolbar.tsx` (`{ servingListId, list, canEdit }`, at the end of the Members filter bar);
  - 570 per-row actions → `MemberActions.tsx` exports `MemberActionsCell` (now `null`; a renderer adds a pinned-end
    `actions` column); it gets the row as `p.data` and `MembersGridContext { servingListId, list, canEdit }` as
    `p.context`;
  - 571 → `HistoryTab.tsx` (`{ servingListId, list }`, a placeholder mounted on `?tab=history`).
- Proof: vitest `duty-cell.test.ts`, `members-filter.test.ts`, `tab.test.ts`, `i18n-keys.test.ts` (en/ar mirror, six
  Arabic plurals); `npm test` 6310 green; typecheck + lint green; `tools/serving-list-members-drive.mjs` **102/102
  stubbed**, LTR + RTL; 567's drive still 49/49.
- Decisions (overrulable):
  - an overnight shift reads `18:00–02:00` + the word "next morning" (a locale key), not `(+1)`;
  - duty sorts worst first (No roster, unknown, Closed today, Off duty, On duty); No roster carries a hint tooltip;
  - NoRoster ignores any shifts the door sends (there should be none);
  - an id missing from the Lists read still renders the tabs (header shows the id alone), so the Members door's
    `SVL-00001` is what says "This serving list does not exist";
  - filters apply on Apply / Enter (the Dispatch board's draft pattern), not on each change; a no-match reads its own
    sentence apart from an empty list.
