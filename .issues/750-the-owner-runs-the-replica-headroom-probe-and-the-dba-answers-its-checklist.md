---
type: wayfinder-ticket
wayfinder: task
map: 741
status: claimed
blocked-by: —
---

# 750 — The owner runs the replica headroom probe and the DBA answers its checklist

## Question

Not a decision. These are the measurements that
[What analytical load can the replica carry, and where may derived tables live?](742-what-analytical-load-can-the-replica-carry-and-where-may-derived-tables-live.md)
could not take, because the replica answers only on the corporate network. **HITL:** the owner runs
it, or an agent session does on the corporate network. The DBA answers the questions only a DBA can.

1. On the corporate network (`Test-NetConnection 172.23.27.47 -Port 1433` → `True`), run
   [741-replica-probe.sql](../docs/research/741-replica-probe.sql) **twice**:
   - once at a busy hour, to `docs/research/741-replica-probe.out.txt`;
   - once off-hours, to `…offhours.txt`.
   The command is in the file header. It is read-only and writes nothing.
2. Put the DBA checklist (§4 of
   [741-replica-headroom-and-derived-tables.md](../docs/research/741-replica-headroom-and-derived-tables.md))
   to the DBA. Record the answers.
3. Fold both into that note's §3–§5. Read P6 against the thresholds in §3.

**Resolved when** the note records:
- the edition;
- which in-scope tables are missing;
- the P6 timings (busy and off-hours);
- the replica lag;
- the DBA's answers on items 3 (columnstores on reinit), 5–7 (latency and concurrency),
  8 (missing articles) and 9 (sibling DB).

## Progress (2026-11-03, not yet resolved)

**Step 1 is half done.** The busy-hour run took place on Tuesday 2026-11-03 at 20:36 from the
corporate network. Its output is [741-replica-probe.out.txt](../docs/research/741-replica-probe.out.txt).
It is folded into §1, §3a, §4 and §5 of
[the note](../docs/research/741-replica-headroom-and-derived-tables.md).

Resolution criteria now recorded:
- **Edition:** Enterprise. Resource Governor is available; whether it is configured is still a
  DBA question.
- **Missing tables:** `Callout`, `CalloutBid`, `CalloutEvent`, `DispatchBoardRelease`, `Material`,
  `StoreGroup`, `DocumentSource` and `LoyCustomerFirstPurchase`.
- **P6, busy hour:** every 92-day aggregate takes 3.3 s or less. That is the first band:
  direct query through a cached semantic layer.
- **Replica lag:** seconds. The 1,236-min `RetailTrx` figure is a date-only-column artifact.
- **DBA item 6:** answered by the probe. RCSI is on.

Still owed, before `done`:
- [ ] **The off-hours run** (around 03:00): the same command with
  `-o docs\research\741-replica-probe.offhours.txt`. Fold it into §3a.
- [ ] **The DBA's answers** on §4, items 3 (columnstores on reinit), 5 (latency), 7 (the
  four-parallel test with Replication Monitor), 8 (the eight missing articles: cost and willingness;
  the v1 dispatch subset is now its own task, 753, and `DispatchBoardRelease` is not a table) and
  9 (the sibling DB; `ZC` and `BusinessMonitor` are a precedent). Items 1
  (Resource Governor configured?), 2, 4 and 10 are wanted too, but they do not gate this ticket.
