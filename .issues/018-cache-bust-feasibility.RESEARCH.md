# Research — SIS.Api cache-bust feasibility (ticket 018, map 017)

Facts only, from `C:\Work\DMSCO\BackOffice`. The choice among these options is for tickets 019/020/021.

## 1. FusionCache surface

- **Package:** `ZiggyCreatures.FusionCache` **v2.0.2** (`SIS.Pricing.Services.csproj`). One named cache
  `"Pricing"` registered by `AddPricingCaching` (`PricingCachingExtensions.cs`), reached via
  `IFusionCacheProvider.GetCache("Pricing")` — the same call the WPF used in-process.
- **Whole clear — available.** `IFusionCache.Clear()` exists in v2 (this is the exact WPF-parity call:
  `provider.GetCache("Pricing").Clear()`). Expires every entry across all 7 decorated repos.
- **Targeted eviction by key — available.** `RemoveAsync(key)` has always existed. A BBY is stored
  under key **`bby:{number}`** (`CachedBonusBuyRepository.GetBonusBuyByNumber` / the per-number
  `SetAsync` inside `GetBonusBuys`). So `cache.RemoveAsync($"bby:{n}")` evicts exactly one BBY.
  → **Targeted eviction in ticket 019 is real, not imagined.**
- **Tag-based removal — NOT usable as-is.** v2 supports `RemoveByTagAsync`, but the current caching
  code sets **no tags** on any entry. Tag removal would require adding tags first, so it's a
  build-cost option, not a free one.
- **Nuance for "targeted":** there is also a `bbylookup:{queryHash}` entry caching the *list of BBY
  numbers* matching a basket query. The stale **price/content** lives under `bby:{n}`, not the lookup,
  so removing `bby:{n}` is sufficient to defeat stale content for an **already-existing** BBY (same
  number, re-downloaded). Edge case: a **newly-created** BBY absent from a cached `bbylookup` list
  stays undiscovered for up to 5 min; per-number removal won't help that — only a whole `Clear()` or
  evicting the `bbylookup:*` entries would. TTLs: `bby:*` and `bbylookup:*` = 5 min (`BonusBuyMinutes`).

## 2. Endpoint wiring (mirror of the existing Pricing slice)

`PricingEndpoints.cs` (`SIS.Api/Endpoints/Logistics`) is the template. A cache-bust endpoint would be:

```
app.MapPost("Pricing/ClearCache", ClearCache)          // or a targeted variant taking bby numbers
   .WithOpenApi()
   .AddEndpointFilter<ApiKeyEndpointFilter>()           // cookie-web auth + CSRF, fills UserId claim
   .AddEndpointFilter<PosSimulationGrantEndpointFilter>();  // re-checks the grant server-side
```

- **DI:** the handler injects `IFusionCacheProvider` (already registered by `AddFusionCache` in
  `AddPricingCaching`), calls `.GetCache("Pricing").Clear()` or `.RemoveAsync("bby:{n}")`.
- **Envelope:** wrap in `EndpointHelpers.ExecuteAsync(...)` → the standard `HttpGeneralResponse<T>`
  `{ success, data }` that the React `@/core/api` already unwraps. No new envelope shape.
- **Grant:** reusing **`PosSimulationGrantEndpointFilter`** = `BackOfficeScreen[PosSimulation,03]`
  (the same grant gating `Pricing/Simulate`) requires **no new grant seed** — "if you can run the
  simulator, you can clear the cache." A distinct cache-admin grant is possible but not required; the
  appetite is ticket 021's call.

## 3. Download path & auto-evict feasibility

- **Server endpoint:** `BonusBuyDownloadWeb/Download` (`BonusBuyDownloadWebEndpoints.cs`) →
  `IBonusBuyDownloadWebService.DownloadAsync(actor, bbyNumber, attributes)`. This seam lives in
  **`Sartawi.Retail.Data.Modules.Logistics.Pricing.Bby.Services`** and writes the central `Bby*`
  tables via HANA middleware.
- **It does NOT touch the SIS.Pricing `"Pricing"` FusionCache today** — different module, no reference
  to `IFusionCacheProvider`.
- **Auto-evict-on-download is feasible** (same SIS.Api process → the in-memory cache instance is
  shared, so a `RemoveAsync("bby:{n}")` from the download handler would be seen by `Pricing/Simulate`),
  **but it introduces a new cross-module dependency**: the download seam (Retail.Data) would need to
  depend on the pricing cache (SIS.Pricing.Services). That coupling is the design cost ticket 020
  must weigh against the manual-button option.

## 4. Cross-cutting fact for ticket 021 (blast radius)

The `"Pricing"` cache is **in-memory, per-process, with NO backplane** (`AddPricingCaching` sets only
default entry duration — no `.WithBackplane(...)`). Consequences:
- A `Clear()` evicts every user's warm entries on that instance — a server-wide cold-cache moment.
- If SIS.Api is ever **multi-instance / load-balanced**, a bust only affects the instance that handled
  the request; other instances stay stale until TTL. Current deployment is single-instance IIS, so
  this is a caveat to record in the spec, not a blocker.
