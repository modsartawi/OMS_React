---
status: done
spec: 308
blocked-by: 315
---

# 317 — A Ready for collection screen lists closed uncollected days and prepared receipts

## What to build

A new read-only page under Collections: route, menu leaf, `ScreenGate` on a new access boolean, criteria
(collector, accountant via Served-by, business date) and columns (store, profit center, business day, Z number,
cash to hand over, surplus deducted, days waiting). There is no Z viewer. A collector supervisor lands on the
read screens and reaches no act.

## Contract

Build against the envelope recorded under `## Web contract` in the BackOffice ticket(s) below, stubbed exactly.
Do not add fields the contract does not name.

## Proof

- [x] criteria / columns / projection modules under vitest for the behaviour above
- [x] the screen renders against the contract stub (loading, empty, error, refusal)

## Blocked by

- BackOffice [1994](C:\Work\DMSCO\BackOffice-spec1976\.issues\1994-a-ready-for-collection-screen-lists-what-waits-for-a-collector.md) must be **done** and its `## Web contract` written
- BackOffice [1995](C:\Work\DMSCO\BackOffice-spec1976\.issues\1995-a-collector-supervisor-sees-every-collectors-work-read-only.md) must be **done** and its `## Web contract` written
- [315](315-collections-takes-the-four-filters-and-shows-both-dates.md)

## Comments

**Built (2026-09-25).** Built against BackOffice 1994's and 1995's `## Web contract`. I cross-checked them with the
committed `CollectionReadyRowModel` / `CollectionReadyOptions` / `CollectionWebEndpoints` on BackOffice main.
**No drift**: the contract and the code agree field for field.

- **Access:** `canOpenReady` joins `CollectionAccessResult` as a **required** field, read `=== true`
  (`canOpenReady` in `inquiry/api.ts`).
- **Route and menu:** `/collection/ready` → `features/collection/inquiry/ReadyPage.tsx` behind `ScreenGate`. It has
  a menu leaf "Ready for Collection" on its own flag, placed after Collection Attempts.
- **Served by:** `SERVED_BY_SCREENS.ready` is on the assignment reading (Cash Collections' row), pinned in
  `served-by.test.ts`.
- **Criteria** (`ready-criteria.ts`): `BusinessDateFrom/To`, `CollectorId` (free text, the *assigned* collector) and
  the Served-by pair. PascalCase, empty values dropped, `Limit` = the siblings' 2000.
  - The landing has no date and uses **default-to-mine**: an accountant sees their stores, and a session with no
    roster row sees the estate.
  - A business-date bound shows a note that it hides prepared settlement receipts.
- **Columns** (`ready-columns.ts`, landing set): kind, **Profit Center (Store)** = the server's `storeText` rendered
  as sent, store name, business date, Z No#, shortage entry, cash to hand over, surplus deducted, ready since, days
  waiting.
  - The tail holds store code, the raw profit center, currency and both row keys.
  - Currency goes in the money headers when the list holds one currency, and gets its own column when it is mixed.
- **Projection** (`ready-projection.ts`): every null draws `—`, never `0.000`, and a real 0 stays a 0.
- **Read-only:** no row action, no selection, no total, no export.
- **1995:** no web code beyond the leaf. The menu and access tests pin its sample answer: five read screens, no act.
- **Glossary:** two `CONTEXT.md` entries, *Ready for collection* and *Collector supervisor*.

**Proof.**
- vitest: **2420 green** (140 files). Three new pure suites: `ready-criteria` 18, `ready-columns` 16, `ready-projection`
  10. The access, served-by and menu suites were extended.
- `tools/ready-drive.mjs` **44/44** against stubs of the contract.
  - It covers the menu and gate, the collector supervisor, the landing query, every cell of 1994's sample, and the
    toolbar with Reset.
  - For states it covers loading, empty, error (500) and refusal: the door's bare 403, the Served-by resolver's 400
    envelope and the binding 400.
- Sibling drives are unchanged: `four-filters` 80/80, `collection` 220/220, `collections-filters` 44/44.
- `typecheck`, `lint` (all three gates) and `build` are green.

**Outstanding (not this ticket's):**
- Nothing was driven against a live SIS.Api with 1994.
- The grant seed re-run on OMS-HQ is a 1997 runbook line.
- Binding COLLECTOR_SUPERVISOR to people is Authz Admin work.

Decisions are in `.afk/HITL-317.md`.
