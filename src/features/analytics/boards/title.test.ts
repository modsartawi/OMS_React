import i18next from 'i18next'
import { describe, expect, it } from 'vitest'
import ar from '@/locales/ar/boards.json'
import en from '@/locales/en/boards.json'
import type { AnalyticsModel, AnalyticsViewDefinition } from '@/core/models/analytics'
import { generatedTitle } from './title'

const instance = i18next.createInstance()
instance.init({
  lng: 'en',
  resources: { en: { boards: en }, ar: { boards: ar } },
  ns: ['boards'],
  defaultNS: 'boards',
  initAsync: false,
  interpolation: { escapeValue: false },
})
const tIn = (lng: 'en' | 'ar') => instance.getFixedT(lng, 'boards') as unknown as (key: string, o?: Record<string, unknown>) => string

const label = (en: string, ar: string) => ({ en, ar })
const MODEL: AnalyticsModel = {
  areas: [{ key: 'sales', available: true }],
  measures: [
    { key: 'orders', area: 'sales', shape: 'additive', unit: 'count', label: label('Orders', 'الطلبات'), description: label('', ''), dimensions: [] },
    { key: 'p50', area: 'delivery', shape: 'percentile', unit: 'minutes', label: label('Median order to delivered', 'الوسيط من الطلب إلى التسليم'), description: label('', ''), dimensions: [] },
    { key: 'p90', area: 'delivery', shape: 'percentile', unit: 'minutes', label: label('P90 order to delivered', 'المئين 90 من الطلب إلى التسليم'), description: label('', ''), dimensions: [] },
  ],
  dimensions: [
    { key: 'channel_group', kind: 'category', label: label('Channel', 'القناة'), values: [] },
    { key: 'store', kind: 'category', label: label('Store', 'الفرع'), values: [] },
  ],
}
const def = (measures: string[], dimensions: string[], period?: string): AnalyticsViewDefinition => ({
  chart: { type: 'table' },
  query: { measures, dimensions, filters: [], period },
})
const both = (d: AnalyticsViewDefinition) => ({ en: generatedTitle(d, MODEL, 'en', tIn('en')), ar: generatedTitle(d, MODEL, 'ar', tIn('ar')) })

describe('generated title: measure by dimension, over period, from model labels', () => {
  it('one measure by one dimension over a relative period', () => {
    expect(both(def(['orders'], ['channel_group'], 'last-30-days'))).toEqual({
      en: 'Orders by Channel, last 30 days',
      ar: 'الطلبات حسب القناة، آخر 30 يومًا',
    })
  })

  it('Q8: two measures by channel over the last 7 days', () => {
    expect(both(def(['p50', 'p90'], ['channel_group'], 'last-7-days'))).toEqual({
      en: 'Median order to delivered and P90 order to delivered by Channel, last 7 days',
      ar: 'الوسيط من الطلب إلى التسليم والمئين 90 من الطلب إلى التسليم حسب القناة، آخر 7 أيام',
    })
  })

  it('two dimensions; no breakdown; no period', () => {
    expect(both(def(['orders'], ['store', 'channel_group']))).toEqual({ en: 'Orders by Store and Channel', ar: 'الطلبات حسب الفرع والقناة' })
    expect(both(def(['orders'], [], 'year-to-date'))).toEqual({ en: 'Orders, year to date', ar: 'الطلبات، منذ بداية السنة' })
  })

  it('a member the model does not know reads as its key; nothing chosen is empty', () => {
    expect(generatedTitle(def(['retired_measure'], []), MODEL, 'en', tIn('en'))).toBe('retired_measure')
    expect(generatedTitle(def([], []), MODEL, 'en', tIn('en'))).toBe('')
  })

  it('wraps each label for a string sink when asked', () => {
    const wrap = (s: string) => `[${s}]`
    expect(generatedTitle(def(['orders'], ['channel_group']), MODEL, 'en', tIn('en'), wrap)).toBe('[Orders] by [Channel]')
  })
})
