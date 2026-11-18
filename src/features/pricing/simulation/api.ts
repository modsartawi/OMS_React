import { api } from '@/core/api'
import type {
  SimulateRequest,
  SimulationClearCacheResult,
  SimulationResult,
} from '@/core/models/simulation'
import type { Permissions } from '@/core/permissions'

// Every server call goes through @/core/api (see .claude/rules/api-envelope.md):
// it unwraps the SIS.Api envelope, returns `.data`, and maps failures to ApiError.
// Consumes BackOffice 509's Pricing/* slice. The `simulate(...)` mutation to
// `Pricing/Simulate` lands with the tracer body of ticket 013; its request/result
// types go in @/core/models/simulation.ts.
const BASE = 'Pricing'

/**
 * The screen grant (`PosSimulation:03`), off the one permissions answer (oms 909): the in-page
 * guard and the nav leaf read it. The server enforces POS_SIMULATION_ADMIN on every Pricing/*
 * call regardless; this is show/hide hygiene only.
 */
export const canOpenSimulation = (p: Permissions): boolean => p.has('PosSimulation:03')

/**
 * The pricing-cache-admin grant (`PricingCache:03`, spec 022) — a DISTINCT privilege from
 * opening the screen: clearing the shared cache evicts every user's warm pricing. Gates the
 * header's "Clear cache" button; the server enforces the grant on the clear call itself.
 */
export const canClearPricingCache = (p: Permissions): boolean => p.has('PricingCache:03')

export const simulationApi = {

  // Process a basket. The server re-sequences item numbers by array order and
  // returns SimulationResult minus its diagnostic fields (486). A PricingException
  // comes back as a 400 business ApiError ([PRICING_ERROR] message) — caught at the
  // call site as an inline banner; a per-item E/W rides the 200 result data.
  simulate(request: SimulateRequest): Promise<SimulationResult> {
    return api.post<SimulationResult>(`${BASE}/Simulate`, request)
  },

  // Clear the whole server-side "Pricing" cache (spec 022, slice 3b — ticket 052).
  // No body. The server's rate-limit rejects a too-soon repeat as a business
  // envelope (success:false) — request() throws it as an ApiError kind:'business'
  // that the call site surfaces via apiErrorMessage and never retries.
  clearCache(): Promise<SimulationClearCacheResult> {
    return api.post<SimulationClearCacheResult>(`${BASE}/ClearCache`, {})
  },
}
