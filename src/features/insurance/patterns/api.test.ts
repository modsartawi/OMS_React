/**
 * Oms 922 — the pattern calls at the `@/core/api` boundary, reconciled with BackOffice 4053 as built
 * (`InsuranceRules/Patterns/Cases...`, a case keyed by its INT case number): what is sent, and what of the answer is
 * kept. The answers are read field by field, so a field nobody agreed to — above all a patient's identity — never reaches
 * the query cache, whatever the server sends (ticket 922 Boundaries: no patient field exists in the models at all).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }))
vi.mock('@/core/api', async (actual) => ({ ...(await actual<typeof import('@/core/api')>()), api }))

const { patternsApi, MarkNotSentError, caseKey, casesKey, PATTERNS_KEY } = await import('./api')

/** A list row as BackOffice 4053 sends it (`InsurancePatternCaseRow`, camelCased). */
const ROW = {
  caseNumber: 123,
  status: 'open',
  severity: 'action',
  score: 4,
  signals: [
    { signal: 'travel', en: '312 km in 1 h 40 min', ar: '312 كم في 1 س 40 د' },
    { signal: 'hopping', en: '5 pharmacies in 3 days', ar: '5 صيدليات في 3 أيام' },
  ],
  openedAt: '2026-11-10T09:15:00',
  lastDispenseAt: '2026-11-12T18:40:00',
  closedAt: null,
  spanHours: 57,
  storeCount: 2,
  dispenseCount: 4,
  longestLegKm: 312.4,
  shortestGapMinutes: 100,
  stores: [
    { storeCode: '1001', storeName: 'Olaya', latitude: 24.6943, longitude: 46.6853 },
    { storeCode: '2040', storeName: 'Buraydah Central', latitude: 26.326, longitude: 43.975 },
  ],
}

/** The row as the client keeps it. */
const KEPT_ROW = {
  caseNumber: '123',
  stores: [
    { storeCode: '1001', storeName: 'Olaya' },
    { storeCode: '2040', storeName: 'Buraydah Central' },
  ],
  dispenseCount: 4,
  openedAt: '2026-11-10T09:15:00',
  lastDispenseAt: '2026-11-12T18:40:00',
  closedAt: '',
  spanMinutes: 57 * 60,
  longestLegKm: 312.4,
  shortestGapMinutes: 100,
  signals: ['travel', 'hopping'],
  score: 4,
  severity: 'action',
  status: 'open',
}

/** A detail answer as a careless server might send it: three identity fields where none belongs, at every depth. */
const DETAIL_WITH_IDENTITY = {
  case: { ...ROW, patientKey: 'NI:1012345678' },
  patientKey: 'NI:1012345678',
  memberId: 'M-998877',
  policyNumber: 'POL-1',
  stores: [
    { storeCode: '1001', storeName: 'Olaya', latitude: 24.6943, longitude: 46.6853 },
    { storeCode: '2040', storeName: 'Buraydah Central', latitude: 26.326, longitude: 43.975, patientKey: 'NI:1012345678' },
  ],
  dispenses: [
    {
      seq: 1,
      storeCode: '1001',
      storeName: 'Olaya',
      eventTime: '2026-11-12T09:00:00',
      itemNumber: '100200',
      itemDescription: 'Insulin glargine',
      sfdaCode: '6281100',
      quantity: 2,
      daysSupply: 30,
      payer: 'BUPA',
      channel: 'Counter',
      isCounter: true,
      pharmacist: 'phx1001',
      signals: ['travel'],
      patientKey: 'NI:1012345678',
      memberId: 'M-998877',
    },
  ],
  legs: [{ fromSeq: 1, toSeq: 2, fromStore: '1001', toStore: '2040', km: 312.4, minutes: 100, kmPerHour: 187.4, counter: true, travel: true }],
  marks: [{ status: 'watching', note: 'asked the store', markedBy: 'analyst1', markedAt: '2026-11-13T10:00:00' }],
  previousCases: [
    {
      caseNumber: 99,
      status: 'cleared',
      signals: 'overlap',
      openedAt: '2026-09-20T08:00:00',
      lastDispenseAt: '2026-09-24T17:30:00',
      closedAt: '2026-10-01T12:00:00',
      memberId: 'M-998877',
      marks: [
        { status: 'cleared', note: 'chronic traveller', markedBy: 'analyst2', markedAt: '2026-10-01T12:00:00' },
        { status: 'watching', note: 'asked the payer', markedBy: 'analyst2', markedAt: '2026-09-25T09:00:00' },
      ],
    },
  ],
  canReveal: true,
}

