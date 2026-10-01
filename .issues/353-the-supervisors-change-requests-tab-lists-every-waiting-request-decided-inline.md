---
status: open
spec: 342
blocked-by: 346
---

# 353 — The supervisor's "Change requests" tab lists every waiting request in the estate, decided inline

⚠ **Also blocked by a BackOffice ticket that does not exist yet** (W9). Spec 2190 has no estate-wide read
of waiting requests. Owner ruling 2026-10-01: leave this ticket blocked; the BackOffice read is minted
separately in that repo, and its `## Web contract` fixes the shape built here.

## What to build

A new **Change requests** tab in Open settlements, drawn only for `canSuperviseSettlement`, beside
"Awaiting approval". One row per waiting change or delete request across the estate, oldest first, each
showing branch, entry number, kind, old → new figures (only those that differ), requester, time and
Reason (story 19). Rows are **approved or rejected inline** (Reject asks for a Reason, ≤ 200), reusing
346's acts and 344's refusal map; a refused approve **stays in the queue** with its refusal shown on the
row (story 20). Opening a row opens the entry's branch account panel. After an act the queue, History and
the lanes are re-read (W8). Its count rides the tab strip like the other tabs.

**Proposed read (W9) — the BackOffice ticket owns the final shape and grant:**
`GET Settlement/ChangeRequest/Open?limit=`, behind settlement supervision. Each row: the History row's
request fields plus `storeId`, store code and name, `entryNumber`, `entryKind`, `entryStatus`, `amount`,
`remainingAmount`, `spentAmount`, oldest first.

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

- New door from a **not-yet-minted** BackOffice ticket. A 404 shows "not available yet" like 343's pane.
- Excel export only if the shared grid writer (`core/util/grid-xlsx.ts`) makes it free (spec 342 Out of
  Scope).
- The tab's address must not disturb the existing tab addresses (340 kept old ones resolving).

## Done when

The three Proof items are green against the BackOffice ticket's sample, typecheck + `npm test` pass,
earlier drives unmodified and green.

## Blocked by

[346](346-a-supervisor-approves-or-rejects-a-waiting-request-beside-the-entrys-figures-today.md) — and
the BackOffice queue-read ticket (not yet minted).

## Open questions

- **The BackOffice read must be minted first** (in `C:\Work\DMSCO\BackOffice-2149` / `pricing2`). Until its
  `## Web contract` exists, do not start this ticket.
- **If the owner prefers a Ledger criterion** (`Settlement/Ledger?changeRequest=OPEN`) over a new door, the
  queue row loses the request's figures and each row opens the panel instead of being decided inline; this
  ticket is then reshaped before it starts.
