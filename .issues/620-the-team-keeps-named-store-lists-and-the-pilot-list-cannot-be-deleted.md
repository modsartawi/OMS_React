---
status: open
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

- [ ] `store set edit adds, removes and de-duplicates store codes` — the set sent equals the visible set · pure
- [ ] drive `tools/idf-store-lists-drive.mjs` — create, rename, add/remove stores, the pilot list has no delete, a refusal shows its message · flow

## Boundaries

New endpoints `IdfPriority/store-lists` (GET/POST/PUT, `…/stores`) — stubbed. Keys in `insurance-idf`. Ungated until
628. Store codes and counts are machine values.

## Done when

Store lists can be created, renamed and edited against stubs, the pilot list cannot be deleted, proofs green.

## Blocked by

[619](619-the-idf-masters-list-shows-each-masters-kind-scope-live-version-and-thresholds.md)
