/**
 * The simulator's doors (BackOffice spec 3126; door ticket 3140, oms ticket 612). Both run the guard DRAFT.
 *
 * ⚠️ Stubbed until oms 618 (`tools/insurance-rules-stubs.mjs`, section 612): built in BackOffice 3140, not yet met
 * live. No access probe yet — a session without the grant is answered a bare 403 (`isBareDenial`). The back-test
 * reads (`GET …/Backtests`, `GET …/Backtests/{id}`) are core's (`@/core/insurance-rules/backtest`): 611 reads them too.
 */
import { api } from '@/core/api'
import { INSURANCE_RULES_BASE } from '@/core/insurance-rules/api'
import type { BacktestDays, GuardBacktest } from '@/core/insurance-rules/backtest'
import type { CategorySimulateResult } from '@/core/insurance-rules/coverage-model'
import type { CategorySimulateBody } from './category'
import type { SimulateBody, SimulateResult } from './simulate'

const GUARDS = `${INSURANCE_RULES_BASE}/Guards`

export const simulatorApi = {
  /** `POST InsuranceRules/Guards/Simulate` `{ request, patientKey, document? }` → per-line outcome, fired rules, unknowns and the trace. Writes nothing. */
  async simulate(body: SimulateBody): Promise<SimulateResult> {
    return (await api.post<SimulateResult | null>(`${GUARDS}/Simulate`, body)) ?? { lines: [] }
  },
  /** `POST InsuranceRules/Guards/Backtests` `{ days }` → the back-test of the saved draft (queued, or the one already running for it). */
  startBacktest(days: BacktestDays): Promise<GuardBacktest> {
    return api.post<GuardBacktest>(`${GUARDS}/Backtests`, { days })
  },
}

/** `POST InsuranceRules/Categories/Simulate { request }` (3145) → which category each line got and who set it. Writes nothing. */
export async function simulateCategories(body: CategorySimulateBody): Promise<CategorySimulateResult> {
  return (await api.post<CategorySimulateResult | null>(`${INSURANCE_RULES_BASE}/Categories/Simulate`, body)) ?? { version: null, lines: [] }
}
