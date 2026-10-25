---
status: open
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

- [ ] basket: pasted text splits on newlines / commas / spaces, trims, de-dups case-insensitively; `onList` rows cannot
      be added (vitest)
- [ ] refusal map: `SVL-00002` / `SVL-00003` with `data.badStoreCodes` mark exactly those codes; a `data` missing or of
      the wrong shape falls back to the message (vitest)
- [ ] drive script, LTR and RTL, against a stub serving Stores (by code, by name, by city, closed, onList) and the add
      door (ok, `SVL-00002` with 2 codes, `SVL-00003`): the dialog is hidden without Execute
- [ ] `npm run typecheck`, `npm run lint`, `npm test` green

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
