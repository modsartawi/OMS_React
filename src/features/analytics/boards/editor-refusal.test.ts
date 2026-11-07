import { describe, expect, it } from 'vitest'
import { ApiError } from '@/core/api'
import type { AnalyticsModel, AnalyticsViewDefinition } from '@/core/models/analytics'
import { declarationRefusal, editorRefusal } from './editor-refusal'

const coded = (code: string, message = `Server says ${code}.`, data: unknown = null) =>
  new ApiError('business', message, 400, [{ errorCode: code, internalErrorCode: '', errorMessage: message }], data)

const label = (en: string, ar: string) => ({ en, ar })
const MODEL: AnalyticsModel = {
  areas: [{ key: 'delivery', available: true }, { key: 'callouts', available: false, unavailableReason: { en: 'Waiting on the replica (753).', ar: '' } }],
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
    expect(editorRefusal(coded('ANALYTICS-410', 'Area not ready.'), def(['take_rate']), MODEL)).toEqual({ kind: 'area', reason: { en: 'Waiting on the replica (753).', ar: '' }, message: 'Area not ready.' })
    expect(editorRefusal(coded('ANALYTICS-410', 'Area not ready.'), def(['orders']), MODEL)).toEqual({ kind: 'area', reason: null, message: 'Area not ready.' })
  })

  it('411 lists the series problems the refusal carries (825), each to its series', () => {
    const problems = [
      { what: 'series', why: 'tooMany' },
      { what: 'series', why: 'duplicate', series: 's2' },
      { what: 'series', why: 'foreignDimension', series: 's3', dimension: 'store' },
      { what: 'name', why: 'slug', param: 'X' },
      { what: 'series', why: 'unheard-of' },
    ]
    expect(editorRefusal(coded('ANALYTICS-411', 'Not saved.', { problems }), def(['orders']), MODEL)).toEqual({
      kind: 'declaration',
      series: [{ why: 'tooMany' }, { why: 'duplicate', series: 's2' }, { why: 'foreignDimension', series: 's3', dimension: 'store' }],
      message: 'Not saved.',
    })
    expect(editorRefusal(coded('ANALYTICS-411', 'Not saved.'), def(['orders']), MODEL)).toEqual({ kind: 'declaration', series: [], message: 'Not saved.' })
  })

  it('any other failure is not the editor’s to word', () => {
    expect(editorRefusal(coded('ANALYTICS-409'), def(['orders']), MODEL)).toBeNull()
    expect(editorRefusal(new Error('boom'), def(['orders']), MODEL)).toBeNull()
  })
})

describe('411 on a board: the declaration problems it lists (824), read by the same reader', () => {
  it('names, bindings, defaults and series, each kept; a shape not known here is left out', () => {
    const problems = [
      { what: 'name', why: 'reserved', param: 'tv' },
      { what: 'binding', param: 'channel', panel: 'p-bar', reason: 'notInArea' },
      { what: 'default', param: 'top' },
      { what: 'series', why: 'tooMany' },
      { what: 'binding', param: 'channel', panel: 'p-bar', reason: 'unheard-of' },
      { what: 'name', why: 'slug' },
      'noise',
    ]
    expect(declarationRefusal(coded('ANALYTICS-411', 'Not saved.', { problems }))).toEqual({
      problems: [
        { what: 'name', why: 'reserved', param: 'tv' },
        { what: 'binding', param: 'channel', panel: 'p-bar', reason: 'notInArea' },
        { what: 'default', param: 'top' },
        { what: 'series', why: 'tooMany' },
      ],
      message: 'Not saved.',
    })
  })
  it('is null for any other refusal', () => {
    expect(declarationRefusal(coded('ANALYTICS-406'))).toBeNull()
    expect(declarationRefusal(new Error('boom'))).toBeNull()
  })
})
