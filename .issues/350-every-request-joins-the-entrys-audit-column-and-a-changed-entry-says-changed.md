---
status: done
spec: 342
blocked-by: 343
---

# 350 — Every request joins the entry's audit column, and a changed entry says "Changed" with its earlier amount

Builds against the History read of BackOffice 2191/2192/2194's `## Web contract`; the tag's rule is the
till's (BackOffice 2197).

## What to build

- **The audit pane (W11):** gains one fact per request from the History read — raised, applied, rejected
  (with its reason), withdrawn, superseded — merged **by time** with the entry's existing facts in
  `audit.ts`. Each names the actor under the name recorded then (`requestedByName` / `decidedByName`) and
  shows the request's Reason. Times are shown as received, in local wall clock. A supervisor's own request
  (`decidedAt == requestedAt`) reads as one applied fact, not a raise and an approval.
- **The "Changed" tag:** when an `APPLIED` change exists, the entry panel's header shows **Changed** with
  its date and the earlier amount. The date is the latest applied change's `decidedAt`; the earlier amount
  is the `oldAmount` of the latest applied change that **moved the amount**. An applied delete is not a
  "Changed" tag (the entry is cancelled).
- A 404 on History leaves the audit pane as it is today.

## Spine reach

store/logic (`audit.ts` merge, pure `changedTag`) · component (`EntryAudit`, panel header) · i18n · test

## Proof (→ `tdd` red-green cycles)

- [x] `auditFacts` with requests — each status yields its fact with actor and reason, interleaved by time
  with posted/approved/consumed facts; a supervisor's own request is one fact · pure
- [x] `changedTag` — 500 → 450 → 420 shows earlier amount 450 at the second change's date; an amount
  change then a description-only change keeps the amount change's earlier figure and the later date; no
  applied change ⇒ no tag · pure
- [x] `settlement-change-drive` extended — a stubbed History with all five statuses draws them in the
  audit column in time order, and the header shows Changed · flow (drive)

## Boundaries

No new door. Reads the History query 343 introduced.

## Done when

The three Proof items are green, typecheck + `npm test` pass, earlier drives unmodified and green.

## Blocked by

[343](343-an-accountant-asks-to-change-an-untouched-entry-and-the-pane-shows-it-waiting.md)

## Open questions

- **A change approved while the entry was still pending** is tagged "Changed" at the till (owner's ruling
  pending in BackOffice). This ticket follows the till's rule as written, so web and till agree whatever
  the ruling.

## Comments

**Built 2026-10-02** (`79d0c16`, review fixes `ab294ec` and the standards-review commit after it).

- **`audit.ts`.** `auditColumn(row, requests?)` takes History's `requests[]` and merges them with the
  same clock and comparator. The Proof's `auditFacts` is this one entry point, so there is no second
  merge. Each request is one raise plus one decision: applied, rejected, withdrawn or superseded. A
  supervisor's own request (`decidedAt == requestedAt` and decider == requester) is one applied fact.
  The actor is named as recorded then. The raise carries the Reason, and a rejection carries its own.
  Old → new appears on the raise and on the application (`cardFor`'s fields).
- **`changedTag(requests, entryId)`** follows the till's rule (2197):
  - the date is the latest applied CHANGE's `decidedAt`;
  - the earlier amount is the `oldAmount` of the latest applied change that moved the amount, judged
    at holding scale;
  - an applied DELETE never tags.
- **The header.** The tag is drawn in the change-request pane's header (`Changed 2026-08-14 · was
  350.00`; "amount not changed: X" when no change moved the amount).
- **One History read.** `changeRequestHistoryQuery` (`queryOptions`, `api.ts`) is observed by the
  pane and the audit column. The drive shows one call. A 404 leaves the column as it was and draws
  no tag.
- **`ChangeFromTo.tsx` + `bidiIsolate`.** The waiting card and the audit column draw old → new
  through one renderer. Each Arabic Description is isolated so the arrow reads old → new.
- **Review fixes.** /code-review found that the posting showed today's figures, that an approved
  delete was told twice, and that "own" had only one half of the check. All three are fixed. The
  standards-review spec axis found an approval in the same second sorting before its raise; that is
  fixed and tested.
- **Proof.**
  - `audit.test.ts` adds 30 cases; `change-request.test.ts` adds `bidiIsolate`.
  - `npm test` is 3119/3119, and typecheck, lint and build are green.
  - Drives: `settlement-change-drive` 306/306, with section 35 new. The earlier drives are unmodified
    and green: settlement 291, approval 42, theft 62, supervision 41, description 41.
- **Owner calls** are in `.afk/HITL-350.md`:
  - where the tag sits;
  - the figure for a change that left the amount alone;
  - which rows carry the Reason (the literal "each shows the request's Reason" is partial: an
    approval, a withdrawal and a supersede carry none);
  - the Posted fact now reads the posted figures;
  - same-second ordering;
  - the copy.

  Not driven: a change applied while the entry was still pending. `changedTag` reads no status, so it
  tags exactly as the till does.
