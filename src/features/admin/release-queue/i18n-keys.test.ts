/**
 * Ticket 791 — the `release-queue` namespace ships English and Arabic together: the same keys (plural forms aside,
 * Arabic has six), and every key the code builds exists in both.
 */
import { describe, expect, it } from 'vitest'
import en from '@/locales/en/release-queue.json'
import ar from '@/locales/ar/release-queue.json'
import { hasLocaleKey as has } from '@/core/test/locale'
import { OUTCOME_FILTERS, RELEASE_QUEUE_TABS } from './helpers'

const PLURAL = /_(zero|one|two|few|many|other)$/

function leaves(node: unknown, prefix = ''): string[] {
  if (typeof node !== 'object' || node === null) return [prefix]
  return Object.entries(node).flatMap(([k, v]) => leaves(v, prefix ? `${prefix}.${k}` : k))
}

const base = (bundle: unknown) => [...new Set(leaves(bundle).map((k) => k.replace(PLURAL, '')))].sort()

describe('release-queue — en and ar mirror each other', () => {
  it('the same keys, plural forms aside', () => {
    expect(base(ar)).toEqual(base(en))
  })

  it('Arabic carries all six plural forms wherever English counts', () => {
    const counted = leaves(en).filter((k) => k.endsWith('_other')).map((k) => k.replace(PLURAL, ''))
    for (const key of counted)
      for (const form of ['zero', 'one', 'two', 'few', 'many', 'other']) expect([key, form, has(ar, `${key}_${form}`)]).toEqual([key, form, true])
  })
})

describe('release-queue — the keys the code builds exist', () => {
  it.each([en, ar])('every tab, outcome, package and the gate', (locale) => {
    const keys = [
      ...RELEASE_QUEUE_TABS.map((tab) => `tabs.${tab}`),
      ...OUTCOME_FILTERS.map((o) => `history.filterOutcome.${o}`),
      ...['done', 'failed', 'expired', 'freed'].map((o) => `history.outcome.${o}`),
      ...['downloaded', 'downloading', 'waiting'].map((s) => `convergence.${s}`),
      'package.pos',
      'package.dashboard',
      ...['checking', 'deniedTitle', 'deniedHint', 'unreachableTitle', 'unreachableHint'].map((k) => `access.${k}`),
    ]
    for (const key of keys) expect([key, has(locale, key)]).toEqual([key, true])
  })
})
