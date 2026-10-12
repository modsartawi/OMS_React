/**
 * Ticket 481 — a Deliverect store's status: the busy / close / reopen body (a delay for busy ONLY,
 * a positive whole number), which action a state offers, the week of hours that was pushed with an
 * overnight shift read as "next day" in English AND Arabic (one string, `formatRange`), and the
 * history's action and day words.
 */
import i18next from 'i18next'
import { describe, expect, it } from 'vitest'
import en from '@/locales/en/deliverect-stores.json'
import ar from '@/locales/ar/deliverect-stores.json'
import { FSI, PDI } from '@/core/util/bidi'
import {
  STATUS_ACTIONS,
  actionOffered,
  dayKey,
  historyActionKey,
  hoursLabel,
  parseDelay,
  statusBody,
} from './store-status'

const instance = i18next.createInstance()
instance.init({
  lng: 'en',
  resources: { en: { 'deliverect-stores': en }, ar: { 'deliverect-stores': ar } },
  ns: ['deliverect-stores'],
  defaultNS: 'deliverect-stores',
  initAsync: false,
})
const tEn = instance.getFixedT('en', 'deliverect-stores')
const tAr = instance.getFixedT('ar', 'deliverect-stores')

describe('parseDelay — a positive whole number of minutes', () => {
  it.each([
    ['15', 15],
    [' 30 ', 30],
    ['1', 1],
    ['120', 120],
  ])('%j reads %d', (text, n) => expect(parseDelay(text)).toBe(n))

  it.each(['', '  ', '0', '-5', '1.5', '15m', 'abc', '١٥', '1e2', '00'])('%j is refused', (text) => {
    expect(parseDelay(text)).toBeNull()
  })
})

describe('statusBody — what the door is sent', () => {
  it('busy carries its delay', () => {
    expect(statusBody('busy', '15', 'Rush')).toEqual({ action: 'busy', delayMinutes: 15, reason: 'Rush' })
  })

  it('🚩 busy with no valid delay is not sendable', () => {
    expect(statusBody('busy', '', 'Rush')).toBeNull()
    expect(statusBody('busy', '0', 'Rush')).toBeNull()
  })

  it.each(['close', 'reopen'] as const)('🚩 %s NEVER carries delayMinutes, whatever the field holds', (action) => {
    const body = statusBody(action, '15', 'Done')
    expect(body).toEqual({ action, reason: 'Done' })
    expect(body && 'delayMinutes' in body).toBe(false)
  })

  it('the three actions, in the order the dialog offers them', () => {
    expect(STATUS_ACTIONS).toEqual(['busy', 'close', 'reopen'])
  })
})

describe('actionOffered — the state the store is in', () => {
  it('an open store cannot be reopened', () => {
    expect(STATUS_ACTIONS.filter((a) => actionOffered('open', a))).toEqual(['busy', 'close'])
  })
  it('a busy store can change its delay, close or reopen', () => {
    expect(STATUS_ACTIONS.filter((a) => actionOffered('busy', a))).toEqual(['busy', 'close', 'reopen'])
  })
  it('🚩 a closed store is offered reopen ONLY — busy would open it again without a Reopen', () => {
    expect(STATUS_ACTIONS.filter((a) => actionOffered('closed', a))).toEqual(['reopen'])
  })
  it('a state the contract does not name, or no status, offers everything — the server decides', () => {
    expect(STATUS_ACTIONS.filter((a) => actionOffered('paused', a))).toEqual(['busy', 'close', 'reopen'])
    expect(STATUS_ACTIONS.filter((a) => actionOffered(null, a))).toEqual(['busy', 'close', 'reopen'])
  })
})

describe('hoursLabel — one string per day, isolated once by the caller', () => {
  it('a same-day shift is the plain range', () => {
    expect(hoursLabel(tEn, { day: 'SUN', open: '08:00', close: '23:00', overnight: false })).toBe('08:00–23:00')
  })

  it('🚩 an overnight shift reads "next day" in English', () => {
    const label = hoursLabel(tEn, { day: 'SUN', open: '08:00', close: '02:00', overnight: true })
    expect(label).toBe(`${FSI}08:00–02:00${PDI} next day`)
  })

  it('🚩 an overnight shift reads "next day" in Arabic', () => {
    const label = hoursLabel(tAr, { day: 'SUN', open: '08:00', close: '02:00', overnight: true })
    expect(label).toBe(`${FSI}08:00–02:00${PDI} اليوم التالي`)
  })

  it('🚩 the range is ONE value — never two isolates around its ends', () => {
    const label = hoursLabel(tEn, { day: 'MON', open: '20:00', close: '04:00', overnight: true })
    expect(label.split(FSI)).toHaveLength(2)
    expect(label).toContain('20:00–04:00')
  })
})

describe('the words the history and the hours table use', () => {
  it('the contract days map to keys; anything else is shown as sent', () => {
    expect(['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map(dayKey)).toEqual([
      'sun',
      'mon',
      'tue',
      'wed',
      'thu',
      'fri',
      'sat',
    ])
    expect(dayKey('Sunday')).toBeNull()
  })

  it('busy / close / reopen are words; any other action (the hours push) is shown as sent', () => {
    expect(['busy', 'close', 'reopen'].map(historyActionKey)).toEqual(['busy', 'close', 'reopen'])
    expect(historyActionKey('hours')).toBeNull()
  })

  it.each([
    ['en', en],
    ['ar', ar],
  ])('every key the module builds exists in %s', (_, locale) => {
    const days = locale.hours.days as Record<string, string>
    for (const d of ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']) expect([d, typeof days[d]]).toEqual([d, 'string'])
    const actions = locale.statusAction.actions as Record<string, string>
    for (const a of STATUS_ACTIONS) expect([a, typeof actions[a]]).toEqual([a, 'string'])
  })
})
