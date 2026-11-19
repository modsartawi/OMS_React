/**
 * Oms 922 — the pattern calls at the `@/core/api` boundary: what is sent, and what of the answer is kept. The answers
 * are read field by field, so a field nobody agreed to — above all a patient's identity — never reaches the query
 * cache, whatever the server sends (ticket 922 Boundaries: no patient field exists in the models at all).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }))
vi.mock('@/core/api', async (actual) => ({ ...(await actual<typeof import('@/core/api')>()), api }))

const { patternsApi, MarkNotSentError, caseKey, casesKey, PATTERNS_KEY } = await import('./api')

const ROW = {
  caseId: '01JD3K7Q2W',
  caseNumber: 'PC-000123',
  stores: [
    { storeCode: '1001', storeName: 'Olaya' },
    { storeCode: '2040', storeName: 'Buraydah Central' },
  ],
  dispenseCount: 4,
  openedAt: '2026-11-10T09:15:00',
  lastDispenseAt: '2026-11-12T18:40:00',
  closedAt: '0001-01-01T00:00:00',
  spanMinutes: 3445,
  longestLegKm: 312.4,
  shortestGapMinutes: 100,
  signals: ['travel', 'hopping'],
  score: 4,
  severity: 'action',
  status: 'open',
  totalValue: 1840.5,
}

/** A detail answer as a careless server might send it: three identity fields where none belongs. */
const DETAIL_WITH_IDENTITY = {
  ...ROW,
  patientKey: 'NI:1012345678',
  memberId: 'M-998877',
  policyNumber: 'POL-1',
  stores: [
    { storeCode: '1001', storeName: 'Olaya', lat: 24.6943, lon: 46.6853 },
    { storeCode: '2040', storeName: 'Buraydah Central', lat: 26.326, lon: 43.975, patientKey: 'NI:1012345678' },
  ],
  dispenses: [
    {
      eventId: 7001,
      storeCode: '1001',
      storeName: 'Olaya',
      at: '2026-11-12T09:00:00',
      itemNumber: '100200',
      itemDescription: 'Insulin glargine',
      sfdaCode: '6281100',
      quantity: 2,
      daysSupply: 30,
      payer: 'BUPA',
      channel: 'Counter',
      counter: true,
      pharmacist: 'phx1001',
      patientKey: 'NI:1012345678',
      memberId: 'M-998877',
    },
  ],
  legs: [{ fromEventId: 7001, toEventId: 7002, km: 312.4, minutes: 100, kmPerHour: 187.4, travel: true }],
  signalWords: [{ kind: 'travel', en: '312 km in 1 h 40 min', ar: '312 كم في 1 س 40 د' }],
  marks: [{ status: 'watching', note: 'asked the store', by: 'analyst1', at: '2026-11-13T10:00:00' }],
  previousClearance: { caseId: '01JA', caseNumber: 'PC-000099', note: 'chronic traveller', by: 'analyst2', at: '2026-10-01T12:00:00', patientKey: 'x' },
  previousCases: [{ caseId: '01JA', caseNumber: 'PC-000099', status: 'cleared', openedAt: '2026-09-20T08:00:00', closedAt: '2026-10-01T12:00:00' }],
  maps: { key: 'planted-test-key' },
}

beforeEach(() => {
  api.get.mockReset().mockResolvedValue({ items: [], totalMatches: 0 })
  api.post.mockReset().mockResolvedValue({ status: 'cleared', note: 'n', by: 'u', at: '2026-11-19T10:00:00' })
})

describe('the case list', () => {
  it('is GET Insurance/Patterns/Cases with the filters and the page as query parameters', async () => {
    await patternsApi.cases({ storeCode: '1001', from: '2026-11-01', to: '2026-11-19', signal: 'travel', status: 'open', severity: 'action', skip: 25, take: 25 })
    expect(api.get).toHaveBeenCalledWith('Insurance/Patterns/Cases', {
      storeCode: '1001',
      from: '2026-11-01',
      to: '2026-11-19',
      signal: 'travel',
      status: 'open',
      severity: 'action',
      skip: 25,
      take: 25,
    })
  })

  it('answers the rows as given and the match count', async () => {
    api.get.mockResolvedValue({ items: [ROW], totalMatches: 61 })
    const page = await patternsApi.cases({ skip: 0, take: 25 })
    expect(page.totalMatches).toBe(61)
    expect(page.items).toEqual([ROW])
  })

  it('an empty answer is an empty page, not a crash', async () => {
    api.get.mockResolvedValue(null)
    expect(await patternsApi.cases({ skip: 0, take: 25 })).toEqual({ items: [], totalMatches: 0 })
  })
})

