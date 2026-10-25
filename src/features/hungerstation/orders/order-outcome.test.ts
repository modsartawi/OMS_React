/**
 * Ticket 556 — the four HungerStation order outcomes in words, the `unmatched` alert worded as
 * "onboard the store" (never "retry"), and a delivery's run read as done / waiting / stopped, or as
 * an intake that failed before any run was written.
 */
import { describe, expect, it } from 'vitest'
import en from '@/locales/en/hungerstation-orders.json'
import ar from '@/locales/ar/hungerstation-orders.json'
import { alertLabel, outcomeLabel, runLabel } from './order-outcome'

const at = (locale: unknown, key: string) => key.split('.').reduce<unknown>((n, part) => (n as Record<string, unknown> | undefined)?.[part], locale)

describe('outcomeLabel', () => {
  it.each([
    ['created', 'outcomes.created', 'ok'],
    ['cancelled', 'outcomes.cancelled', 'mute'],
    ['failed', 'outcomes.failed', 'bad'],
    ['pending', 'outcomes.pending', 'go'],
  ] as const)('%s → %s (%s)', (outcome, key, sev) => {
    expect(outcomeLabel(outcome)).toEqual({ key, sev })
  })

  it.each([en, ar])('each outcome’s words exist in the locale', (locale) => {
    for (const o of ['created', 'cancelled', 'failed', 'pending']) expect([o, typeof at(locale, outcomeLabel(o).key!)]).toEqual([o, 'string'])
  })

  it('English words: Created, Cancelled, Failed, Pending', () => {
    expect(['created', 'cancelled', 'failed', 'pending'].map((o) => at(en, outcomeLabel(o).key!))).toEqual(['Created', 'Cancelled', 'Failed', 'Pending'])
  })

  it('an outcome the contract does not name is shown raw, neutral — not a prototype key either', () => {
    expect(outcomeLabel('refused')).toEqual({ key: null, sev: 'mute' })
    expect(outcomeLabel('constructor')).toEqual({ key: null, sev: 'mute' })
  })
})

describe('alertLabel', () => {
  it('no alert, no words', () => {
    expect(alertLabel(null)).toBeNull()
  })

  it('🚩 unmatched names its action: onboard (or revive) the store — never retry', () => {
    const label = alertLabel('unmatched')!
    expect(label).toEqual({ badge: 'alert.unmatched.badge', title: 'alert.unmatched.title', hint: 'alert.unmatched.hint', action: 'alert.unmatched.action' })
    expect(at(en, label.badge)).toBe('Store not onboarded')
    expect(String(at(en, label.hint))).toMatch(/onboard/i)
    expect(String(at(en, label.hint))).toMatch(/reviv/i)
    expect(String(at(en, label.action!))).toMatch(/stores/i)
    expect(JSON.stringify([at(en, label.badge), at(en, label.title), at(en, label.action!)])).not.toMatch(/retry/i)
  })

  it('an alert the contract does not name reads as a generic "needs a person", never blank', () => {
    expect(alertLabel('somethingNew')).toEqual({ badge: 'alert.other.badge', title: 'alert.other.title', hint: 'alert.other.hint', action: null })
  })

  it.each([en, ar])('every alert key exists in the locale', (locale) => {
    for (const label of [alertLabel('unmatched')!, alertLabel('x')!])
      for (const key of [label.badge, label.title, label.hint, label.action].filter((k): k is string => k !== null))
        expect([key, typeof at(locale, key)]).toEqual([key, 'string'])
  })
})

describe('runLabel', () => {
  it.each([
    ['C', 'runs.done', 'ok'],
    ['P', 'runs.waiting', 'go'],
    ['F', 'runs.stopped', 'bad'],
  ] as const)('%s → %s (%s)', (status, key, sev) => {
    expect(runLabel({ status })).toEqual({ key, sev, raw: null })
  })

  it('🚩 no run: the intake failed before a run was written', () => {
    expect(runLabel(null)).toEqual({ key: 'runs.none', sev: 'bad', raw: null })
    expect(at(en, 'runs.none')).toBe('Intake failed before a run was written')
  })

  it('a status the contract does not name is shown raw, neutral', () => {
    expect(runLabel({ status: 'R' })).toEqual({ key: null, sev: 'mute', raw: 'R' })
  })

  it.each([en, ar])('every run key exists in the locale', (locale) => {
    for (const key of ['runs.done', 'runs.waiting', 'runs.stopped', 'runs.none']) expect([key, typeof at(locale, key)]).toEqual([key, 'string'])
  })
})
