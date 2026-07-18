---
type: wayfinder-ticket
wayfinder: grilling
map: 017
status: done
blocked-by: 019
---

# 021 — Shared-cache blast radius & who may clear it

## Question

The `"Pricing"` FusionCache is process-wide and shared across every user and request. A bust has
consequences beyond the analyst who triggers it:

- **Blast radius:** is evicting other users' warm entries (a server-wide cold-cache moment)
  acceptable for a whole-clear, or does that push the answer toward targeted eviction (ticket 019)?
- **Authorization:** who is allowed to trigger a bust? Reuse `POS_SIMULATION_ADMIN`, or does a
  process-wide clear warrant a distinct cache-admin grant? (Feasibility/grant facts from ticket 018.)
- **Guardrails:** any rate-limit, confirm-dialog, or audit note needed so a shared cache isn't
  cleared casually or repeatedly under load?

Decide the blast-radius appetite, the grant, and any guardrails. Depends on the scope chosen in 019.

**From ticket 018 (feasibility):** the `"Pricing"` cache is in-memory, per-process, with **no
backplane** — a bust only affects the SIS.Api instance that serves the request (fine on today's
single-instance IIS; if ever load-balanced, other instances stay stale until TTL). Reusing the
existing `PosSimulation,03` grant is feasible with no new seed. Factor both into the appetite/grant call.

## Answer

- **Blast radius: accepted as-is.** The server-wide cold-cache moment is fine for a low-volume
  analyst tool with short TTLs (5–60 min re-warm). **019's whole-clear scope stands — not reopened.**
- **Authorization: a NEW, distinct cache-admin grant** — *not* a reuse of `PosSimulation,03`. Clearing
  the shared pricing cache is a separate, narrower privilege from running a simulation. **Build
  consequence (reverses 018's "no new seed" convenience):** the spec must define a new
  `BackOfficeScreen[…]` grant + seed it, add its own endpoint filter on `Pricing/ClearCache` (mirroring
  `PosSimulationGrantEndpointFilter`), and expose an **access probe** so the simulator only renders the
  Clear-cache button for holders of that grant (a simulate user without it sees no button). *Open
  spec-level detail for 022:* the grant's controller/command identity.
- **Guardrails: all three.**
  - **Confirm dialog** (client) — "Clear the whole pricing cache?" before firing, so it's never a
    stray click.
  - **Audit log entry** (server) — record who cleared and when (mirror the `BbyDownloadAudit` pattern).
  - **Rate-limit** (server) — throttle repeated clears (e.g. once per N seconds) so the cache can't be
    hammered cold under load. *(Chosen as defence-in-depth even though the blast itself is accepted.)*

The auto-evict-on-download path (020) is a server-internal write-time eviction — it carries **no grant
of its own** (it rides the existing BBY-download grant) and needs no confirm/rate-limit; these
guardrails apply to the **manual** Clear-cache action only.
