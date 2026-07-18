---
type: wayfinder-ticket
wayfinder: grilling
map: 001
status: done
blocked-by: 003, 004
---

# 005 — Lock the Active Sessions screen spec

## Question

Synthesize the resolved decisions into the locked screen spec (the map's destination),
ready for `/to-tickets`. Convergence point — pulls together:

- the endpoint contract (002),
- the access-grant decision (003),
- the confirmed mock shape (004),

and settles the remaining spec polish from the map's **Not yet specified**: live-refresh
behaviour (manual vs polling; optimistic revoke vs refetch), the concrete idle-stale
threshold, the revoke-all audit shape, and empty/error/denied copy + i18n keys.

HITL via `/grilling` + `/domain-modeling` as needed; end by running `/to-spec` to emit the
spec document, then hand to `/to-tickets` for the build.

## Spec-polish decisions (owner, 2026-07-18)

1. **Refresh / freshness** — **auto-poll the current query every 30s + a manual Refresh
   button** ("Updated Ns ago"). Revoke is **optimistic** (row vanishes immediately); the next
   poll reconciles. Polling re-runs only the current capped (≤50-row) query, not the whole
   estate.
2. **Idle rule** — **per-channel relative**, not a single fixed number. `lastSeen` is the
   session heartbeat (`TouchSession` bumps `LastSeenTime` on each request, throttled to once/60s).
   Thresholds: **web > 45m, mobile > 8h; POS & BackOffice never count as idle** (their idle
   expiry is disabled — issue 370). Consequence: the chip label is just **"Idle"** (no fixed
   "> 30m"), with a tooltip explaining the per-channel rule; the **count is server-computed**
   (the `Sessions/Counts` call and the `idleOverMinutes` filter in 002's contract become
   per-channel, not one scalar).
3. **revoke-all-for-user audit** — **one row per killed session** (reuse the existing
   `ADMIN_SESSION_REVOKE` action, one entry per device+IP). Supersedes 002's recommendation of a
   single aggregate row — the owner chose granular device-level audit. No new audit action code.

## Answer

Resolved 2026-07-18. The three decisions above, together with the contract (002), the grant
(003), and the confirmed mock (004), fully specify the screen and close the map's
Not-yet-specified list (bar the grant seed/bind, a `/to-tickets` build concern). **All wayfinder
decisions are now locked** — nothing left to decide.

The one remaining act is mechanical and **user-invoked**: run **`/to-spec`** (source = this map
001 + tickets 002–005) to emit the `type: spec` document, then **`/to-tickets`** to slice the
build. `/to-spec` is not model-invocable, so it's the owner's next step — every input it needs is
recorded across these five tickets.
