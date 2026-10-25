---
status: done
spec: C:\Work\DMSCO\BackOffice\.issues\3042-serving-lists-and-store-duty-for-callouts-spec.md
blocked-by: 568 (live: BackOffice 3045 deployed)
---

# 569 — An editor adds stores to a serving list from a store picker, many at once

## What to build

**The add-stores picker**, for BackOffice spec 3042 (stories 31, 41). The contract is the spec's `## Comments` →
"oms-react hand-off (2026-10-25)". Onboarding a contract's ~500 stores must not take 500 single clicks.

- **Entry:** an "Add stores" button on the Members tab (568), shown only when `canEditServingLists`.
- **Search door:** `GET ServingListWeb/Stores?search=&servingListId=&take=` (Display 03).
  - `search` matches inside the code, the name or the city, case-insensitively. The text is literal.
  - `take` defaults to 50 and is at most 200.
  - Debounce the search. Pass the list's id, so each row says `onList`.
  - Rows: code, name, city, `closed`. A store already on the list is shown checked-off and cannot be picked. A closed
    store can be picked but is marked: it is never bid while it is closed.
- **Batch:** pick across several searches into a basket (shown as a count, which can be cleared), and **paste codes**
  (one per line, or comma-separated) straight into the basket for a contract sheet. An optional note.
- **Add door:** `POST ServingListWeb/Lists/{id}/Stores` `{ storeCodes[], note? }` (Execute 06). It answers the list's
  row, then refetch Members and Lists.
- **Refusals stay in the dialog.** One bad code refuses the **whole batch**, and nothing is added:
  - `SVL-00002`: unknown code(s). `ApiError.data.badStoreCodes` lists them. Highlight them in the basket, with a "Remove
    these and retry" action.
  - `SVL-00003`: already on the list, the same way. The door checks unknown codes first, so a basket with both kinds
    takes two rounds.
  - `SVL-00008`: empty basket. Block it client-side too.
  - `SVL-00001`: the list is gone.

## Spine reach

api · logic (basket: add / remove / paste-parse / de-dup; refusal → highlighted codes) · dialog · i18n EN + AR · test

## Proof (→ `tdd` red-green cycles)

- [x] basket: pasted text splits on newlines / commas / spaces, trims, de-dups case-insensitively; `onList` rows cannot
      be added (vitest)
- [x] refusal map: `SVL-00002` / `SVL-00003` with `data.badStoreCodes` mark exactly those codes; a `data` missing or of
      the wrong shape falls back to the message (vitest)
- [x] drive script, LTR and RTL, against a stub serving Stores (by code, by name, by city, closed, onList) and the add
      door (ok, `SVL-00002` with 2 codes, `SVL-00003`): the dialog is hidden without Execute
- [x] `npm run typecheck`, `npm run lint`, `npm test` green

## Boundaries

- Door: BackOffice 3045 + the review's store-picker door (`fee0e6773`), on branch `spec3042`, stubbed until deployed.
- The store master has a single name (`Store.Description`). There is no Arabic store name to show.

## Done when

The Proof boxes are ticked: on the running app (stubbed), an Execute holder searches by code, name and city, pastes a
column of codes, and adds them in one call, and a bad code is pointed out rather than half-added.

## Blocked by

- [568](568-a-serving-list-s-members-show-their-duty-today-filtered-by-city-enabled-and-duty.md)

## Open questions

- A closed store can be added (BackOffice 3045 HITL). If the owner rules that it is refused, the door gains a code and
  this dialog only maps it.

## Comments

### Built (2026-10-25, stubbed)

- Seam `MembersToolbar.tsx`: "Add stores" (primary) shown only when `canEditServingLists` **and** the list's row is
  known; it mounts `AddStoresDialog.tsx` only while open, so every open starts with an empty basket.
- `AddStoresDialog.tsx`: debounced (250 ms) `GET ServingListWeb/Stores?search=&servingListId=&take=50` (own key
  `['oms','serving-lists','stores', id, search]`); hits are checkbox rows (code, name, city), `onList` checked off and
  disabled, `closed` marked with a warn badge + "never bid while closed" tooltip but pickable; "Pick all shown"; a
  paste box (one per line / commas / spaces) with "Added: n. Already in it: m."; the basket as chips with a count,
  per-chip remove and Clear; an optional note (500, counter). One `POST …/Stores` per confirm; on success a toast
  names the count and the list, and `[...SERVING_LIST_MEMBERS_KEY, id]`, `SERVING_LISTS_KEY` and the picker's key are
  invalidated.
- Pure `basket.ts` (paste-parse over `normaliseCodeList` + case-insensitive de-dup keeping the first spelling,
  toggle / pick-all / remove / body) and `add-stores-refusal.ts` (`badCodes` for SVL-00002/03 with a readable
  `data.badStoreCodes`, else `refused` by code with the server text, `notGranted` on a bare 403, `failed`).
  Bad codes are highlighted in the basket case-insensitively; "Remove these and retry" drops them and re-sends.
- Locale keys under one new top-level `addStores` (EN + AR, six Arabic plurals for `basket.count` and `done`).
- Proof: vitest `basket.test.ts` (13), `add-stores-refusal.test.ts` (13), `add-stores-i18n.test.ts`; `npm test` 6347
  green; typecheck + lint green; `tools/serving-list-add-stores-drive.mjs` **80/80 stubbed**, LTR + RTL (the stub add
  door behaves as 3045: unknown first, then members, so the drive walks SVL-00002 → SVL-00003 → added).
- Decisions (overrulable):
  - the button hides while the list's row is unknown (a missing id is the Members door's SVL-00001, nothing to add to);
  - a blank search shows the door's first 50 stores at once (the door allows it), with a "narrow the search" line when
    a page comes back full;
  - "Pick all shown" was added beyond the ticket (cheap help for a contract's 500 stores);
  - a pasted code is not checked against `onList` client-side (only search hits know it); the door's SVL-00003 names it;
  - picking a picked hit again takes it back out; confirm stays enabled after a refusal (re-sends the same basket);
  - the SVL-00001 refusal also re-reads the Lists query.
