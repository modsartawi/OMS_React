/**
 * Ticket 611 — the `insurance-approvals` namespace ships English and Arabic together, the Arabic mirroring the
 * English keys exactly; every key the code builds (draft states, actions, refusals, promote refusals) exists in
 * both, with the area's Approvals menu label.
 */
import { describe, expect, it } from 'vitest'
import en from '@/locales/en/insurance-approvals.json'
import ar from '@/locales/ar/insurance-approvals.json'
import areaEn from '@/locales/en/insurance-rules.json'
import areaAr from '@/locales/ar/insurance-rules.json'
import { hasLocaleKey } from '@/core/test/locale'
import { BACKTEST_STATUSES } from '@/core/insurance-rules/backtest'

function leaves(node: unknown, prefix = ''): string[] {
  if (typeof node !== 'object' || node === null) return [prefix]
  return Object.entries(node).flatMap(([k, v]) => leaves(v, prefix ? `${prefix}.${k}` : k))
}

describe('insurance-approvals — en and ar mirror each other', () => {
  it('the same keys (no plurals)', () => {
    expect(leaves(ar).sort()).toEqual(leaves(en).sort())
    expect(leaves(en).filter((k) => /_(one|other|zero|two|few|many)$/.test(k))).toEqual([])
  })
})

describe('insurance-approvals — the keys the code builds exist', () => {
  it.each([en, ar])('states, actions, refusals, standings', (locale) => {
    expect(BACKTEST_STATUSES).toContain('done')
    const keys = [
      ...['draft', 'waiting'].map((s) => `draft.state.${s}`),
      ...['submit', 'approve', 'sendBack'].flatMap((a) => [`action.${a}`, `done.${a}`]),
      ...['noBacktest', 'backtestRunning', 'backtestFailed', 'backtestStale', 'checking', 'checks', 'ownSubmission'].map((w) => `why.${w}`),
      ...['none', 'running', 'failed', 'stale', 'current'].map((s) => `backtest.${s}`),
      ...['notShadow', 'notApprover', 'reason'].map((w) => `shadow.why.${w}`),
    ]
    for (const key of keys) expect([key, hasLocaleKey(locale, key)]).toEqual([key, true])
  })
  it.each([areaEn, areaAr])('the menu label', (locale) => {
    expect(hasLocaleKey(locale, 'menu.approvals')).toBe(true)
  })
})
