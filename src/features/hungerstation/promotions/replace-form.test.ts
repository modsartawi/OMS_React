/**
 * Ticket 671 — a change to a sent promotion's name, stores, start or end is a **Replace**
 * (BackOffice 3216): `replaceNeeded` says when the form differs from what was sent, the body is
 * the contract's `HungerStationPromotionReplaceBody`, and Replace / Switch off are offered on a
 * sent promotion but disabled while any part is Sending.
 */
import { describe, expect, it } from 'vitest'
import type { HungerStationPromotionDetail, HungerStationPromotionPart } from '@/core/models/hungerstation'
import { promotionActions, replaceBody, replaceFormFromDetail, replaceNeeded, replaceProblems, replaceRefusalOf } from './replace-form'

type Sent = Pick<HungerStationPromotionDetail, 'name' | 'startAt' | 'endAt' | 'stores'>

const sent: Sent = {
  name: 'Ramadan',
  startAt: '2026-11-01T00:00:00',
  endAt: '2026-11-30T23:59:00',
  stores: [
    { storeCode: '1001', storeName: 'A', vendorId: 'v-1' },
    { storeCode: '1002', storeName: 'B', vendorId: 'v-2' },
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

  it('a sent time with or without seconds compares as the same minute', () => {
    expect(replaceNeeded({ ...sent, startAt: '2026-11-01T00:00' }, form())).toBe(false)
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

describe('replaceBody — POST …/Replace', () => {
  it('the trimmed name, the wall-time window, the ticked stores, the reason', () => {
    const f = { ...replaceFormFromDetail(sent), name: ' Ramadan v2 ', stores: ['1002', '2001'] }
    expect(replaceBody(f, ' moved to Dec ')).toEqual({
      name: 'Ramadan v2',
      startAt: '2026-11-01T00:00:00',
      endAt: '2026-11-30T23:59:00',
      allStores: false,
      storeCodes: ['1002', '2001'],
      reason: 'moved to Dec',
    })
  })
})

describe('promotionActions — Replace and Switch off', () => {
  const part = (over: Partial<HungerStationPromotionPart> = {}) =>
    ({ partId: 'pt', active: true, latestJobStatus: 'COMPLETED', unanswered: false, ...over }) as HungerStationPromotionPart
  const of = (status: HungerStationPromotionDetail['status'], parts = [part()]) => promotionActions({ status, parts })

  it('offered on a sent promotion that still runs', () => {
    for (const s of ['live', 'livePartlyRefused', 'failed', 'scheduled'] as const) expect(of(s)).toEqual({ offered: true, sending: false })
  })

  it('not offered on a draft, nor once switched off, replaced or ended', () => {
    for (const s of ['draft', 'switchedOff', 'replaced', 'ended'] as const) expect(of(s).offered).toBe(false)
  })

  it('disabled while ANY part is Sending — an unanswered part (24 h) is not Sending', () => {
    expect(of('live', [part(), part({ latestJobStatus: 'QUEUED' })])).toEqual({ offered: true, sending: true })
    expect(of('sending', [part({ latestJobStatus: 'QUEUED' })])).toEqual({ offered: true, sending: true })
    expect(of('live', [part({ latestJobStatus: 'QUEUED', unanswered: true })]).sending).toBe(false)
  })
})

describe('replaceRefusalOf — the part a refused switch-off names (DHS-00020 data)', () => {
  it('reads the part id and name', () => {
    expect(replaceRefusalOf({ partId: 'pt-b', name: 'Eid · B2G1 50%', httpStatus: 422, error: 'vendor locked' })).toEqual({
      partId: 'pt-b',
      name: 'Eid · B2G1 50%',
      httpStatus: 422,
      error: 'vendor locked',
    })
  })
  it('anything else is no part (the server message still shows)', () => {
    expect(replaceRefusalOf(null)).toBeNull()
    expect(replaceRefusalOf({ name: 'x' })).toBeNull()
    expect(replaceRefusalOf({ partId: 'pt-b' })).toEqual({ partId: 'pt-b', name: null, httpStatus: null, error: null })
  })
})
