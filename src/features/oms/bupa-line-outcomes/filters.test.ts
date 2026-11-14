/**
 * Oms 899 — the filter lives in the URL, a range is checked before any call, and the report and the export are asked
 * with the same query. The network is stubbed at the `@/core/api` boundary.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const api = vi.hoisted(() => ({ get: vi.fn(), blob: vi.fn() }))
vi.mock('@/core/api', () => ({ api }))

const { bupaOutcomeApi, exportFileName } = await import('./api')
const { DEFAULT_FILTERS, filtersFromParams, filtersToParams, outcomeQuery, resolveRange } = await import('./filters')

const NOW = new Date(2026, 10, 14, 23, 59)

beforeEach(() => {
  api.get.mockReset().mockResolvedValue(null)
  api.blob.mockReset().mockResolvedValue({ blob: new Blob(), filename: null })
})

describe('the filter builds the report and export query alike', () => {
  it('both doors are asked with the same from, to, store and kind', async () => {
    const filters = filtersFromParams(new URLSearchParams('from=2026-10-01&to=2026-10-31&store=p001&kind=swapped'))
    const range = resolveRange(filters, NOW)
    expect(range.ok).toBe(true)
    if (!range.ok) return
    const query = outcomeQuery(filters, range)
    await bupaOutcomeApi.report(query)
    await bupaOutcomeApi.export(query)
    const expected = { from: '2026-10-01', to: '2026-10-31', store: 'P001', kind: 'swapped' }
    expect(api.get).toHaveBeenCalledWith('BupaLineOutcomes/report', expected)
    expect(api.blob).toHaveBeenCalledWith('BupaLineOutcomes/report/export', expected)
    expect(exportFileName(query)).toBe('bupa-line-outcomes_2026-10-01_2026-10-31.xlsx')
  })

  it('a blank store and kind go out blank on both, for buildQuery to drop', async () => {
    const range = resolveRange(DEFAULT_FILTERS, NOW)
    if (!range.ok) throw new Error('default range refused')
    const query = outcomeQuery(DEFAULT_FILTERS, range)
    await bupaOutcomeApi.report(query)
    await bupaOutcomeApi.export(query)
    const expected = { from: '2026-10-16', to: '2026-11-14', store: '', kind: '' }
    expect(api.get.mock.calls[0][1]).toEqual(expected)
    expect(api.blob.mock.calls[0][1]).toEqual(expected)
  })

  it('a bare answer reads as an empty report, not a crash', async () => {
    const report = await bupaOutcomeApi.report({ from: '2026-10-01', to: '2026-10-02' })
    expect(report).toEqual({
      from: '2026-10-01',
      to: '2026-10-02',
      summary: [],
      details: [],
      totals: { orders: 0, lines: 0, linesQtyDiffers: 0 },
    })
  })
})

describe('resolveRange', () => {
  it('defaults to the last 30 days ending today, both inclusive', () => {
    expect(resolveRange({ from: '', to: '' }, NOW)).toEqual({ ok: true, from: '2026-10-16', to: '2026-11-14' })
  })

  it('takes a range of up to 3 calendar months, the last day clamped', () => {
    expect(resolveRange({ from: '2026-08-14', to: '2026-11-14' }, NOW)).toEqual({ ok: true, from: '2026-08-14', to: '2026-11-14' })
    expect(resolveRange({ from: '2026-11-30', to: '2027-02-28' }, NOW).ok).toBe(true)
  })

  it('refuses a half-typed, impossible, reversed or too-long range before any call', () => {
    expect(resolveRange({ from: '2026-10-01', to: '' }, NOW)).toEqual({ ok: false, problem: 'incomplete' })
    expect(resolveRange({ from: '2026-02-30', to: '2026-03-01' }, NOW)).toEqual({ ok: false, problem: 'incomplete' })
    expect(resolveRange({ from: '2026-10-02', to: '2026-10-01' }, NOW)).toEqual({ ok: false, problem: 'reversed' })
    expect(resolveRange({ from: '2026-08-13', to: '2026-11-14' }, NOW)).toEqual({ ok: false, problem: 'tooLong' })
    expect(resolveRange({ from: '2026-11-30', to: '2027-03-01' }, NOW)).toEqual({ ok: false, problem: 'tooLong' })
  })
})

describe('the URL', () => {
  it('writes nothing for the defaults', () => {
    expect(filtersToParams(DEFAULT_FILTERS).toString()).toBe('')
    expect(filtersFromParams(new URLSearchParams())).toEqual(DEFAULT_FILTERS)
  })

  it('round-trips every filter', () => {
    const filters = { from: '2026-10-01', to: '2026-10-20', store: 'P001', kind: 'autoResolved' as const }
    expect(filtersFromParams(filtersToParams(filters))).toEqual(filters)
  })

  it('reads an unknown kind as every kind, and a store trimmed and upper-cased', () => {
    const read = filtersFromParams(new URLSearchParams('kind=maybe&store= p001 '))
    expect(read.kind).toBe('')
    expect(read.store).toBe('P001')
  })
})
