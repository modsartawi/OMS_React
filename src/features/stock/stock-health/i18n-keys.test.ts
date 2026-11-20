/**
 * oms 912 — the `stock-health` namespace ships English and Arabic together, and the Arabic file mirrors the English keys
 * exactly. Every key the page builds from data (a signal, a verdict, a tone) exists in both.
 */
import { describe, expect, it } from 'vitest'
import en from '@/locales/en/stock-health.json'
import ar from '@/locales/ar/stock-health.json'
import { STOCK_HEALTH_KEYS, STOCK_HEALTH_VERDICTS } from '@/core/models/stock-health'

/** Every leaf key, dotted. */
function leaves(node: unknown, prefix = ''): string[] {
  if (typeof node !== 'object' || node === null) return [prefix]
  return Object.entries(node).flatMap(([k, v]) => leaves(v, prefix ? `${prefix}.${k}` : k))
}

const has = (locale: unknown, key: string) =>
  key.split('.').reduce<unknown>((n, part) => (n as Record<string, unknown> | undefined)?.[part], locale) !== undefined

describe('stock-health — en and ar mirror each other', () => {
  it('the same keys', () => {
    expect(leaves(ar).sort()).toEqual(leaves(en).sort())
  })

  it('every English reason is the server line itself, and every English figure label is itself', () => {
    for (const [key, verdicts] of Object.entries(en.reason))
      for (const [verdict, text] of Object.entries(verdicts)) expect([key, verdict, text]).toEqual([key, verdict, '{{reason}}'])
    for (const labels of Object.values(en.figure)) for (const [label, text] of Object.entries(labels)) expect(text).toBe(label)
  })
})

describe('stock-health — the keys the page builds exist', () => {
  it.each([en, ar])('every signal name, verdict word, header and access sentence', (locale) => {
    const keys = [
      ...STOCK_HEALTH_KEYS.map((k) => `signal.${k}`),
      ...[...STOCK_HEALTH_VERDICTS, 'none'].map((v) => `verdict.${v}`),
      ...STOCK_HEALTH_KEYS.map((k) => `reason.${k}.noAnswer`),
      ...['allGood', 'attention', 'empty', 'asOf', 'loading'].map((h) => `header.${h}`),
      ...['checking', 'deniedTitle', 'deniedHint', 'unreachableTitle', 'unreachableHint'].map((a) => `access.${a}`),
      'menu.stockHealth',
      'title',
      'subtitle',
      'refresh',
      'refreshing',
      'failedTitle',
      'failed',
      'tile.opens',
    ]
    for (const key of keys) expect([key, has(locale, key)]).toEqual([key, true])
  })
})
