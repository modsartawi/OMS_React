---
status: open
spec: 342
blocked-by: 346
---

# 353 — The supervisor's "Change requests" tab lists every waiting request in the estate, decided inline

**Unblocked 2026-10-03.** The BackOffice read (W9) is minted and done: BackOffice ticket **2285**
(`C:\Work\DMSCO\BackOffice\.issues\2285-a-supervisor-reads-every-waiting-change-request-in-the-estate-oldest-first.md`,
commit `af56b73bf` on `pricing2`). Its `## Web contract` fixes the shape built here, and its `## Comments`
hold the recorded response the projection is built from.

## What to build

A new **Change requests** tab in Open settlements, drawn only for `canSuperviseSettlement`, beside
"Awaiting approval". One row per waiting change or delete request across the estate, oldest first, each
showing branch, entry number, kind, old → new figures (only those that differ), requester, time and
Reason (story 19). Rows are **approved or rejected inline** (Reject asks for a Reason, ≤ 200), reusing
346's acts and 344's refusal map; a refused approve **stays in the queue** with its refusal shown on the
row (story 20). Opening a row opens the entry's branch account panel. After an act the queue, History and
the lanes are re-read (W8). Its count rides the tab strip like the other tabs.

**The read (W9), as BackOffice 2285 built it:** `GET Settlement/ChangeRequest/Open?limit=`, cookie
session plus settlement supervision, **403** otherwise. 200 with a flat camelCase JSON array, oldest first
(`requestedAt`, then `changeRequestId`); empty means nothing is waiting. `limit` defaults to 500, capped at
20,000. Each row is the History row's request fields unchanged, plus `storeName`, `currencyKey`,
`entryNumber`, `entryKind`, `entryStatus`, `amount`, `remainingAmount`, `spentAmount`. Differences from
the proposal and things the recording shows:

- **`storeId` is the branch code**; there is no separate code field. `storeName` is the Store master's
  name, or the code echoed back when the master has no row.
- **`currencyKey` was added** (the plant's, `SAR` when it has no row), so figures can be drawn at the
  branch's scale. BHD money keeps its third decimal (`12.345`, a zero is `0.000`).
- **`amount` / `remainingAmount` / `spentAmount` are the entry NOW** (committed reads), not the figures at
  the request (`oldAmount`). The supervisor decides against these.
- **`requestedAt` carries fractional seconds** (`2026-10-03T14:12:53.1934499`, local wall-clock).
- A request whose entry is missing still lists, with `entryNumber` 0 and `''` kind/status.
- A `DELETE` row has `newAmount` = `oldAmount` and the same description, as History records it.

## Spine reach

model/api (queue row + read) · store/logic (pure row projection) · component (tab, inline acts) · i18n ·
test

## Proof (→ `tdd` red-green cycles)

- [ ] queue row projection — built from the BackOffice ticket's recorded sample, field for field; only
  differing old → new figures drawn · pure
- [ ] `openTabs` / tab model — the Change requests tab exists only for supervision; its count from the
  read · pure
- [ ] `settlement-change-drive` (or `settlement-supervision-drive`) extended — supervisor sees the tab, an
  accountant does not; inline approve removes the row; a stubbed `BELOW_SPENT` keeps it with the refusal;
  reject requires a reason · flow (drive)

## Boundaries

- The door is BackOffice 2285, merged on `pricing2` but not yet on every server. A 404 shows "not
  available yet" like 343's pane.
- Excel export only if the shared grid writer (`core/util/grid-xlsx.ts`) makes it free (spec 342 Out of
  Scope).
- The tab's address must not disturb the existing tab addresses (340 kept old ones resolving).

## Done when

The three Proof items are green against the BackOffice ticket's sample, typecheck + `npm test` pass,
earlier drives unmodified and green.

## Blocked by

[346](346-a-supervisor-approves-or-rejects-a-waiting-request-beside-the-entrys-figures-today.md) (done).
The BackOffice queue read is BackOffice 2285 (done).

## Open questions

- ~~The BackOffice read must be minted first~~ — **resolved**: BackOffice 2285 (2026-10-03).
- ~~If the owner prefers a Ledger criterion~~ — **resolved**: 2285 built the new door, so the row carries
  the request's figures and is decided inline as written above.
