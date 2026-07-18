---
type: wayfinder-ticket
wayfinder: research
map: 017
status: done
blocked-by: —
---

# 018 — SIS.Api cache-bust feasibility: endpoint + FusionCache API + download path

## Question

What can the server actually do, so the decision tickets choose among real options — not imagined
ones? Produce a `/research` note (linked asset) answering:

1. **FusionCache surface** on the `"Pricing"` named cache via `IFusionCacheProvider`: is
   whole-cache `Clear()` available, AND is targeted eviction by key (`RemoveAsync("bby:{n}")` /
   tag-based removal) available in the ZiggyCreatures.Caching.Fusion version referenced by
   `SIS.Pricing.Services`? (Determines whether "targeted eviction" in ticket 019 is even on the table.)
2. **Endpoint wiring:** how a `Pricing/ClearCache` (or targeted variant) endpoint would be hosted in
   SIS.Api's `Pricing/*` slice — DI access to `IFusionCacheProvider`, the envelope shape it returns,
   and the grant it would sit behind (does `POS_SIMULATION_ADMIN` fit, or is a cache-admin grant
   warranted given the process-wide blast radius?).
3. **Download path:** where the BBY *download* is implemented server-side (the endpoint the React
   `bonus-buy-download` screen calls), and whether it writes through / could evict `bby:{n}` on
   success — the root-cause auto-evict option.

Record facts only (APIs, class/endpoint locations, grant names); the choice is for 019/020/021.

## Answer

Full facts in the linked note: [018 cache-bust feasibility research](018-cache-bust-feasibility.RESEARCH.md).
Headlines:

1. **FusionCache = ZiggyCreatures.FusionCache v2.0.2.** Both options are real: whole-cache
   `GetCache("Pricing").Clear()` (WPF parity) **and** targeted `RemoveAsync("bby:{n}")` (BBY key is
   `bby:{number}`). Tag removal exists in v2 but no entries are tagged today, so it's build-cost, not
   free. Caveat: targeted removal defeats stale content for an **existing** re-downloaded BBY, but a
   **newly-created** BBY stays undiscoverable via the cached `bbylookup:{hash}` list for 5 min unless
   whole-cleared.
2. **Endpoint:** a `Pricing/ClearCache` (or targeted variant) mirrors `Pricing/Simulate` exactly —
   `MapPost` + `ApiKeyEndpointFilter` + `PosSimulationGrantEndpointFilter`, inject
   `IFusionCacheProvider`, wrap in `EndpointHelpers.ExecuteAsync` (standard envelope). **Reusing the
   existing `PosSimulation,03` grant needs no new seed.**
3. **Auto-evict-on-download is feasible** (shared in-process cache) **but couples** the Retail.Data
   download seam to the SIS.Pricing cache — a new cross-module dependency to weigh (ticket 020).
4. **New fact for ticket 021:** the cache is in-memory, per-process, **no backplane** — a bust only
   affects the instance that serves it (fine on single-instance IIS; a caveat if ever load-balanced).
