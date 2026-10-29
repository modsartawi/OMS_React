/**
 * The simulator's doors (BackOffice spec 3126; door ticket 3140, oms ticket 612). Both run the guard DRAFT.
 *
 * Reconciled in oms 618 with 3140 as built: a trace step's `value` arrives as the TEXT `"true" | "false" | "unknown"`
 * (`GuardTraceStep.Value`), read here as the screen's `true | false | 'unknown'`; `why` is one English line.
 * No access probe — a session without the grant is answered a bare 403 (`isBareDenial`). The back-test reads (`GET …/Backtests`, `GET …/Backtests/{id}`) are core's (`@/core/insurance-rules/backtest`): 611 reads them too.
 */
import { api } from '@/core/api'
import { INSURANCE_RULES_BASE } from '@/core/insurance-rules/api'
import type { BacktestDays, GuardBacktest } from '@/core/insurance-rules/backtest'
import type { CategorySimulateResult } from '@/core/insurance-rules/coverage-model'
import type { CategorySimulateBody } from './category'
import type { SimulateBody, SimulateResult, TraceValue } from './simulate'

const GUARDS = `${INSURANCE_RULES_BASE}/Guards`

/** HQ's trace value (`"true" | "false" | "unknown"`, a string) → the screen's; a boolean is taken as it is. */
const traceValue = (v: unknown): TraceValue => (v === true || v === 'true' ? true : v === false || v === 'false' ? false : 'unknown')

export function simulateIn(r: SimulateResult | null | undefined): SimulateResult {
  return { lines: (r?.lines ?? []).map((l) => ({ ...l, fired: l.fired ?? [], unknowns: l.unknowns ?? [], trace: (l.trace ?? []).map((t) => ({ ...t, value: traceValue(t.value) })) })) }
}

export const simulatorApi = {
  /** `POST InsuranceRules/Guards/Simulate` `{ request, patientKey, document? }` → per-line outcome, fired rules, unknowns and the trace. Writes nothing. */
  async simulate(body: SimulateBody): Promise<SimulateResult> {
    return (await simulatorApi.simulateWithReply(body)).result
  },
  /** The same call, keeping HQ's reply as it came (660: the screen shows the request and the reply as JSON). */
  async simulateWithReply(body: SimulateBody): Promise<{ result: SimulateResult; reply: unknown }> {
    const reply = await api.post<SimulateResult | null>(`${GUARDS}/Simulate`, body)
    return { result: simulateIn(reply), reply }
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