beforeEach(() => {
  api.get.mockReset().mockResolvedValue({ page: 1, pageSize: 25, total: 0, rows: [] })
  api.post.mockReset().mockResolvedValue(DETAIL_WITH_IDENTITY)
})

describe('the case list', () => {
  it('is GET InsuranceRules/Patterns/Cases with the filters and the 1-based page as query parameters', async () => {
    await patternsApi.cases({ store: '1001', from: '2026-11-01', to: '2026-11-19', signal: 'travel', status: 'open', severity: 'action', page: 2, pageSize: 25 })
    expect(api.get).toHaveBeenCalledWith('InsuranceRules/Patterns/Cases', {
      store: '1001',
      from: '2026-11-01',
      to: '2026-11-19',
      signal: 'travel',
      status: 'open',
      severity: 'action',
      page: 2,
      pageSize: 25,
    })
  })

  it('reads { page, pageSize, total, rows }: the rows as the client keeps them and the match count', async () => {
    api.get.mockResolvedValue({ page: 1, pageSize: 25, total: 61, rows: [ROW] })
    const page = await patternsApi.cases({ page: 1, pageSize: 25 })
    expect(page.totalMatches).toBe(61)
    expect(page.items).toEqual([KEPT_ROW])
  })

  it('the server’s 0 for no longest leg and no shortest gap reads as none; a closed case keeps its close', async () => {
    api.get.mockResolvedValue({ total: 1, rows: [{ ...ROW, longestLegKm: 0, shortestGapMinutes: 0, closedAt: '2026-11-15T12:00:00' }] })
    const [row] = (await patternsApi.cases({ page: 1, pageSize: 25 })).items
    expect([row.longestLegKm, row.shortestGapMinutes, row.closedAt]).toEqual([null, null, '2026-11-15T12:00:00'])
  })

  it('an empty answer is an empty page, not a crash', async () => {
    api.get.mockResolvedValue(null)
    expect(await patternsApi.cases({ page: 1, pageSize: 25 })).toEqual({ items: [], totalMatches: 0 })
  })
})

