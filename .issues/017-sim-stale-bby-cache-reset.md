---
type: wayfinder-map
status: done
---

# 017 — POS Simulation stale-BBY cache reset

## Destination

A locked **decision/spec** for how the React POS Simulation (and, if chosen, the Bonus Buy
Download flow) prevents *false pricing feedback* caused by SIS.Api's server-side `"Pricing"`
FusionCache serving a stale BBY after it was re-downloaded from SAP. The spec names the
approach(es) — endpoint shape, trigger surface, blast-radius/auth — and is ready for `/to-spec`
→ `/to-tickets`. **Plan, don't build.**

## Notes

- **Domain / ground truth (verified in `C:\Work\DMSCO\BackOffice`):**
  - The stale cache is a single named FusionCache `"Pricing"` (`CacheDurationConstants.CacheName`)
    in `SIS.Pricing.Services`, registered by `PricingCachingExtensions.AddPricingCaching`. It
    decorates 7 repos; a BBY is cached as `bby:{number}` for `BonusBuyMinutes = 5`.
  - WPF `PosSimulationController.ClearCache()` did an **in-process** `IFusionCacheProvider
    .GetCache("Pricing").Clear()` — the fat client hosted the engine. In React the engine lives in
    **SIS.Api**, so a bust must be a **new server endpoint**; none exists in the `Pricing/*` slice
    (client only calls `Pricing/Access` + `Pricing/Simulate`, see `src/features/pricing/simulation/api.ts`).
  - The `"Pricing"` cache is **process-wide, shared across all users/requests** — clearing it evicts
    everyone's warm entries.
  - The React BBY Download screen (`features/pricing/bonus-buy-download`) is a *separate* SIS.Api
    call — a candidate place to evict on write (root-cause fix).
- **Skills:** `/grilling` + `/domain-modeling` for the decisions; `/research` for the SIS.Api
  endpoint/FusionCache-API feasibility; `/prototype` if a trigger UX needs a concrete take.
- This is a **server + client** effort; the map decides shape, the build spans both repos.

## Decisions so far

<!-- one line per resolved ticket -->

- [SIS.Api cache-bust feasibility](018-cache-bust-endpoint-feasibility.md) — FusionCache v2.0.2: both whole `Clear()` and targeted `RemoveAsync("bby:{n}")` are feasible; a `Pricing/ClearCache` endpoint mirrors `Pricing/Simulate` and can reuse the `PosSimulation,03` grant (no new seed); auto-evict-on-download works but couples Retail.Data→pricing cache; cache is in-memory per-process, no backplane. ([research](018-cache-bust-feasibility.RESEARCH.md))
- [Whole-cache clear vs targeted BBY eviction](019-cache-bust-scope.md) — **Whole `"Pricing"` clear (WPF parity)**; targeted rejected. Workflow hits condition-record + other master-data staleness, not just BBY, so the reset is all-or-nothing → `Pricing/ClearCache` takes no body. (Also resolves the "Beyond BBY" fog: yes, all repos.)
- [Where the cache-bust is triggered](020-cache-bust-trigger-surface.md) — **Two triggers:** a manual "Clear cache" button in the **simulator only** (whole-clear, WPF parity) **+ auto-evict `bby:{n}` on successful BBY download** (targeted, accepts Retail.Data→pricing-cache coupling). Per-simulate bypass flag **rejected** (out of scope).
- [Shared-cache blast radius & who may clear it](021-cache-bust-blast-radius-auth.md) — Blast **accepted as-is** (scope unchanged). Gated by a **new, distinct cache-admin grant** (not `PosSimulation,03`) → new seed + filter + button access-probe. Guardrails on the manual clear: **confirm dialog + audit log + rate-limit**. Auto-evict rides the existing BBY-download grant, no extra guardrails.
- [Lock the stale-BBY cache-reset spec](022-cache-reset-spec-lock.md) — Decisions consistent; synthesized into the build-ready **[spec](022-cache-reset.SPEC.md)** (3 slices: ClearCache endpoint+grant, auto-evict on download, simulator button). One open build detail: confirm the new grant's CONTROLLER name (proposed `PricingCache`). **Map complete — ready for `/to-tickets`.**

## Not yet specified

- **Freshness UX:** whether the simulator should *show* cache state ("conditions may be up to 5 min
  old", last-cleared time) rather than / alongside a manual bust.

## Out of scope

- Redesigning the pricing cache's TTLs or moving it to a distributed/shared cache — that's a
  server-performance effort, not this stale-feedback fix.
- Any change to SAP-side behavior or the SAP↔middleware download itself.
- **Per-simulate "read fresh / bypass cache" flag** — ruled out in [Where the cache-bust is triggered](020-cache-bust-trigger-surface.md): the whole-clear button covers the need and a bypass would require invasive changes to every `Cached*Repository` decorator.
