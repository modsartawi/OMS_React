/**
 * Ticket 677 — the `insurance-playground` namespace ships English and Arabic together, each mirroring the other's
 * keys; every key the page builds (the boxes' problems, trace values, outcome words, the no-access words) exists in
 * both, and the area's menu names the Playground leaf.
 */
import { describe, expect, it } from 'vitest'
import en from '@/locales/en/insurance-playground.json'
import ar from '@/locales/ar/insurance-playground.json'
import areaEn from '@/locales/en/insurance-rules.json'
import areaAr from '@/locales/ar/insurance-rules.json'
import { hasLocaleKey, localeAt } from '@/core/test/locale'
import type { DataTab, ExperimentBox } from './experiment'

function leaves(node: unknown, prefix = ''): string[] {
  if (typeof node !== 'object' || node === null) return [prefix]
  return Object.entries(node).flatMap(([k, v]) => leaves(v, prefix ? `${prefix}.${k}` : k))
}

const BOXES: readonly ExperimentBox[] = ['data', 'document']
const DATA_TABS: readonly DataTab[] = ['json', 'raw']

describe('insurance-playground — en and ar mirror each other', () => {
  it('the same keys, and no plural family', () => {
    expect(leaves(ar).sort()).toEqual(leaves(en).sort())
    expect(leaves(en).filter((k) => /_(zero|one|two|few|many|other)$/.test(k))).toEqual([])
  })

  it('the same {{values}} in each pair', () => {
    const marks = (s: string) => [...s.matchAll(/\{\{\w+\}\}|<\/?\w+>/g)].map((m) => m[0]).sort()
    for (const key of leaves(en)) expect([key, marks(String(localeAt(ar, key)))]).toEqual([key, marks(String(localeAt(en, key)))])
  })
})

describe('insurance-playground — the keys the code builds exist', () => {
  it.each([en, ar])('boxes, trace values, outcome, access', (locale) => {
    const keys = [
      'title',
      'lede',
      'access.deniedTitle',
      'access.deniedHint',
      'run.run',
      'run.running',
      ...BOXES.map((b) => `json.problem.${b}`),
      // 684: the Data pane's tabs and the Raw experiment's intake report
      ...['tabs.label', 'rawHint', ...DATA_TABS.map((k) => `tabs.${k}`)].map((k) => `data.${k}`),
      ...['title', 'hint', 'ignored', 'didYouMean', 'refused', 'expected', 'read'].map((k) => `intake.${k}`),
      ...['true', 'false', 'unknown'].map((v) => `trace.value.${v}`),
      ...['title', 'empty', 'failed', 'refused', 'tabs.label', 'tabs.saw', 'nothingMatched', 'matchedLines', 'line', 'matched', 'notMatched', 'errors.title'].map((k) => `outcome.${k}`),
    ]
    for (const key of keys) expect([key, hasLocaleKey(locale, key)]).toEqual([key, true])
  })

  it.each([areaEn, areaAr])('the menu leaf', (locale) => {
    expect(hasLocaleKey(locale, 'menu.playground')).toBe(true)
  })
})
