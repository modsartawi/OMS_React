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
import { INDEX_GRAINS, INDEX_PERIODS, INDEX_TONES, PRICE_BASES } from './index-tab' // Index (938)

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
      // Index (938)
      ...INDEX_TONES.map((tone) => `index.tone.${tone}`),
      ...PRICE_BASES.flatMap((b) => [`index.basis.${b}`, `index.basisHint.${b}`]),
      ...INDEX_PERIODS.map((p) => `index.period.${p}`),
      ...INDEX_GRAINS.map((g) => `index.trend.grain.${g}`),
    ]
    for (const key of keys) expect([key, hasLocaleKey(locale, key)]).toEqual([key, true])
  })

  it('speaks the glossary: never "notification" or "mapping"', () => {
    expect(JSON.stringify(en)).not.toMatch(/notification|mapping/i)
    expect(JSON.stringify(en)).toMatch(/price alert/)
    expect(JSON.stringify(en)).toMatch(/product match/)
    expect(JSON.stringify(en)).toMatch(/competitor price/i)
    expect(JSON.stringify(en)).toMatch(/price index/) // 938
    expect(JSON.stringify(en)).toMatch(/lowest-price score/) // 938
  })
})
