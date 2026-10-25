---
status: done
spec: C:\Work\DMSCO\BackOffice\.issues\3042-serving-lists-and-store-duty-for-callouts-spec.md
blocked-by: — (live: BackOffice 3045 deployed)
---

# 567 — The business team sees every serving list and the delivery types pointing at it

## What to build

**The Serving lists screen's first slice**, for BackOffice spec 3042. A serving list is a named list of the stores that
may be bid for a delivery type's competed deliveries; several types may share one. The brief is the spec's
`## Comments` → "oms-react hand-off (2026-10-25)", which is the contract read from the merged code. Words: serving
list, member, enabled / disabled (a member), active / deactivated (a list), on duty, no roster, pointing type
(BackOffice `CONTEXT.md` § Serving list). The screen never says "zone" or "branch group".

- **Model** `core/models/serving-list.ts`. Field for field from BackOffice
  `Sartawi.Retail.Data\Modules\Callouts\ServingLists\ServingListAdminModels.cs`, and every type the later slices need
  goes here:
  - `ServingListRow`, `ServingListPointingType`, `ServingListMemberRow` + `ServingListMemberShift`,
    `ServingListChangeRow`, `ServingListStoreRow`;
  - the five request bodies;
  - `SERVING_LIST_DUTY_STATES` (`OnDuty | OffDuty | NoRoster`);
  - `SERVING_LIST_CHANGE_ACTIONS`;
  - `SERVING_LIST_ERRORS` `SVL-00001..09`.

  Use string unions plus `string`, so an unlisted value still parses.
- **Feature** `features/oms/serving-lists/`, with its own i18n namespace (EN + AR) and `api.ts` for every
  `ServingListWeb/*` door listed in the hand-off. This slice only calls:
  - `GET ServingListWeb/Lists` (Display 03);
  - `GET ServingListWeb/Access` → `{ canViewServingLists, canEditServingLists }` (the cookie-only probe).
- **Page** `/oms/serving-lists`: an AG Grid of lists with these columns:
  - English and Arabic name;
  - Active / Deactivated;
  - members (`enabledMemberCount` of `memberCount`);
  - pointing types, as chips: `documentType`, with `description` as the tooltip, and competed types marked;
  - updated at / by.

  A row opens the list detail (568). A list with competed pointing types and no enabled member is flagged, because its
  deliveries record `ServingListInactive`.
- **Gate:** the menu leaf (OMS group, beside the Dispatch board) and a `ScreenGate` share the one `canViewServingLists`
  predicate, and both fail closed. A bare 403 reads "You do not have access", never an empty grid.

## Spine reach

model · api · logic (row view: members label, competed-pointing flag, empty-list warning) · route + menu + gate + page ·
i18n EN + AR · test

## Proof (→ `tdd` red-green cycles)

- [x] row view: the members label; competed vs non-competed chips; the flag on an active list with competed pointers
      and no enabled member; an unknown action / duty value still parses (vitest)
- [x] drive script, LTR and RTL, against a stub serving Lists (active, deactivated, shared by three types, empty),
      Access (both flags, and neither) and a bare 403
- [x] `npm run typecheck`, `npm run lint`, `npm test` green

## Boundaries

- Doors: BackOffice 3045 (`ServingListWebEndpoints`), built on branch `spec3042`. Stub them until they are deployed
  with the owner's SQL and grant:
  - SQL: `Modules/Callouts/Sql/002`, `003` and `004`, and `Modules/Sd/Sql/058` and `059`;
  - grant: `Seed-ServingList-Screen-Authorization.sql`, with holders bound by hand.
- Pointing a type at a list is an HQ script, not a door. The grid shows pointing types read-only.
- No delete of a list (there is no door).

## Done when

The Proof boxes are ticked: on the running app (stubbed), a View holder sees every list with its members and the types
it governs, and a non-holder never sees the screen.

## Blocked by

— (live: BackOffice 3045 deployed)

## Open questions

—

## Comments

### Built (2026-10-25, stubbed)

- Model `src/core/models/serving-list.ts` (every type 568-571 need, plus `ServingListAccess`, `ServingListMembersFilter`,
  `ServingListStoreSearch`, `ServingListBatchRefusal`, `isServingListDutyState` / `isServingListChangeAction`).
- Probe `src/core/serving-list/access.ts` — `SERVING_LIST_ACCESS_KEY`, `servingListAccessQuery()`, `canViewServingLists`,
  `canEditServingLists`, `servingListAccessApi`. In `core/` so the Dispatch board (572) can link to
  `/oms/serving-lists/:id` behind the same predicate.
- Feature `src/features/oms/serving-lists/`: `api.ts` (every `ServingListWeb/*` door; 567 calls `lists()` only),
  `list-view.ts` (members label, chips, flag), `columns.tsx`, `ServingListsPage.tsx`. Namespace `serving-lists` EN + AR.
- Proof: vitest `list-view.test.ts` + `access.test.ts` + menu leaf tests (6281 total green); typecheck + lint green;
  `tools/serving-lists-drive.mjs` **49/49 stubbed**, LTR + RTL.
- Decisions (overrulable): the flag also marks a **deactivated** list a competed type still points at
  (`deactivatedCompeted`, same `ServingListInactive` outcome), and an empty list with no competed pointer gets a
  quiet "No members" badge. The row click navigates to `/oms/serving-lists/:id`, which 568 routes.

- **Review fixes (2026-10-25, branch ticket/3042-review):** the Lists read's denial check is now `isBareDenial`
  (a coded 403 business refusal shows its message instead of "no access"; drive check 8); the denied card is the
  shared `StateCards.tsx`; the row click uses `servingListHref` from `core/serving-list/view`.
