import { api } from '@/core/api'
import type {
  SimulateRequest,
  SimulationAccessResult,
  SimulationCacheAccessResult,
  SimulationClearCacheResult,
  SimulationResult,
} from '@/core/models/simulation'

// Every server call goes through @/core/api (see .claude/rules/api-envelope.md):
// it unwraps the SIS.Api envelope, returns `.data`, and maps failures to ApiError.
// Consumes BackOffice 509's Pricing/* slice. The `simulate(...)` mutation to
// `Pricing/Simulate` lands with the tracer body of ticket 013; its request/result
// types go in @/core/models/simulation.ts alongside SimulationAccessResult.
const BASE = 'Pricing'

export const simulationApi = {
  // Screen-open grant probe. Drives BOTH the in-page route-guard (the "denied"
  // card) AND the shell's permission-aware nav hiding (issue 429) — the shell's
  // probe shares this exact ['simulation','access'] cache entry, so it's one
  // call, not two. The server enforces POS_SIMULATION_ADMIN on every Pricing/*
  // call regardless; the menu hide is show/hide hygiene only.
  access(): Promise<SimulationAccessResult> {
    return api.get<SimulationAccessResult>(`${BASE}/Access`)
  },

  // Process a basket. The server re-sequences item numbers by array order and
  // returns SimulationResult minus its diagnostic fields (486). A PricingException
  // comes back as a 400 business ApiError ([PRICING_ERROR] message) — caught at the
  // call site as an inline banner; a per-item E/W rides the 200 result data.
  simulate(request: SimulateRequest): Promise<SimulationResult> {
    return api.post<SimulationResult>(`${BASE}/Simulate`, request)
  },

  // Pricing-cache-admin grant probe (spec 022, slice 3a — ticket 051). A DISTINCT
  // privilege from Access above: gates the header's "Clear cache" button, which
  // clears the whole server-side "Pricing" cache (POST Pricing/ClearCache, ticket
  // 052). Its OWN query key (['simulation','cacheAccess']) — not shared with the
  // screen-open probe. Cookie-only; the server enforces the grant on the clear call.
  cacheAccess(): Promise<SimulationCacheAccessResult> {
    return api.get<SimulationCacheAccessResult>(`${BASE}/CacheAccess`)
  },

  // Clear the whole server-side "Pricing" cache (spec 022, slice 3b — ticket 052).
  // No body. The server's rate-limit rejects a too-soon repeat as a business
  // envelope (success:false) — request() throws it as an ApiError kind:'business'
  // that the call site surfaces via apiErrorMessage and never retries.
  clearCache(): Promise<SimulationClearCacheResult> {
    return api.post<SimulationClearCacheResult>(`${BASE}/ClearCache`, {})
  },
}
