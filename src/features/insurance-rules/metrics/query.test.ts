/**
 * Ticket 615 — the Metrics screen's address: the open tab, what the metrics are keyed by, the local window
 * (the last 30 days to today by default) and the payer of the rejection report. Unknown values fall back.
 */
import { describe, expect, it } from 'vitest'
import { metricsParams, readMetricsQuery, windowOf, writeMetricsQuery } from './query'

const TODAY = '2026-10-27'
const read = (qs: string) => readMetricsQuery(new URLSearchParams(qs), TODAY)

describe('the metrics address', () => {
  it('defaults_metricsByRule_overTheLast30LocalDays', () => {
    expect(read('')).toEqual({ tab: 'metrics', by: 'rule', from: '2026-09-28', to: '2026-10-27', payer: '' })
  })

  it('readsEveryField_andFallsBackOnAnUnknownTabOrBy', () => {
    expect(read('tab=rejections&by=day&from=2026-10-01&to=2026-10-15&payer=BUPA')).toEqual({ tab: 'rejections', by: 'day', from: '2026-10-01', to: '2026-10-15', payer: 'BUPA' })
    expect(read('tab=nope&by=patient')).toMatchObject({ tab: 'metrics', by: 'rule' })
  })

  it('writesOnlyWhatDiffersFromTheDefaults_soTheBareAddressStaysBare', () => {
    expect(writeMetricsQuery(read(''), TODAY).toString()).toBe('')
    expect(writeMetricsQuery({ tab: 'flags', by: 'store', from: '2026-10-01', to: '2026-10-27', payer: 'TAWUNIYA' }, TODAY).toString()).toBe('tab=flags&by=store&from=2026-10-01&payer=TAWUNIYA')
  })

  it('aWindowIsRefusedWhenReversedInvalidOrOverAYear', () => {
    expect(windowOf({ from: '2026-10-01', to: '2026-10-27' })).toBeNull()
    expect(windowOf({ from: '2026-10-27', to: '2026-10-01' })).toBe('reversed')
    expect(windowOf({ from: '2026-02-30', to: '2026-10-01' })).toBe('invalid')
    expect(windowOf({ from: '2025-10-01', to: '2026-10-27' })).toBe('tooLong')
  })

  it('theDoorParams_dropAnEmptyPayer', () => {
    expect(metricsParams(read('by=pharmacist'))).toEqual({ by: 'pharmacist', from: '2026-09-28', to: '2026-10-27' })
    expect(metricsParams(read('payer=BUPA'), true)).toEqual({ payer: 'BUPA', from: '2026-09-28', to: '2026-10-27' })
  })
})
