import i18next from 'i18next'
import { describe, expect, it } from 'vitest'
import { ApiError } from '@/core/api'
import en from '@/locales/en/boards.json'
import ar from '@/locales/ar/boards.json'
import { analyticsRefusal, readItem, readItems, readModel, readResult } from './wire'

const coded = (code: string, message = `Server says ${code}.`) =>
  new ApiError('business', message, 403, [{ errorCode: code, internalErrorCode: '', errorMessage: message }])

const instance = i18next.createInstance()
await instance.init({ lng: 'en', resources: { en: { boards: en }, ar: { boards: ar } }, defaultNS: 'boards', interpolation: { escapeValue: false } })

describe('analytics wire', () => {
  it('each of ANALYTICS-401/404/406/407/410 maps to its i18n key, an unknown code falls back to the server message', () => {
    expect(analyticsRefusal(coded('ANALYTICS-401'), 'fallback')).toEqual({ code: 'ANALYTICS-401', key: 'refusal.noAccess' })
    expect(analyticsRefusal(coded('ANALYTICS-404'), 'fallback')).toEqual({ code: 'ANALYTICS-404', key: 'refusal.notFound' })
    expect(analyticsRefusal(coded('ANALYTICS-406'), 'fallback')).toEqual({ code: 'ANALYTICS-406', key: 'refusal.invalid' })
    expect(analyticsRefusal(coded('ANALYTICS-407'), 'fallback')).toEqual({ code: 'ANALYTICS-407', key: 'refusal.window' })
    expect(analyticsRefusal(coded('ANALYTICS-410'), 'fallback')).toEqual({ code: 'ANALYTICS-410', key: 'refusal.areaUnavailable' })
    expect(analyticsRefusal(coded('ANALYTICS-499', 'Something new.'), 'fallback')).toEqual({ code: 'ANALYTICS-499', message: 'Something new.' })
    expect(analyticsRefusal(new Error('boom'), 'The view could not be drawn.')).toEqual({ code: null, message: 'The view could not be drawn.' })

    // Each key has words in both languages, and none of them is the raw code.
    for (const key of ['refusal.noAccess', 'refusal.notFound', 'refusal.invalid', 'refusal.window', 'refusal.areaUnavailable']) {
      for (const lng of ['en', 'ar']) {
        expect(instance.exists(key, { lng }), `${lng} ${key}`).toBe(true)
        expect(instance.t(key, { lng })).not.toMatch(/ANALYTICS/)
      }
    }
  })

  it('absent arrays read as empty', () => {
    expect(readModel({})).toEqual({ areas: [], measures: [], dimensions: [] })
    const model = readModel({
      measures: [{ key: 'orders', area: 'sales', shape: 'additive', unit: 'count', label: { en: 'Orders', ar: 'الطلبات' } }],
      dimensions: [{ key: 'store', kind: 'category', label: { en: 'Store', ar: 'الفرع' } }],
    })
    expect(model.measures[0].dimensions).toEqual([])
    expect(model.dimensions[0].values).toEqual([])

    const result = readResult({ total: 0, truncated: false, dataAsOf: '2026-11-05T09:45:00' })
    expect(result.columns).toEqual([])
    expect(result.rows).toEqual([])
    expect(result.previous).toEqual([])
    expect(result.period).toBeNull()
    expect(readResult(null).rows).toEqual([])

    const item = readItem({ id: 'v1', kind: 'view', definition: { chart: { type: 'bar' }, query: { measures: ['orders'] } } })
    expect(item.definition.query.dimensions).toEqual([])
    expect(item.definition.query.filters).toEqual([])
    expect(item.title).toEqual({ en: '', ar: '' })
  })

  it('Items reads a bare array or an { items } page, each item defensively; anything else is empty', () => {
    const one = { id: 'b-1', kind: 'board', tier: 'certified', updatedAt: '2026-11-01T08:00:00' }
    expect(readItems([one]).map((i) => [i.id, i.kind, i.title.en])).toEqual([['b-1', 'board', '']])
    expect(readItems({ items: [one] }).map((i) => i.id)).toEqual(['b-1'])
    expect(readItems(null)).toEqual([])
    expect(readItems({})).toEqual([])
  })
})
