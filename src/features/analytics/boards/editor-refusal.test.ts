import { describe, expect, it } from 'vitest'
import { ApiError } from '@/core/api'
import type { AnalyticsModel, AnalyticsViewDefinition } from '@/core/models/analytics'
import { editorRefusal } from './editor-refusal'

const coded = (code: string, message = `Server says ${code}.`, data: unknown = null) =>
  new ApiError('business', message, 400, [{ errorCode: code, internalErrorCode: '', errorMessage: message }], data)

const label = (en: string, ar: string) => ({ en, ar })
const MODEL: AnalyticsModel = {
  areas: [{ key: 'delivery', available: true }, { key: 'callouts', available: false, unavailableReason: 'Waiting on the replica (753).' }],
  measures: [
    { key: 'orders', area: 'delivery', shape: 'additive', unit: 'count', label: label('Orders', ''), description: label('', ''), dimensions: [] },
    { key: 'p90', area: 'delivery', shape: 'percentile', unit: 'minutes', maxWindowDays: 92, label: label('P90', ''), description: label('', ''), dimensions: [] },
    { key: 'take_rate', area: 'callouts', shape: 'rate', unit: 'share', label: label('Take rate', ''), description: label('', ''), dimensions: [] },
  ],
  dimensions: [],
}
const def = (measures: string[], period = 'year-to-date'): AnalyticsViewDefinition => ({ chart: { type: 'table' }, query: { measures, dimensions: [], filters: [], period } })

describe('the editor reads 406, 407 and 410 in its own terms', () => {
  it('406 names the offending field the refusal carries, or none', () => {
    expect(editorRefusal(coded('ANALYTICS-406', 'Bad.', { field: 'query.measures[0]' }), def(['orders']), MODEL)).toEqual({
      kind: 'invalid',
      field: 'query.measures[0]',
      message: 'Bad.',
    })
    expect(editorRefusal(coded('ANALYTICS-406', 'Bad.'), def(['orders']), MODEL)).toEqual({ kind: 'invalid', field: null, message: 'Bad.' })
  })

  it('407 names the percentile, its cap, and offers the longest rolling window under it', () => {
    expect(editorRefusal(coded('ANALYTICS-407'), def(['orders', 'p90']), MODEL)).toEqual({ kind: 'window', measure: 'p90', days: 92, shorter: 'last-30-days' })
  })

  it('410 shows the unavailable area reason from the model, else the server words', () => {
    expect(editorRefusal(coded('ANALYTICS-410', 'Area not ready.'), def(['take_rate']), MODEL)).toEqual({ kind: 'area', reason: 'Waiting on the replica (753).' })
    expect(editorRefusal(coded('ANALYTICS-410', 'Area not ready.'), def(['orders']), MODEL)).toEqual({ kind: 'area', reason: 'Area not ready.' })
  })

  it('any other failure is not the editor’s to word', () => {
    expect(editorRefusal(coded('ANALYTICS-409'), def(['orders']), MODEL)).toBeNull()
    expect(editorRefusal(new Error('boom'), def(['orders']), MODEL)).toBeNull()
  })
})
