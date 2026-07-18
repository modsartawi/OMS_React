# Spec — POS Simulation stale-BBY cache reset (map 017)

Build-ready synthesis of map [017](017-sim-stale-bby-cache-reset.md)'s four locked decisions
([018](018-cache-bust-endpoint-feasibility.md) feasibility, [019](019-cache-bust-scope.md) scope,
[020](020-cache-bust-trigger-surface.md) triggers, [021](021-cache-bust-blast-radius-auth.md)
blast/auth). Consumable by `/to-tickets`. Spans **two repos** — `C:\Work\DMSCO\BackOffice` (server)
and `C:\Playground\oms-react` (client).

## Problem

SIS.Api's process-wide `"Pricing"` FusionCache (`SIS.Pricing.Services`, `AddPricingCaching`) serves a
stale BBY / condition record / master-data row for its TTL (bonus-buy + condition records = 5 min,
config = 60 min) after the underlying data is re-downloaded from SAP. The React POS Simulation reads
through that cache via `Pricing/Simulate`, so an analyst who just edited a BBY on SAP gets **false
pricing feedback**. The WPF fixed this with an in-process `cache.Clear()`; the React engine lives in
SIS.Api, so the fix must be a server endpoint + a client trigger.

## The two mechanisms

### A. Manual "Clear cache" — whole-cache clear (primary, WPF parity)

**Server — new endpoint `POST Pricing/ClearCache`** (in `PricingEndpoints.cs`, mirroring
`Pricing/Simulate`):
- **Body:** none. **Response:** standard `HttpGeneralResponse<T>` via `EndpointHelpers.ExecuteAsync`
  (e.g. `{ success: true, data: { cleared: true } }`).
- **Action:** inject `IFusionCacheProvider`, call `.GetCache(CacheDurationConstants.CacheName).Clear()`
  — evicts all 7 decorated repos (`"Pricing"` cache). No per-number targeting (decision 019).
- **Filters:** `ApiKeyEndpointFilter` (cookie + CSRF, fills UserId) **then a NEW
  `PricingCacheGrantEndpointFilter`** (see Auth) — *not* `PosSimulationGrantEndpointFilter`.
- **Guardrails (server):** (1) **audit** — write a who/when row on each clear, mirroring
  `BbyDownloadAudit`; (2) **rate-limit** — reject repeated clears within a short window (e.g. 1 per N
  seconds per user/instance) with a business envelope the client surfaces, so the cache can't be
  hammered cold under load.

**Client — button in the POS Simulation header only** (`SimHeaderForm.tsx` title row, beside the
Promotion / Pricing Elements toggles; simulator only — not on BBY Download, not a global menu):
- New `simulationApi.clearCache()` → `api.post('Pricing/ClearCache')` (through `@/core/api`).
- **Confirm dialog** before firing (`confirmAction`, like the BBY delete confirm): "Clear the whole
  pricing cache?" — it affects every user, so never a stray click.
- On success, toast confirmation; on the rate-limit business error, surface its message (no retry).
- **Visibility gated by a new access probe** (see Auth) — the button renders only for holders of the
  cache-admin grant. A simulate-only user sees no button.
- i18n: new `simulation.json` keys (`clearCache.button`, `clearCache.confirmTitle`,
  `clearCache.confirmBody`, `clearCache.success`, `clearCache.denied`). Logical Tailwind only.

### B. Auto-evict on BBY download — targeted (secondary, root-cause)

On a **successful** `BonusBuyDownloadWeb/Download`, the server evicts **only** `bby:{number}` from the
`"Pricing"` cache (`IFusionCache.RemoveAsync($"bby:{number}")`), so the common re-download→simulate
loop is coherent without any click.
- **Coupling (called out, decision 020):** the download seam
  (`Sartawi.Retail.Data.Modules.Logistics.Pricing.Bby.Services.IBonusBuyDownloadWebService`) gains
  access to the SIS.Pricing `"Pricing"` cache via `IFusionCacheProvider` — a new cross-module
  dependency. Wire it so the eviction is best-effort (a cache-remove failure never fails the download).
- **No new grant, no confirm, no rate-limit** — it rides the existing `BbyDownload,03` grant and fires
  server-side as part of the download it's already authorized for.
- Note: evicting `bby:{n}` fixes a *re-downloaded existing* BBY; a *brand-new* BBY still waits out the
  `bbylookup:*` TTL — that broader case is what the manual whole-clear (A) covers.

## Authorization — a new, distinct cache-admin grant (decision 021)

Clearing the shared cache is a **separate privilege** from running a simulation (deliberately NOT a
reuse of `PosSimulation,03`). Following the `PosSimulationScreenGate` pattern exactly:
- **Grant:** `BackOfficeScreen[CONTROLLER='<PricingCache?>', COMMAND='03' (Display/OPEN)]`.
  **Open spec detail:** confirm the CONTROLLER identity with the owner — proposed **`PricingCache`**
  (the clear affects all pricing, not just simulation). Seed via a new
  `Seed-<Controller>-Screen-Authorization.sql` mirroring `Seed-PosSimulation-Screen-Authorization.sql`.
- **Gate:** new `IPricingCacheAdminGate.CanClearAsync(userId)` in Retail.Data WebAuth.Services,
  1:1 on `PosSimulationScreenGate` (inject `IAuthorizationService`, one `Check`, `== Allowed`,
  fail-closed).
- **Endpoint filter:** new `PricingCacheGrantEndpointFilter` (1:1 on `PosSimulationGrantEndpointFilter`).
- **Access probe:** new `GET Pricing/CacheAccess` (cookie-only, NOT grant-gated) returning
  `{ canClear }`, so React can show/hide the button — the sibling of `Pricing/Access`. Client fetches
  it (its own TanStack Query key) to gate button render.

## Blast radius (decision 021, accepted)

Whole-clear evicts every user's warm pricing on the serving instance — accepted as-is for a low-volume
analyst tool with short TTLs. **Fact to record:** the cache is in-memory, per-process, **no backplane**
(018) — a clear only affects the instance that serves it; fine on single-instance IIS, a caveat if
ever load-balanced. No mitigation required beyond the guardrails above.

## Explicitly deferred (not in this build)

- **Freshness UX** — a passive "conditions may be up to 5 min old / last cleared at HH:mm" indicator in
  the simulator. A separate enhancement; revisit after the reset ships. (Map fog.)
- **Per-simulate bypass flag** — ruled **out of scope** (020): would need invasive skip-cache plumbing
  through every `Cached*Repository` decorator for marginal benefit.
- TTL redesign / distributed cache / SAP-side changes — **out of scope** (map).

## Build slices (suggested for /to-tickets)

1. **Server — `Pricing/ClearCache` + new cache-admin grant** (endpoint, gate, filter, seed SQL,
   `Pricing/CacheAccess` probe, audit + rate-limit).
2. **Server — auto-evict `bby:{n}` on `BonusBuyDownloadWeb/Download`** success (cross-module wire,
   best-effort).
3. **Client — simulator Clear-cache button** (api call, confirm dialog, access-probe gating, i18n,
   toasts).
