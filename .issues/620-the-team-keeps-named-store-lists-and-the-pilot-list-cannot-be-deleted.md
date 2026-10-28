---
status: done
spec: BackOffice 3157 (brief C:\Work\DMSCO\BackOffice\.issues\assets\3157-oms-react-idf-brief.md)
blocked-by: 619
---

# 620 — The team keeps named store lists, adds and removes their stores, and the pilot list is marked and cannot be deleted

## What to build

A leaf **IDF store lists** at `/insurance-rules/idf/store-lists` (doors from BackOffice 3162,
[brief](C:\Work\DMSCO\BackOffice\.issues\assets\3157-oms-react-idf-brief.md)):

- the named store lists (operation pharmacies, the pilot rollout list) with their store count;
- create a list and rename it (`POST`, `PUT …/{id}`);
- open a list and add or remove stores, saved as the whole set (`PUT …/{id}/stores { storeCodes }`);
- the list flagged `isPilotList` carries a "Pilot" mark and offers no delete.

A refusal (`success:false`) shows its message and code through `apiErrorMessage`.

## Spine reach

model/api · logic (store-set edit) · component/route · i18n (EN+AR) · test + drive

## Proof (→ `tdd` red-green cycles)

- [x] `store set edit adds, removes and de-duplicates store codes` — the set sent equals the visible set · pure
- [x] drive `tools/idf-store-lists-drive.mjs` — create, rename, add/remove stores, the pilot list has no delete, a refusal shows its message · flow

## Boundaries

New endpoints `IdfPriority/store-lists` (GET/POST/PUT, `…/stores`) — stubbed. Keys in `insurance-idf`. Ungated until
628. Store codes and counts are machine values.

## Done when

Store lists can be created, renamed and edited against stubs, the pilot list cannot be deleted, proofs green.

## Blocked by

[619](619-the-idf-masters-list-shows-each-masters-kind-scope-live-version-and-thresholds.md)

## Comments

**2026-10-27 — built (impl/3157-620).** `store-lists.ts` (type `IdfStoreList` + `parseStoreCodes` / `addStores` /
`removeStore` / `storeSetBody`), `idfStoreListsApi` + `storeListsQuery` under 620's slot in `idf/api.ts`
(`IDF_STORE_LISTS_KEY`), `StoreListsPage.tsx` at `/insurance-rules/idf/store-lists`, menu leaf
`menu.idfStoreLists` (icon `Store`), keys under `storeLists` (EN + AR), `idfStoreListsStub` in
`tools/idf-stubs.mjs`. Proof: `store-lists.test.ts` 2/2, own `it` in `i18n-keys.test.ts`; drive
`tools/idf-store-lists-drive.mjs` 58/58 STUBBED (LTR + RTL), masters drive still 38/38; typecheck, test (6938), lint
green.

Decisions (overrulable; 628 reconciles against BackOffice 3162):
- **GET row shape assumed** `{ storeListId, name, isPilotList, storeCodes[] }` — ONE `name` (not `nameEn`/`nameAr`),
  the store count is `storeCodes.length`. The brief sketched no row shape.
- **`DELETE IdfPriority/store-lists/{id}` assumed** (the brief only says the pilot list "cannot be deleted"); offered
  on every non-pilot list after a confirm. Stub refuses the pilot list `PILOT_LIST`, a taken name `NAME_TAKEN`.
- **Store codes are typed**, split on commas / semicolons / whitespace, upper-cased, de-duplicated, order kept; no
  store picker or store-existence check on the client (the server should refuse an unknown code).
- **Refusals show inline** above the lists (message via `apiErrorMessage` + "Code X" in `Ltr`), cleared by the next
  success; a bare 403 on a write reads "You do not have access". Successes toast.
- Stub state is `state.storeLists`, made lazily so `newIdfState` stays 619's. 621's store-list picker can read
  `storeListsQuery()` (and could show the name where 619 shows the id).
- **Review fixes (2026-10-27):** the stores editor's dirty check compares sets (`sameStoreSet`, order-insensitive),
  so removing a store and adding it back is not an edit; after a save the editor re-seeds from the server's
  `storeCodes` (its order and spelling). Pure test + drive check (62/62).
