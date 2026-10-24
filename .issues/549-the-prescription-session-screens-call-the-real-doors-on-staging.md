---
status: open
spec: C:\Work\DMSCO\BackOffice-2994\.issues\2994-prescription-session-spec.md
blocked-by: 544, 545, 546, 547, 548 (live: BackOffice spec2994 merged to pricing2 + deployed)
---

# 549 — The prescription-session screens call the real doors on staging

## What to build

The live walk of 544–548 once BackOffice branch `spec2994` (`C:\Work\DMSCO\BackOffice-2994`) is merged into
`pricing2` and deployed (the 533 / 538 pattern). Everything before this is built against stubs.

Owner prerequisites (BackOffice side, by hand):

- OMS-HQ DB: `Modules/Authorizations/Sql/Seed-PrescriptionSessionHq-Authorization.sql`, then bind a tester to
  `HQ_PRESCRIPTION_SESSION_VIEW` and another (or the same) to `HQ_PRESCRIPTION_SESSION_WRITE_OFF` in Authz Admin.
- OMS DB: the PrescriptionSessions scripts through `019_prescription_session_after_close.sql`.
- At least one real session at each interesting point (open, stalled / about to lapse, dispensed-not-invoiced, closed
  with a return or re-sale) and one unopened OMS prescription order.

The walk:

- Details (544): an order and a delivery with a session; one without (nothing shown).
- HQ list (545): filters, flag chips vs the counts, Owed view; a user with neither role sees the named denial.
- To open (546), Ended (547) over a real date range.
- Write-off (548): a viewer gets the bare 403 path; a holder writes off a dispensed session (`GOODS_NEVER_LEFT` once,
  to see the put-back), and an OTHER with an Arabic note reads back intact in Ended.
- Any drift between the stubbed shape and the real envelope is fixed in the owning ticket's files and noted here.

## Spine reach

test (live drive + owner walk)

## Proof (→ `tdd` red-green cycles)

- [ ] the five drives re-run against staging, green
- [ ] owner walk of the list, the write-off and Details

## Boundaries

- No new code expected; a shape drift is a fix, not a feature.
- **BO asks (unfiled):** (A) a `PrescriptionSessionWeb/Access` probe for both grants (548); (B) an upload batch
  reference so "To open" can group by upload (546; 3015's recorded finding).

## Done when

Both Proof boxes are ticked on staging.

## Blocked by

- [544](544-an-order-s-or-delivery-s-detail-shows-its-prescription-sessions-read-only.md)
- [545](545-hq-lists-open-prescription-sessions-across-stores-filters-them-and-opens-the-owed-list.md)
- [546](546-hq-sees-unopened-oms-prescription-orders-grouped-by-store-oldest-first.md)
- [547](547-hq-searches-ended-prescription-sessions-by-date-and-reads-their-sales-and-after-close-events.md)
- [548](548-a-write-off-holder-closes-a-dispensed-session-without-invoice-with-a-coded-reason.md)
- BackOffice: `spec2994` merged to `pricing2` and deployed, with the SQL above.
