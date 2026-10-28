/**
 * Ticket 627 (reconciled by 628 with 3169) — the IDF swap report and its Excel export. Both doors take the SAME query
 * as the event log's shared filter (window, store, payer = the insurer's customer id, master) and never the log's own
 * outcome or page. The answer is `{ from, to, rows, totals }` with fixed counts per row (alternatives taken and the
 * reminders where every candidate was dearer included). The tab is the address's, `events` by default. The network is
 * stubbed at the `@/core/api` boundary.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const get = vi.hoisted(() => vi.fn())
const blob = vi.hoisted(() => vi.fn())
vi.mock('@/core/api', () => ({ api: { get, blob } }))

const { idfReportApi } = await import('./api')
const { readIdfEventsQuery, writeIdfEventsQuery, withFilter } = await import('./events-filter')
const { SWAP_REPORT_COUNTS, swapReportFileName, swapRowKey, swapRowMasterName } = await import('./report')

const TODAY = '2026-10-27'
const read = (qs: string) => readIdfEventsQuery(new URLSearchParams(qs), TODAY)

beforeEach(() => {
  get.mockReset().mockResolvedValue({ from: null, to: null, rows: [], totals: null })
  blob.mockReset().mockResolvedValue({ blob: new Blob(['x']), filename: 'idf.xlsx' })
})

describe('swap report and export take the same query as the event filter', () => {
  it('theReportAndTheExport_sendTheSharedFilter_neverTheOutcomeOrThePage', async () => {
    const q = read('tab=report&from=2026-10-01&to=2026-10-15&store=P019&payer=0001100336&master=M-OPS&outcome=reminder&page=3')
    await idfReportApi.report(q)
    await idfReportApi.export(q)
    const filter = { from: '2026-10-01', to: '2026-10-15', store: 'P019', payer: '0001100336', masterId: 'M-OPS' }
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

  it('aMissingReportBody_isAnEmptyReport', async () => {
    get.mockResolvedValue(null)
    expect(await idfReportApi.report(read('tab=report'))).toEqual({ from: null, to: null, rows: [], totals: null })
  })

  it('theReportBody_isPassedOn_rowsAndTotals', async () => {
    const row = { masterId: 'M-1', masterNameEn: 'Bupa', masterNameAr: 'بوبا', store: 'P019', insurerCustomerId: '0001100336', events: 3 }
    get.mockResolvedValue({ from: '2026-10-01T00:00:00', to: null, rows: [row], totals: { ...row, masterId: '', store: '', insurerCustomerId: '' } })
    const r = await idfReportApi.report(read('tab=report'))
    expect(r.rows).toEqual([row])
    expect(r.totals?.events).toBe(3)
  })

  it('theTab_isTheAddresss_eventsByDefault_andKeptAcrossAFilterChange', () => {
    expect(read('')).toMatchObject({ tab: 'events' })
    expect(read('tab=report')).toMatchObject({ tab: 'report' })
    expect(read('tab=nope')).toMatchObject({ tab: 'events' })
    expect(writeIdfEventsQuery(read(''), TODAY).toString()).toBe('')
    expect(writeIdfEventsQuery(read('tab=report&payer=0001100336'), TODAY).toString()).toBe('payer=0001100336&tab=report')
    expect(withFilter(read('tab=report&page=2'), { store: 'P001' })).toMatchObject({ tab: 'report', store: 'P001', page: 1 })
  })

  it('theExportsFallbackName_isTheDoorsSpelling', () => {
    expect(swapReportFileName(read('from=2026-10-01&to=2026-10-15'))).toBe('idf-swap-report-20261001-to-20261015.xlsx')
    expect(swapReportFileName({ from: '', to: '' })).toBe('idf-swap-report.xlsx')
  })
})

describe('the report rows are the door\'s fixed columns', () => {
  it('nine counts in the door\'s order, alternatives taken and all-candidates-dearer reminders included', () => {
    expect([...SWAP_REPORT_COUNTS]).toEqual([
      'events',
      'reminders',
      'remindersAllCandidatesDearer',
      'forcedPicksTaken',
      'alternativesTaken',
      'picksCancelled',
      'linesAbandoned',
      'skippedByException',
      'refusedPreAuth',
    ])
  })

  it('a row is keyed master × store × payer; an empty master is the general master (no name)', () => {
    expect(swapRowKey({ masterId: 'M-1', store: 'P019', insurerCustomerId: '0001100336' })).toBe('M-1|P019|0001100336')
    expect(swapRowMasterName({ masterId: '', masterNameEn: '', masterNameAr: '' }, 'en')).toBeNull()
    expect(swapRowMasterName({ masterId: 'M-1', masterNameEn: 'Bupa', masterNameAr: 'بوبا' }, 'ar')).toBe('بوبا')
    expect(swapRowMasterName({ masterId: 'M-1', masterNameEn: 'Bupa', masterNameAr: '' }, 'ar')).toBe('Bupa')
    expect(swapRowMasterName({ masterId: 'M-1', masterNameEn: '', masterNameAr: '' }, 'en')).toBeNull()
  })
})
