/**
 * Ticket 615 — the `insurance-metrics` namespace ships English and Arabic together, each mirroring the other's
 * keys; every key the screen builds (tabs, per, outcomes, flag reasons, window refusals) exists in both, and
 * the area's menu names the Metrics leaf.
 */
import { describe, expect, it } from 'vitest'
import en from '@/locales/en/insurance-metrics.json'
import ar from '@/locales/ar/insurance-metrics.json'
import areaEn from '@/locales/en/insurance-rules.json'
import areaAr from '@/locales/ar/insurance-rules.json'
import { GUARD_FLAG_KINDS } from '@/core/insurance-rules/model'
import { METRICS_BY, METRICS_OUTCOMES, flagReason } from './model'
import { METRICS_TABS } from './query'

function leaves(node: unknown, prefix = ''): string[] {
  if (typeof node !== 'object' || node === null) return [prefix]
  return Object.entries(node).flatMap(([k, v]) => leaves(v, prefix ? `${prefix}.${k}` : k))
}
const at = (locale: unknown, key: string): unknown => key.split('.').reduce<unknown>((n, part) => (n as Record<string, unknown> | undefined)?.[part], locale)
const has = (locale: unknown, key: string): boolean => typeof at(locale, key) === 'string'

describe('insurance-metrics — en and ar mirror each other', () => {
  it('the same keys, and no plural family (no count is ever interpolated)', () => {
    expect(leaves(ar).sort()).toEqual(leaves(en).sort())
    expect(leaves(en).filter((k) => /_(one|other)$/.test(k))).toEqual([])
  })

  it('the same {{values}} and <tags> in each pair', () => {
    const marks = (s: string) => [...s.matchAll(/\{\{\w+\}\}|<\/?\w+>/g)].map((m) => m[0]).sort()
    for (const key of leaves(en)) expect([key, marks(String(at(ar, key)))]).toEqual([key, marks(String(at(en, key)))])
  })
})

describe('insurance-metrics — the keys the code builds exist', () => {
  const flag = (kind: (typeof GUARD_FLAG_KINDS)[number], o = {}) => ({ ruleId: 'G', name: { en: '', ar: '' }, kind, since: '2026-10-01', fires: 1, overridden: 1, previousAverage: 1, lastFired: '2026-10-01T00:00:00', ...o })
  it.each([en, ar])('tabs, per, columns, outcomes, flag reasons, window refusals', (locale) => {
    const keys = [
      ...METRICS_TABS.map((k) => `tabs.${k}`),
      ...METRICS_BY.flatMap((k) => [`by.${k}`, `columns.${k}`]),
      ...METRICS_OUTCOMES.map((k) => `outcome.${k}`),
      ...GUARD_FLAG_KINDS.flatMap((k) => [flagReason(flag(k)).key, flagReason(flag(k, { lastFired: null, previousAverage: 0 })).key]),
      ...['invalid', 'reversed', 'tooLong', 'outOfBounds'].map((k) => `window.${k}`),
    ]
    for (const key of keys) expect([key, has(locale, key)]).toEqual([key, true])
  })

  it.each([areaEn, areaAr])('the menu leaf', (locale) => {
    expect(has(locale, 'menu.metrics')).toBe(true)
  })
})
