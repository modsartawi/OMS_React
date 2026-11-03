---
type: wayfinder-ticket
wayfinder: task
map: 741
status: open
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
