/**
 * The simulator's doors (BackOffice spec 3126; door ticket 3140, oms ticket 612). Both run the guard DRAFT.
 *
 * ⚠️ Stubbed until oms 618 (`tools/insurance-rules-stubs.mjs`, section 612): no door here has met a real SIS.Api.
 * No access probe yet — a session without the grant is answered a bare 403 (`isBareDenial`).
 */
import { api } from '@/core/api'
import { INSURANCE_RULES_BASE, INSURANCE_RULES_KEY } from '@/core/insurance-rules/api'
import { backtestRunning, type BacktestDays, type BacktestStarted, type GuardBacktest } from '@/core/insurance-rules/backtest'
import type { SimulateBody, SimulateResult } from './simulate'

const GUARDS = `${INSURANCE_RULES_BASE}/Guards`

export const simulatorApi = {
  /** `POST InsuranceRules/Guards/Simulate` `{ request, patientKey }` → per-line outcome, fired rules and the trace. Writes nothing. */
  async simulate(body: SimulateBody): Promise<SimulateResult> {
    return (await api.post<SimulateResult | null>(`${GUARDS}/Simulate`, body)) ?? { lines: [] }
  },
  /** `POST InsuranceRules/Guards/Backtests` `{ days: 30|90|180 }` → `{ id }` of the job over the draft. */
  startBacktest(days: BacktestDays): Promise<BacktestStarted> {
    return api.post<BacktestStarted>(`${GUARDS}/Backtests`, { days })
  },
  /** `GET InsuranceRules/Guards/Backtests/{id}` — status, progress, the revision it replayed and the report. */
  backtest(id: string): Promise<GuardBacktest> {
    return api.get<GuardBacktest>(`${GUARDS}/Backtests/${encodeURIComponent(id)}`)
  },
}

export const BACKTESTS_KEY = [...INSURANCE_RULES_KEY, 'guards', 'backtests'] as const
/** How often a running back-test is read again. */
export const BACKTEST_POLL_MS = 1000

export function backtestQuery(id: string) {
  return {
    queryKey: [...BACKTESTS_KEY, id],
    queryFn: () => simulatorApi.backtest(id),
    retry: false,
    // Poll while the job runs; a finished one is read once.
    refetchInterval: (q: { state: { data?: GuardBacktest } }) => (q.state.data && !backtestRunning(q.state.data) ? false : BACKTEST_POLL_MS),
  } as const
}
