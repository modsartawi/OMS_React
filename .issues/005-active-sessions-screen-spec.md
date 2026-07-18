---
type: wayfinder-ticket
wayfinder: grilling
map: 001
status: claimed
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
