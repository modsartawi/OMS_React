---
status: done
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

- [x] queue row projection — built from the BackOffice ticket's recorded sample, field for field; only
  differing old → new figures drawn · pure
- [x] `openTabs` / tab model — the Change requests tab exists only for supervision; its count from the
  read · pure
- [x] `settlement-change-drive` (or `settlement-supervision-drive`) extended — supervisor sees the tab, an
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

## Comments

**Built (2026-10-03).** A sixth Open settlements tab, *Change requests* (`?tab=changes`), off BackOffice
2285's `GET Settlement/ChangeRequest/Open?limit=500`.

- **Pure:** `change-queue.ts` holds the row projection (`queueRow`, the old to new drawn by `cardFor`), the
  tally and view (`buildChangeQueue`), `withoutRequest` (a decided row leaves at once) and `withEntryNow`
  (a refused act's figures go onto its row, W8). `open-lane.ts` adds `openTabs({ supervise })`, and
  `readOpenTab` now takes `{ supervise }`, so `?tab=changes` sends anyone else to Shortage. The five
  earlier addresses are unchanged. `change-queue-fixture.ts` copies 2285's recorded row verbatim, plus the
  contract sample, a DELETE, a theft day-move and a missing entry. `change-queue.test.ts` has 19 tests.
- **Screen:** `ChangeQueue.tsx` and `change-queue-columns.tsx`. Approve and Reject are decided inline,
  using 346's acts and 344's map; Reject asks for a Reason in a dialog. A refused approve stays on its row
  with its sentence and step. A row click opens the branch account on the entry. The queue's 404 says
  *not available yet* and is not retried. Its 403 re-reads the probe. `invalidateSettlement` now also
  re-reads `CHANGE_QUEUE_KEY`.
- **Read failure:** an answer that is not a list counts as a failed read (an em-dash, never 0).
  The older drives' catch-all `{}` stub found this: it crashed the page for a supervisor.
- **Grid:** `domLayout="autoHeight"` with `autoHeight` cells, so a refusal, a three-field change or a long
  Reason is never cut off. The queue is small by nature (2285) and capped at 500.
- **Not built:** Excel export. The Asked and Decision columns only render and carry no value, so the
  shared writer would not make it free (Boundaries).

**Proof.** `npm test` 3152/3152, typecheck, lint and build green. `settlement-change-drive` §40–45 is
374/374, all against stubs; there is still no live SIS.Api with 2285. The earlier drives are unmodified
and green: settlement 291, theft 62, supervision 41, approval 42, description 41. One run of
`settlement-drive` failed once on a timing-dependent check (the front-door search after a 200 ms wait);
it passed at HEAD and passed twice more with this change.

**Reviews.** `/code-review` found one issue: a 400 on the Reason was lost if the Reject dialog was closed
while the request was in flight. It now falls through to the toast. `/standards-review` came back MINOR:
- **Fixed:** em-dash literals moved to the `open.changes.noNumber` key; the twice-drawn "what is asked"
  view is now one `AskedLines`; the unused `isError` prop is gone; spec W8's redraw after a refused
  approve is in (`withEntryNow`).
- **Left as is:** the per-tab ternary cascade in `OpenSettlements.tsx`, which predates this ticket; the
  `door === 'approve'` key ternaries, which mirror `EntryChangeRequest`; and the refusal map being local
  state that does not survive a tab switch, as on 346's panel.
