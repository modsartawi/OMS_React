import { BACKTEST_DAYS, type BacktestDays } from '@/core/insurance-rules/backtest'

// The simulator's address (ticket 612): `?tab=simulate|backtest&days=30|90|180&id=<back-test id>`. The back-test
// being followed lives in the address, so a reload (or a link handed to the approver) reads the same job. The
// typed request does not: it holds a patient key. Pure; read through `useUrlQuery`.

export const SIMULATOR_TABS = ['simulate', 'backtest'] as const
export type SimulatorTab = (typeof SIMULATOR_TABS)[number]

export interface SimulatorQuery {
  tab: SimulatorTab
  days: BacktestDays
  /** The back-test followed, or null before one is started. */
  id: string | null
}

const DEFAULTS: SimulatorQuery = { tab: 'simulate', days: 30, id: null }

export function simulatorFromParams(params: URLSearchParams): SimulatorQuery {
  const tab = params.get('tab') as SimulatorTab
  const days = Number(params.get('days')) as BacktestDays
  return {
    tab: SIMULATOR_TABS.includes(tab) ? tab : DEFAULTS.tab,
    days: BACKTEST_DAYS.includes(days) ? days : DEFAULTS.days,
    id: params.get('id')?.trim() || null,
  }
}

export function simulatorToParams(q: SimulatorQuery): URLSearchParams {
  const out = new URLSearchParams()
  if (q.tab !== DEFAULTS.tab) out.set('tab', q.tab)
  if (q.days !== DEFAULTS.days) out.set('days', String(q.days))
  if (q.id) out.set('id', q.id)
  return out
}
