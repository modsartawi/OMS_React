---
status: done
spec: BackOffice 3185 (brief C:\Work\DMSCO\BackOffice\.issues\assets\3157-oms-react-idf-brief.md, section "Spec 3185")
blocked-by: —
---

# 643 — A master's page lists the items of its live version, or of any old one

## What to build

Today a master's ranking cannot be seen. An **Items** section on the master page
(`/insurance-rules/idf/masters/:masterId`), doors BackOffice 3187
([brief](C:\Work\DMSCO\BackOffice\.issues\assets\3157-oms-react-idf-brief.md), "Spec 3185"):

- a paged table of the live version: item, description (reader's language), IDF group, priority;
- a group filter and an item search (number or description), kept in the URL;
- a version picker fed by the existing Versions section: choosing an old version shows its items, clearly marked as
  not live;
- an empty state for a master with no live version yet.

## Spine reach

model/api (`…/versions/{versionId}/entries`) · logic (query params) · component (MasterPage section) · i18n (EN+AR) ·
test + drive

## Proof (→ `tdd` red-green cycles)

- [x] `entries query keeps search, group and page, and resets page on a new filter` · pure
- [x] drive `tools/idf-items-drive.mjs` — the live version's items show, filter and page; picking an old version shows
  its ranking marked not live (LTR + RTL) · flow

## Boundaries

New endpoint stubbed in `tools/idf-stubs.mjs`. Keys in `insurance-idf`. Item numbers and groups are machine values
(`Ltr`); descriptions free text (`<bdi>`).

## Done when

Against stubs, the master page shows any version's items with filter, search and paging, proofs green.

## Blocked by

None (can start immediately).

## Done 2026-10-28

- Pure: `items.ts` + `items.test.ts` (9 green — the proof is the `entries query keeps search, group and page, and
  resets page on a new filter` describe), door shape in `doors.test.ts` (643), keys in `i18n-keys.test.ts` (643).
- Drive: `tools/idf-items-drive.mjs` 60/60 (LTR + RTL) against stubs (`// --- 643 ---` in `tools/idf-stubs.mjs`);
  `idf-upload-drive` 96/96 and `idf-masters-drive` 86/86 still green.
- Shared seam for 645/647/648: `ItemsTable.tsx` takes `page, error, query, onQuery(updater), busy, mark?, actions?,
  removed?`; `items.ts` holds `IdfEntryRow`, `IdfEntriesPage`, `IdfItemsQuery`, `read/writeItemsQuery`,
  `withItemsFilter`, `typedItemsFilter`, `itemsDoorParams`. Slot comments for 644–653 laid in `api.ts` and
  `idf-stubs.mjs`.
- Settled myself (overrulable): the door is sent `page` always and no `pageSize` (the server's default; the stub's
  is 25); the group filter is a typed box (no groups door until 652); the picked live version leaves the address
  (`?version` only for an old one); switching version keeps the search and group and goes to page 1.
