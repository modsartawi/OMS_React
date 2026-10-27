/**
 * Ticket 627 — the IDF swap report and its Excel export (door 3169). Both doors take the SAME query as the event
 * log's shared filter (window, store, payer, master) and never the log's own outcome or page. The tab is the
 * address's, `events` by default. The network is stubbed at the `@/core/api` boundary.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const get = vi.hoisted(() => vi.fn())
const blob = vi.hoisted(() => vi.fn())
vi.mock('@/core/api', () => ({ api: { get, blob } }))

const { idfReportApi } = await import('./api')
const { readIdfEventsQuery, writeIdfEventsQuery, withFilter } = await import('./events-filter')
const { swapReportColumns, swapReportCount, swapReportFileName } = await import('./report')

const TODAY = '2026-10-27'
const read = (qs: string) => readIdfEventsQuery(new URLSearchParams(qs), TODAY)

beforeEach(() => {
  get.mockReset().mockResolvedValue([])
  blob.mockReset().mockResolvedValue({ blob: new Blob(['x']), filename: 'idf.xlsx' })
})

describe('swap report and export take the same query as the event filter', () => {
  it('theReportAndTheExport_sendTheSharedFilter_neverTheOutcomeOrThePage', async () => {
    const q = read('tab=report&from=2026-10-01&to=2026-10-15&store=P019&payer=BUPA&master=M-OPS&outcome=reminder&page=3')
    await idfReportApi.report(q)
    await idfReportApi.export(q)
    const filter = { from: '2026-10-01', to: '2026-10-15', store: 'P019', payer: 'BUPA', masterId: 'M-OPS' }
    expect(get).toHaveBeenCalledWith('IdfPriority/swap-report', filter)
    expect(blob).toHaveBeenCalledWith('IdfPriority/swap-report/export', filter)
  })

  it('bothDoorsHandTheSameParams_toCoreBuildQuery_whichDropsTheBlankOnes', async () => {
    const q = read('tab=report')
    await idfReportApi.report(q)
    await idfReportApi.export(q)
    const params = { from: '2026-10-21', to: '2026-10-27', store: '', payer: '', masterId: '' }
    expect(get).toHaveBeenCalledWith('IdfPriority/swap-report', params)
    expect(blob).toHaveBeenCalledWith('IdfPriority/swap-report/export', params)
  })

  it('aMissingReportBody_isNoRows', async () => {
    get.mockResolvedValue(null)
    expect(await idfReportApi.report(read('tab=report'))).toEqual([])
  })

  it('theTab_isTheAddresss_eventsByDefault_andKeptAcrossAFilterChange', () => {
    expect(read('')).toMatchObject({ tab: 'events' })
    expect(read('tab=report')).toMatchObject({ tab: 'report' })
    expect(read('tab=nope')).toMatchObject({ tab: 'events' })
    expect(writeIdfEventsQuery(read(''), TODAY).toString()).toBe('')
    expect(writeIdfEventsQuery(read('tab=report&payer=BUPA'), TODAY).toString()).toBe('payer=BUPA&tab=report')
    expect(withFilter(read('tab=report&page=2'), { store: 'P001' })).toMatchObject({ tab: 'report', store: 'P001', page: 1 })
  })

  it('theExportsFallbackName_namesTheWindow', () => {
    expect(swapReportFileName(read('from=2026-10-01&to=2026-10-15'))).toBe('idf-swap-report-2026-10-01-2026-10-15.xlsx')
  })
})

describe('every count the server sends has a column', () => {
  const OFFERED = ['reminder', 'forcedPickTaken', 'pickCancelled', 'lineAbandoned', 'skippedByException', 'refusedPreAuth']
  const row = (counts: Record<string, number>) => ({ masterId: 'M-1', storeCode: 'P019', payerCode: 'BUPA', counts })

  it('onlyTheOfferedOutcomes_whenNoRowCarriesAnythingElse', () => {
    expect(swapReportColumns([row({ reminder: 3, forcedPickTaken: 1 })])).toEqual(OFFERED)
  })

  it('aReservedOutcomeGetsItsOwnColumn_onlyWhenARowCarriesIt', () => {
    const rows = [row({ reminder: 1 }), row({ autoApproved: 2, requestRaised: 0 })]
    expect(swapReportColumns(rows)).toEqual([...OFFERED, 'autoApproved'])
    expect(swapReportCount(rows[1], 'autoApproved')).toBe(2)
  })

  it('anUnknownOutcomeCode_isCountedUnderOther_soTheRowTotalMatchesTheServer', () => {
    const r = row({ reminder: 2, someNewOutcome: 4, another: 1 })
    const columns = swapReportColumns([r])
    expect(columns).toEqual([...OFFERED, 'other'])
    expect(swapReportCount(r, 'other')).toBe(5)
    expect(columns.reduce((sum, c) => sum + swapReportCount(r, c), 0)).toBe(7)
  })

  it('aMissingCountIsZero', () => {
    expect(swapReportCount(row({}), 'reminder')).toBe(0)
    expect(swapReportCount(row({}), 'other')).toBe(0)
  })
})