describe('one case', () => {
  it('is GET InsuranceRules/Patterns/Cases/{caseNumber}', async () => {
    api.get.mockResolvedValue(DETAIL_WITH_IDENTITY)
    await patternsApi.detail('123')
    expect(api.get).toHaveBeenCalledWith('InsuranceRules/Patterns/Cases/123')
  })

  it('keeps no identity field the server sent: no patient key, no member id, no policy, at any depth', async () => {
    api.get.mockResolvedValue(DETAIL_WITH_IDENTITY)
    const detail = await patternsApi.detail('123')
    const kept = JSON.stringify(detail)
    for (const word of ['patientKey', 'memberId', 'policyNumber', 'NI:1012345678', 'M-998877', 'POL-1']) expect(kept).not.toContain(word)
  })

  it('keeps every agreed field, the row from `case` and the rest renamed to the client’s words', async () => {
    api.get.mockResolvedValue(DETAIL_WITH_IDENTITY)
    const detail = await patternsApi.detail('123')
    expect(detail).toMatchObject({ ...KEPT_ROW, stores: expect.any(Array) })
    expect(detail.stores[1]).toEqual({ storeCode: '2040', storeName: 'Buraydah Central', lat: 26.326, lon: 43.975 })
    expect(detail.dispenses[0]).toEqual({
      eventId: 1,
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
    expect(detail.legs).toEqual([{ fromEventId: 1, toEventId: 2, km: 312.4, minutes: 100, kmPerHour: 187.4, counter: true, travel: true }])
    expect(detail.signalWords).toEqual([
      { kind: 'travel', en: '312 km in 1 h 40 min', ar: '312 كم في 1 س 40 د' },
      { kind: 'hopping', en: '5 pharmacies in 3 days', ar: '5 صيدليات في 3 أيام' },
    ])
    expect(detail.marks).toEqual([{ status: 'watching', note: 'asked the store', by: 'analyst1', at: '2026-11-13T10:00:00' }])
    expect(detail.previousCases).toEqual([{ caseNumber: '99', status: 'cleared', openedAt: '2026-09-20T08:00:00', closedAt: '2026-10-01T12:00:00' }])
  })

  it('derives the previous clearance (the server sends none): the newest cleared case, its newest clearing mark', async () => {
    const older = { ...DETAIL_WITH_IDENTITY.previousCases[0], caseNumber: 50, lastDispenseAt: '2026-05-01T10:00:00' }
    const reopened = { ...DETAIL_WITH_IDENTITY.previousCases[0], caseNumber: 120, status: 'confirmed', lastDispenseAt: '2026-11-01T10:00:00' }
    api.get.mockResolvedValue({ ...DETAIL_WITH_IDENTITY, previousCases: [older, reopened, DETAIL_WITH_IDENTITY.previousCases[0]] })
    const detail = await patternsApi.detail('123')
    expect(detail.previousClearance).toEqual({ caseNumber: '99', note: 'chronic traveller', by: 'analyst2', at: '2026-10-01T12:00:00' })
  })

  it('no cleared previous case, or one with no clearing mark: no clearance', async () => {
    const notCleared = { ...DETAIL_WITH_IDENTITY.previousCases[0], status: 'closed' }
    const noMark = { ...DETAIL_WITH_IDENTITY.previousCases[0], marks: [] }
    for (const previousCases of [[], [notCleared], [noMark]]) {
      api.get.mockResolvedValue({ ...DETAIL_WITH_IDENTITY, previousCases })
      expect((await patternsApi.detail('123')).previousClearance).toBeNull()
    }
  })

  it('reads a missing list as empty, a missing case as no facts, and no `maps` part as none (4053 sends none)', async () => {
    api.get.mockResolvedValue({ case: null, stores: null, dispenses: undefined, legs: null, marks: null, previousCases: null })
    const detail = await patternsApi.detail('123')
    expect([detail.stores, detail.dispenses, detail.legs, detail.signalWords, detail.marks, detail.previousCases]).toEqual([[], [], [], [], [], []])
    expect(detail.caseNumber).toBe('')
    expect(detail.previousClearance).toBeNull()
    expect(detail.maps).toBeUndefined()
  })

  it('a `maps` part, should one be sent later, is read', async () => {
    api.get.mockResolvedValue({ ...DETAIL_WITH_IDENTITY, maps: { key: 'planted-test-key' } })
    expect((await patternsApi.detail('123')).maps).toEqual({ key: 'planted-test-key' })
  })

  it('a leg the server did not mark counter keeps counter false', async () => {
    api.get.mockResolvedValue({ ...DETAIL_WITH_IDENTITY, legs: [{ fromSeq: 1, toSeq: 2, km: 5, minutes: 30, kmPerHour: 10, counter: false, travel: false }] })
    expect((await patternsApi.detail('123')).legs[0].counter).toBe(false)
  })

  it('a store with no coordinates keeps them null, never 0 (0,0 is in the sea off Africa)', async () => {
    api.get.mockResolvedValue({ ...DETAIL_WITH_IDENTITY, stores: [{ storeCode: '3003', storeName: 'New', latitude: null, longitude: null }] })
    const detail = await patternsApi.detail('123')
    expect(detail.stores[0]).toEqual({ storeCode: '3003', storeName: 'New', lat: null, lon: null })
  })
})

describe('a mark', () => {
  it('posts the status and the trimmed note to …/Cases/{caseNumber}/Marks — never an actor', async () => {
    await patternsApi.mark('123', { status: 'cleared', note: '  known chronic traveller  ' })
    expect(api.post).toHaveBeenCalledWith('InsuranceRules/Patterns/Cases/123/Marks', { status: 'cleared', note: 'known chronic traveller' })
  })

  it('answers the whole case, read as the GET reads it — no identity kept', async () => {
    const detail = await patternsApi.mark('123', { status: 'cleared', note: 'known chronic traveller' })
    expect(detail.caseNumber).toBe('123')
    expect(JSON.stringify(detail)).not.toMatch(/NI:1012345678|M-998877|POL-1/)
  })

  it('a blank note, an over-long one or no status is not sent', async () => {
    for (const draft of [
      { status: 'cleared' as const, note: '   ' },
      { status: 'cleared' as const, note: 'x'.repeat(1001) },
      { status: '' as const, note: 'a note' },
    ])
      await expect(patternsApi.mark('123', draft)).rejects.toBeInstanceOf(MarkNotSentError)
    expect(api.post).not.toHaveBeenCalled()
  })
})

describe('the cache keys', () => {
  it('a case and the list sit under one prefix, so a mark can re-read both', () => {
    expect(caseKey('123').slice(0, 1)).toEqual([...PATTERNS_KEY])
    expect(casesKey({ page: 1, pageSize: 25 }).slice(0, 1)).toEqual([...PATTERNS_KEY])
    expect(casesKey({ page: 1, pageSize: 25 })).not.toEqual(casesKey({ page: 2, pageSize: 25 }))
  })
})
