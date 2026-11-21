/**
 * oms 934 — `price-command-center` ships English and Arabic together, the Arabic mirroring the English keys exactly, and
 * every key the screen builds from data (a tab, a state, a status, a dismissal reason or problem) and the gate's sentences
 * exist in both. The glossary holds: price alert, product match, competitor price — never "notification" or "mapping".
 */
import { describe, expect, it } from 'vitest'
import en from '@/locales/en/price-command-center.json'
import ar from '@/locales/ar/price-command-center.json'
import { DISMISS_REASONS } from '@/core/models/price-watch'
import { hasLocaleKey } from '@/core/test/locale'
import { ALERT_STATES } from './alerts'
import { TAB_IDS } from './tabs'
// Feed health (939)
import { PRICE_SOURCES } from '@/core/models/price-watch'
import { RUN_STATES } from './feed-health'

const leaves = (node: unknown, prefix = ''): string[] =>
  typeof node !== 'object' || node === null ? [prefix] : Object.entries(node).flatMap(([k, v]) => leaves(v, prefix ? `${prefix}.${k}` : k))

describe('price-command-center — en and ar', () => {
  it('mirror each other', () => {
    expect(leaves(ar).sort()).toEqual(leaves(en).sort())
  })

  it.each([en, ar])('hold every key the screen builds', (locale) => {
    const keys = [
      ...TAB_IDS.map((id) => `tabs.${id}`),
      ...ALERT_STATES.map((s) => `alerts.state.${s}`),
      ...['OPEN', 'ACCEPTED', 'DISMISSED', 'RESOLVED', 'unknown'].map((s) => `alerts.status.${s}`),
      ...['mine', 'all'].map((s) => `alerts.scope.${s}`),
      ...['mine', 'all'].map((s) => `alerts.empty.${s}`),
      ...DISMISS_REASONS.map((r) => `dismiss.reason.${r}`),
      ...['reasonRequired', 'noteRequired', 'noteTooLong'].map((p) => `dismiss.problem.${p}`),
      ...['checking', 'deniedTitle', 'deniedHint', 'unreachableTitle', 'unreachableHint'].map((a) => `access.${a}`),
      // Feed health (939)
      ...PRICE_SOURCES.flatMap((s) => [`feedHealth.source.${s}`, `feedHealth.change.whose.${s}`, `feedHealth.change.other.${s}`]),
      ...RUN_STATES.map((s) => `feedHealth.runState.${s}`),
      ...['DAILY', 'INTRADAY', 'MANUAL'].map((p) => `feedHealth.pass.${p}`),
      ...['ok', 'running', 'failures', 'error'].map((s) => `feedHealth.job.state.${s}`),
    ]
    for (const key of keys) expect([key, hasLocaleKey(locale, key)]).toEqual([key, true])
  })

  it('speaks the glossary: never "notification" or "mapping"', () => {
    expect(JSON.stringify(en)).not.toMatch(/notification|mapping/i)
    expect(JSON.stringify(en)).toMatch(/price alert/)
    expect(JSON.stringify(en)).toMatch(/product match/)
    expect(JSON.stringify(en)).toMatch(/competitor price/i)
  })
})
