// oms 700 (BackOffice spec 3271, door 3290): a monitor's back-test, on the real envelope. 🚩 Guessed, listed on ticket 700 for 711:
// one job of the draft's revision on the guard back-test doors, with a `monitors` section beside the guard figures. Synthetic data.
import { backtestReport, envelope } from './insurance-rules-stubs.mjs'

/** The monitors a drive puts in the guard draft, in its wire spelling. */
export const monitorRule = (id, state, over = {}) => ({
  id,
  kind: 'monitor',
  scope: 'claimResponse',
  uses: ['preauthorization', 'claim'],
  name: { en: `Monitor ${id}`, ar: `مراقبة ${id}` },
  folder: '',
  state,
  when: [{ check: 'fact', path: '$claimResponse.outcome', op: 'anyOf', value: ['rejected'] }],
  then: [{ effect: 'reviewItem', severity: 'action', says: { en: 'Look at this answer.', ar: 'راجع هذا الرد.' } }],
  ...over,
})

export const MONITOR_SECTION = {
  answers: 800,
  raisedOn: 2,
  raised: { action: 3, info: 1 },
  items: [
    { on: '2026-10-26', message: { source: 'nphies', id: 'ANS-7001' }, maskedKey: '1*******83', rules: ['M-001'] },
    // Arrives whole: the screen masks it.
    { on: '2026-10-25', message: { source: 'nphies', id: 'ANS-7002' }, maskedKey: '1198765408', rules: ['M-001', 'M-002'] },
  ],
  itemsTotal: 40,
  rules: [{ ruleId: 'M-001', raised: 3 }, { ruleId: 'M-002', raised: 1 }],
}

const NO_REQUESTS = { requests: 0, lines: 0, fires: { refuse: 0, override: 0, warn: 0 }, stopped: [], stoppedTotal: 0, sar: 0, distinct: { patients: 0, stores: 0, pharmacists: 0 }, overlap: 0, rules: [] }

/**
 * Start and read a back-test on an approval store (`store.backtests`), before `approvalStub`. Running on its first read, then
 * done. `opts.section`: what the job reports of monitors (null: a job that read no answers); `opts.guards`: false, nothing but monitors.
 */
export function monitorBacktestStub(method, path, body, store, { section = MONITOR_SECTION, guards = true } = {}) {
  const G = 'InsuranceRules/Guards/Backtests'
  if (method === 'GET' && path === `${G}/Windows`) return envelope({ days: [7, 30, 90, 180] })
  if (method === 'POST' && path === G) {
    const id = `BT-M${Object.keys(store.backtests).length + 1}`
    const done = { ...backtestReport(body?.days ?? 90, store.draft.revision, id), ...(guards ? {} : NO_REQUESTS), monitors: section }
    store.backtests[id] = { ...done, status: 'running', progress: 0.4, monitors: null, ...NO_REQUESTS, finishes: done }
    store.starts = [...(store.starts ?? []), body]
    return envelope(store.backtests[id])
  }
  const read = method === 'GET' && path === G
  if (read) {
    const rows = Object.values(store.backtests).reverse()
    const reply = envelope(rows)
    for (const [id, job] of Object.entries(store.backtests)) if (job.finishes) store.backtests[id] = job.finishes
    return reply
  }
  return null
}

/** The rule metrics, with a monitor's shadow fires. */
export function monitorMetricsStub(method, path) {
  if (method === 'GET' && path === 'InsuranceRules/Metrics') return envelope([{ key: 'M-002', shadowFires: 9, fires: { refuse: 0, override: 0, warn: 0 } }])
  return null
}
