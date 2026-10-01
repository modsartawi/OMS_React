---
status: open
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

- [ ] `auditFacts` with requests — each status yields its fact with actor and reason, interleaved by time
  with posted/approved/consumed facts; a supervisor's own request is one fact · pure
- [ ] `changedTag` — 500 → 450 → 420 shows earlier amount 450 at the second change's date; an amount
  change then a description-only change keeps the amount change's earlier figure and the later date; no
  applied change ⇒ no tag · pure
- [ ] `settlement-change-drive` extended — a stubbed History with all five statuses draws them in the
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
