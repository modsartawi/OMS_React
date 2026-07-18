---
type: wayfinder-ticket
wayfinder: grilling
map: 017
status: done
blocked-by: 018
---

# 019 — Whole-cache clear vs targeted BBY eviction

## Question

When the analyst busts the cache, what exactly gets evicted?

- **Whole `"Pricing"` clear** (WPF parity): one `cache.Clear()` nukes all 7 decorated repos'
  entries. Simple, faithful, but throws away every warm entry for every user — a cold-cache tax on
  the next requests across the whole server.
- **Targeted `bby:{n}` eviction:** evict only the BBY number(s) the analyst is testing (e.g. the
  numbers in the simulate basket, or a typed BBY number). Minimal blast radius, but only feasible if
  018 confirms key/tag removal, and it leaves the other stale-data cases (procedure determination,
  material) untouched.
- **Both / scoped clear:** a default targeted path plus an explicit "clear all" escape hatch.

Decide the scope (and whether BBY-only or all-repos), given the feasibility from ticket 018 and the
blast-radius appetite from ticket 021. This shapes the endpoint contract in the spec.

## Answer

**Whole `"Pricing"` cache clear (WPF parity)** — a single `IFusionCacheProvider.GetCache("Pricing")
.Clear()` that evicts all 7 decorated repos. **Targeted `bby:{n}` eviction is rejected** as
insufficient for the real workflow.

Why (from grilling):
- The analyst's edit pattern is **mixed** — re-downloading existing BBYs, testing brand-new BBYs,
  **and "even the price of a specific item."** That last case is **condition-record** staleness
  (`CachedPricingRepository`, `ConditionRecordMinutes = 5`), which targeted `bby:{n}` removal does not
  touch at all.
- False feedback comes from **other master data too** (procedure determination / material / plant),
  not just BBY — so a BBY-scoped clear would leave known stale-feedback cases unfixed.
- Brand-new BBYs are hidden behind the cached `bbylookup:{hash}` list for 5 min (018's caveat); only a
  whole clear makes them appear immediately.

So the reset is **all-or-nothing, whole-cache** — one operation, no per-number targeting. This fixes
the endpoint contract: `Pricing/ClearCache` takes **no body** (no BBY numbers), returns the standard
envelope. The maximum-blast-radius consequence is ticket 021's to weigh (guardrails / grant), not a
reason to narrow the scope.
