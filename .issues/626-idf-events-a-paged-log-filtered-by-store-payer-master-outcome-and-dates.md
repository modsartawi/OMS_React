---
status: done
spec: BackOffice 3157 (brief C:\Work\DMSCO\BackOffice\.issues\assets\3157-oms-react-idf-brief.md)
blocked-by: 619
---

# 626 — IDF events: a paged log filtered by store, payer, master, outcome and dates

## What to build

A leaf **IDF events** at `/insurance-rules/idf/events` (door 3167,
[brief](C:\Work\DMSCO\BackOffice\.issues\assets\3157-oms-react-idf-brief.md)). `GET IdfPriority/events` with filters
from / to (local wall-clock), store, payer, master (from 619's list), outcome, and paging. Each row: when, store,
payer, document type, item scanned, item dispensed, deciding master + version, outcome, time spent.

Outcomes: reminder · forced pick taken · pick cancelled · line abandoned · skipped by exception · refused
(pre-authorisation). The reserved `requestRaised` / `autoApproved` get display words but are not offered in the
outcome filter until IDF requests exist. Filters live in the URL.

## Spine reach

model/api · logic (filter → query, outcome words) · component/route · i18n (EN+AR) · test + drive

## Proof (→ `tdd` red-green cycles)

- [x] `events filter builds the query and drops empty fields` · pure
- [x] `every outcome, reserved ones too, has a word` · pure
- [x] drive `tools/idf-events-drive.mjs` — filter by outcome and master, page 2, empty state · flow

## Boundaries

New endpoint `GET IdfPriority/events` — stubbed; the paged shape is 3167's to finalise. Keys in `insurance-idf`.
Ungated until 628. Grid cells are isolated by the grid base.

## Done when

The stubbed event log filters and pages, proofs green.

## Blocked by

[619](619-the-idf-masters-list-shows-each-masters-kind-scope-live-version-and-thresholds.md)

## Comments

**2026-10-27 — built (impl/3157-626).** `features/insurance-rules/idf/`: `events.ts` (outcomes — the six live plus
reserved `requestRaised` / `autoApproved` worded; `IDF_EVENT_FILTER_OUTCOMES` offers only the six; row + `Paged`
types; `formatTimeSpent` as `m:ss`), `events-filter.ts` (the address and the door params), `EventsPage.tsx` (filter
bar + plain table like 619's, `GridPager` from core), `idfEventsApi` / `eventsQuery` under 626's slot in `api.ts`, the
route `idf/events`, the menu leaf `menu.idfEvents` (icon `History`), the `events` object in `insurance-idf.json` (EN +
AR), `idfEventsStub` in `tools/idf-stubs.mjs`. Proof: `events-filter.test.ts` 7/7, `events.test.ts` 8/8 (outcome words
EN + AR and the keys the log builds — kept in its own file, not `i18n-keys.test.ts`, so parallel slices do not collide
there), drive `tools/idf-events-drive.mjs` 48/48 STUBBED (LTR + RTL); typecheck, test, lint green.

Decisions (overrulable; 3167 finalises the wire):
- **Shared filter for 627.** `events-filter.ts` splits `IdfEventsFilter` (from, to, store, payer, masterId) and
  `filterDoorParams` — what the swap report sends — from the log's own `outcome` + `page` (`eventsDoorParams`). 627
  adds a `tab` to `IdfEventsQuery` there and fills the `{/* 627 · Swap report tab */}` slot in `EventsPage.tsx`.
- **Window = local days**, `from` / `to` sent as `YYYY-MM-DD` both ends counted; default the last 7 days; refused when
  reversed or over 366 days (a GUESSED cap, like 615's).
- **Address:** `?from&to&store&payer&master&outcome&page`, only what differs from the defaults; the master is `master`
  in the address, `masterId` at the door (the brief's). Any filter change returns to page 1. A reserved or unknown
  outcome in the address is ignored.
- **Paged shape assumed** `{ items, total, page, pageSize }` (the house `Paged<T>`); only `page` is sent, the server
  picks the size (stub: 25). Row fields assumed: `eventId, at, storeCode, payerCode, documentType, itemScanned,
  itemDispensed, masterId, masterVersion, outcome, timeSpentSeconds`.
- **Deciding master** shown by name from 619's `mastersQuery()` (same cache), its id when the list does not hold it,
  with "version N" under it. An outcome this build does not know shows its raw code (`Ltr`).
- **Store and payer are typed** and apply on Enter / blur (not per keystroke).
