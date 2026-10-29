/**
 * Ticket 671 (reconciled to the BackOffice 3201 door contract, 2026-10-29) — a change to a sent
 * promotion's name, stores, start or end is a **Replace**: `replaceNeeded` says when the form
 * differs from what was sent; the body carries ONLY what changed (`null` keeps the old value). Replace
 * and Switch off are offered on a sent promotion that runs, disabled while it reads Sending; a
 * switch-off that FAILED (switched off / replaced, reading Failed) offers Switch off again — it
 * retries the parts still on HungerStation.
 */
import { describe, expect, it } from 'vitest'
import type { HungerStationPromotionDetail } from '@/core/models/hungerstation'
import { promotionActions, replaceBody, replaceFormFromDetail, replaceNeeded, replaceProblems } from './replace-form'

type Sent = Pick<HungerStationPromotionDetail, 'name' | 'startAt' | 'endAt' | 'stores'>

const sent: Sent = {
  name: 'Ramadan',
  startAt: '2026-11-01T00:00:00',
  endAt: '2026-11-30T23:59:00',
  stores: [
    { storeCode: '1001', storeName: 'A', vendorId: 'v-1', syncActive: true },
    { storeCode: '1002', storeName: 'B', vendorId: 'v-2', syncActive: true },
  ],
}

describe('replaceFormFromDetail', () => {
  it('starts from what was sent: the name, the window in its four boxes, the stores as sent', () => {
    expect(replaceFormFromDetail(sent)).toEqual({
      name: 'Ramadan',
      window: { startDate: '2026-11-01', startTime: '00:00', endDate: '2026-11-30', endTime: '23:59' },
      stores: ['1001', '1002'],
    })
  })
})

describe('replaceNeeded — true exactly when name, stores, start or end differ from what was sent', () => {
  const form = () => replaceFormFromDetail(sent)

  it('the form as sent needs no replace', () => {
    expect(replaceNeeded(sent, form())).toBe(false)
  })

  it('the name changed (blanks around it do not count)', () => {
    expect(replaceNeeded(sent, { ...form(), name: 'Ramadan 2' })).toBe(true)
    expect(replaceNeeded(sent, { ...form(), name: '  Ramadan ' })).toBe(false)
  })

  it('the start or the end changed', () => {
    expect(replaceNeeded(sent, { ...form(), window: { ...form().window, startTime: '08:00' } })).toBe(true)
    expect(replaceNeeded(sent, { ...form(), window: { ...form().window, endDate: '2026-12-15' } })).toBe(true)
  })

  it('a store added or removed; the same stores in another order are no change', () => {
    expect(replaceNeeded(sent, { ...form(), stores: ['1001'] })).toBe(true)
    expect(replaceNeeded(sent, { ...form(), stores: ['1001', '1002', '2001'] })).toBe(true)
    expect(replaceNeeded(sent, { ...form(), stores: ['1002', '1001'] })).toBe(false)
  })
})

describe('replaceProblems', () => {
  const now = new Date('2026-10-29T11:00:00+03:00')
  it('a blank name, a bad window, no store', () => {
    const f = replaceFormFromDetail(sent)
    expect(replaceProblems(f, now)).toEqual([])
    expect(replaceProblems({ ...f, name: ' ', stores: [], window: { ...f.window, endDate: '2026-10-01' } }, now)).toEqual(['name', 'window', 'stores'])
  })
})

describe('replaceBody — POST …/Replace carries only what changed', () => {
  it('a new name and new stores: those, the window kept (null), the reason trimmed', () => {
    const f = { ...replaceFormFromDetail(sent), name: ' Ramadan v2 ', stores: ['1002', '2001'] }
    expect(replaceBody(sent, f, ' moved to Dec ')).toEqual({
      name: 'Ramadan v2',
      startAt: null,
      endAt: null,
      allStores: null,
      storeCodes: ['1002', '2001'],
      reason: 'moved to Dec',
    })
  })

  it('only the end changed: the end, everything else null (the stores as frozen)', () => {
    const f = replaceFormFromDetail(sent)
    expect(replaceBody(sent, { ...f, window: { ...f.window, endDate: '2026-12-15' } }, 'r')).toEqual({
      name: null,
      startAt: null,
      endAt: '2026-12-15T23:59:00',
      allStores: null,
      storeCodes: null,
      reason: 'r',
    })
  })

  it('the same stores in another order are kept (null)', () => {
    const f = { ...replaceFormFromDetail(sent), name: 'x', stores: ['1002', '1001'] }
    expect(replaceBody(sent, f, 'r').storeCodes).toBeNull()
  })
})

describe('promotionActions — Replace and Switch off', () => {
  const of = (status: HungerStationPromotionDetail['status'], over: Partial<HungerStationPromotionDetail> = {}) =>
    promotionActions({ status, parts: [{ status: 'live' }], switchedOffAt: null, replacedByPromotionId: null, ...over } as Parameters<typeof promotionActions>[0])

  it('both offered on a sent promotion that still runs', () => {
    for (const s of ['live', 'livePartlyRefused', 'failed', 'scheduled'] as const) expect(of(s)).toEqual({ replace: true, switchOff: true, sending: false })
  })

  it('neither offered on a draft, nor once switched off, replaced or ended', () => {
    for (const s of ['draft', 'switchedOff', 'replaced', 'ended'] as const) expect(of(s)).toMatchObject({ replace: false, switchOff: false })
  })

  it('disabled while it reads Sending (a switch-off’s jobs included)', () => {
    expect(of('sending')).toEqual({ replace: true, switchOff: true, sending: true })
    expect(of('live', { parts: [{ status: 'live' }, { status: 'sending' }] as HungerStationPromotionDetail['parts'] }).sending).toBe(true)
  })

  it('a switch-off still being answered offers nothing more', () => {
    expect(of('sending', { switchedOffAt: '2026-10-29T11:00:00' })).toMatchObject({ replace: false, switchOff: false })
  })

  it('a switch-off that failed (switched off or replaced, reading Failed): Switch off again retries it; no Replace', () => {
    expect(of('failed', { switchedOffAt: '2026-10-29T11:00:00' })).toEqual({ replace: false, switchOff: true, sending: false })
    expect(of('failed', { switchedOffAt: '2026-10-29T11:00:00', replacedByPromotionId: 'p-2' })).toEqual({ replace: false, switchOff: true, sending: false })
  })
})
