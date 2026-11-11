---
status: done
spec: 759
blocked-by: 760
---

# 764 — "LF returns needing action" on the Deliveries list

## What to build

Spec 759 F6. An operator holding grant 03 picks **LF returns needing action** on the Deliveries
list and works the stuck LF returns as a queue: each row shows the return delivery, its forward
delivery, why it needs action (`unanswered`, `nothingReceived`, `short`) and how long since it was
booked, and opens the return delivery's Document Details (where 762's panel is).

⚠ **Prefactor decision first.** The existing lenses are predicates over rows *already loaded*
(`lenses.ts` — they never call the server). This preset is fed by **its own server read**
(3369's needing-action rows), so it is not a lens. Decide — and record the decision in this
ticket — between a server-fed view beside the lenses in the views rail, and its own small grid
on the page. Do not bend `lensMatches` to fetch.

- Hidden without 03.
- Age reads in days from `bookedAt` against local wall-clock.
- An empty answer says there is nothing needing action, not "no search yet".

## Spine reach

api (needing-action read in the deliveries `api.ts`) · model · logic (pure age + reason projection)
· component (the preset per the decision above; grid spreads `OMS_GRID_BASE_COL_DEF`) · i18n
(`deliveries`, en + ar) · test (pure vitest + drive)

## Proof (→ `tdd` red-green cycles)

- [x] `age in days from bookedAt` — across a midnight and a month boundary · pure
- [x] `each outcome maps to its reason key` — and a non-needing outcome is not listed · pure
- [x] `the preset is absent without 03` · pure
- [x] `deliveries-drive` — stubbed rows, the preset lists them with reason and age, a row opens its return delivery; empty answer worded · flow (Playwright)

## Boundaries

- Server read: BackOffice 3376, stubbed.
- `features/oms/deliveries` must not import from `features/oms/document` — shared shapes go to
  `core/`.
- No dedicated LF returns page (759 out of scope).

## Done when

All Proof boxes are ticked, gates green.

## Blocked by

- 760 (the grant 03 flag)

## Comments

**2026-11-04 — done** on `spec/759-lf-return` (d6b12604, merged acc210c3; review fixes 5407d1ad; merged to main 015d7fac 2026-11-05, unpushed). `lf-returns-queue-drive` 22/22, `deliveries-list-drive` 362/362.

**Prefactor decision:** a **server-fed view in the views rail**, under a new "Queues" section below the Lenses, drawn only with 03. Picking it swaps the results grid (kept mounted, hidden) for the queue's own small grid (spreads `OMS_GRID_BASE_COL_DEF`). `LensId`/`lensMatches` are untouched. Why: the rows come from their own read and have another shape, so it is not a lens and can't share the main grid's columns or saved views. A lens, saved view or search leaves the queue. The open state lives in the search store (`lfReturnsQueueOpen`), so Back lands on the queue. ⚠ Guessed route `SdDocumentWeb/LocalFulfillmentReturnsNeedingAction`. Extras beyond the ticket (overrulable): palette row, rail count, Booked column.