describe('one case', () => {
  it('is GET Insurance/Patterns/Cases/{caseId}, the id escaped', async () => {
    api.get.mockResolvedValue(DETAIL_WITH_IDENTITY)
    await patternsApi.detail('01JD/3K')
    expect(api.get).toHaveBeenCalledWith('Insurance/Patterns/Cases/01JD%2F3K')
  })

  it('keeps no identity field the server sent: no patient key, no member id, no policy, at any depth', async () => {
    api.get.mockResolvedValue(DETAIL_WITH_IDENTITY)
    const detail = await patternsApi.detail('01JD3K7Q2W')
    const kept = JSON.stringify(detail)
    for (const word of ['patientKey', 'memberId', 'policyNumber', 'NI:1012345678', 'M-998877', 'POL-1']) expect(kept).not.toContain(word)
  })

  it('keeps every agreed field', async () => {
    api.get.mockResolvedValue(DETAIL_WITH_IDENTITY)
    const detail = await patternsApi.detail('01JD3K7Q2W')
    expect(detail.caseNumber).toBe('PC-000123')
    expect(detail.stores[1]).toEqual({ storeCode: '2040', storeName: 'Buraydah Central', lat: 26.326, lon: 43.975 })
    expect(detail.dispenses[0]).toEqual({
      eventId: 7001,
      storeCode: '1001',
      storeName: 'Olaya',
      at: '2026-11-12T09:00:00',
      itemNumber: '100200',
      itemDescription: 'Insulin glargine',
      sfdaCode: '6281100',
      quantity: 2,
      daysSupply: 30,
      payer: 'BUPA',
      channel: 'Counter',
      counter: true,
      pharmacist: 'phx1001',
    })
    expect(detail.legs).toEqual([{ fromEventId: 7001, toEventId: 7002, km: 312.4, minutes: 100, kmPerHour: 187.4, travel: true }])
    expect(detail.signalWords).toEqual([{ kind: 'travel', en: '312 km in 1 h 40 min', ar: '312 كم في 1 س 40 د' }])
    expect(detail.marks).toEqual([{ status: 'watching', note: 'asked the store', by: 'analyst1', at: '2026-11-13T10:00:00' }])
    expect(detail.previousClearance).toEqual({ caseId: '01JA', caseNumber: 'PC-000099', note: 'chronic traveller', by: 'analyst2', at: '2026-10-01T12:00:00' })
    expect(detail.previousCases).toHaveLength(1)
    expect(detail.maps).toEqual({ key: 'planted-test-key' })
  })

  it('reads a missing list as empty, a missing clearance as none, and no `maps` part as none', async () => {
    api.get.mockResolvedValue({ ...ROW, stores: null, dispenses: undefined, legs: null, signalWords: null, marks: null, previousCases: null })
    const detail = await patternsApi.detail('01JD3K7Q2W')
    expect([detail.stores, detail.dispenses, detail.legs, detail.signalWords, detail.marks, detail.previousCases]).toEqual([[], [], [], [], [], []])
    expect(detail.previousClearance).toBeNull()
    expect(detail.maps).toBeUndefined()
  })

  it('a store with no coordinates keeps them null, never 0 (0,0 is in the sea off Africa)', async () => {
    api.get.mockResolvedValue({ ...DETAIL_WITH_IDENTITY, stores: [{ storeCode: '3003', storeName: 'New', lat: null, lon: null }] })
    const detail = await patternsApi.detail('01JD3K7Q2W')
    expect(detail.stores[0]).toEqual({ storeCode: '3003', storeName: 'New', lat: null, lon: null })
  })
})

describe('a mark', () => {
  it('posts the status and the trimmed note to …/Cases/{caseId}/Marks — never an actor', async () => {
    await patternsApi.mark('01JD3K7Q2W', { status: 'cleared', note: '  known chronic traveller  ' })
    expect(api.post).toHaveBeenCalledWith('Insurance/Patterns/Cases/01JD3K7Q2W/Marks', { status: 'cleared', note: 'known chronic traveller' })
  })

  it('a blank note, an over-long one or no status is not sent', async () => {
    for (const draft of [
      { status: 'cleared' as const, note: '   ' },
      { status: 'cleared' as const, note: 'x'.repeat(501) },
      { status: '' as const, note: 'a note' },
    ])
      await expect(patternsApi.mark('01JD3K7Q2W', draft)).rejects.toBeInstanceOf(MarkNotSentError)
    expect(api.post).not.toHaveBeenCalled()
  })
})

describe('the cache keys', () => {
  it('a case and the list sit under one prefix, so a mark can re-read both', () => {
    expect(caseKey('A').slice(0, 1)).toEqual([...PATTERNS_KEY])
    expect(casesKey({ skip: 0, take: 25 }).slice(0, 1)).toEqual([...PATTERNS_KEY])
    expect(casesKey({ skip: 0, take: 25 })).not.toEqual(casesKey({ skip: 25, take: 25 }))
  })
})
