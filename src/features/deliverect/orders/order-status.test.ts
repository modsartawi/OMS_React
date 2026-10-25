/**
 * Ticket 478 — every status code the contract names has its words, an unknown one shows raw and
 * neutral, a 126 needs a person, and Retry is offered for the two failed outcomes only.
 */
import { describe, expect, it } from 'vitest'
import en from '@/locales/en/deliverect-orders.json'
import ar from '@/locales/ar/deliverect-orders.json'
import { ORDER_STATUS, documentPath, needsPerson, outcomeLabel, retryOffered, statusLabel } from './order-status'
import { ORDER_OUTCOMES } from './orders-query'

const has = (locale: unknown, key: string) =>
  typeof key.split('.').reduce<unknown>((n, part) => (n as Record<string, unknown> | undefined)?.[part], locale) === 'string'

describe('statusLabel', () => {
  it('the contract’s five codes: 20, 90, 110, 120, 126', () => {
    expect(Object.values(ORDER_STATUS).sort((a, b) => a - b)).toEqual([20, 90, 110, 120, 126])
  })

  it.each([
    [20, 'statuses.accepted', 'ok'],
    [90, 'statuses.finalized', 'ok'],
    [110, 'statuses.cancelled', 'mute'],
    [120, 'statuses.failed', 'bad'],
    [126, 'statuses.cancelFailed', 'bad'],
  ] as const)('%i → %s (%s)', (code, key, sev) => {
    expect(statusLabel(code)).toEqual({ key, code, sev })
  })

  it.each([en, ar])('every contract code’s key exists in the locale', (locale) => {
    for (const code of Object.values(ORDER_STATUS)) {
      const key = statusLabel(code).key!
      expect([key, has(locale, key)]).toEqual([key, true])
    }
  })

  it('a code the contract does not name has no key — shown as its raw number, neutral', () => {
    expect(statusLabel(100)).toEqual({ key: null, code: 100, sev: 'mute' })
  })
})

describe('needsPerson', () => {
  it('only a 126 (a cancel after invoicing)', () => {
    expect(needsPerson(126)).toBe(true)
    for (const code of [20, 90, 110, 120, null, undefined]) expect(needsPerson(code)).toBe(false)
  })
})

describe('outcomes', () => {
  it.each([en, ar])('every contract outcome has its words', (locale) => {
    for (const o of ORDER_OUTCOMES) {
      const key = outcomeLabel(o).key!
      expect([key, has(locale, key)]).toEqual([key, true])
    }
  })

  it('refused and statusFailed are bad, droppedLines a warning, cancelled neutral, created ok', () => {
    expect(ORDER_OUTCOMES.map((o) => outcomeLabel(o).sev)).toEqual(['ok', 'bad', 'warn', 'mute', 'bad'])
  })

  it('an outcome the contract does not name is raw, neutral', () => {
    expect(outcomeLabel('lost')).toEqual({ key: null, sev: 'mute' })
    // Not a prototype key either.
    expect(outcomeLabel('constructor')).toEqual({ key: null, sev: 'mute' })
  })

  it('🚩 Retry is offered for refused and statusFailed ONLY', () => {
    expect(ORDER_OUTCOMES.filter(retryOffered)).toEqual(['refused', 'statusFailed'])
    expect(retryOffered('lost')).toBe(false)
  })
})

describe('documentPath', () => {
  it('opens the document page, the number encoded', () => {
    expect(documentPath('4500012345')).toBe('/oms/document/4500012345')
    expect(documentPath('A/1')).toBe('/oms/document/A%2F1')
  })
})
