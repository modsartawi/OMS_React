import { describe, expect, it } from 'vitest'
import type { AnalyticsModel } from '@/core/models/analytics'
import { chartOffers, suggestChoice, type ChartChoice } from './shape-rules'

const label = (en: string, ar: string) => ({ en, ar })
const values = (...keys: string[]) => keys.map((k) => ({ key: k, label: label(k, k) }))

const ALL = ['channel_group', 'country', 'store', 'city', 'day', 'weekday', 'hour']
const MODEL: AnalyticsModel = {
  areas: [{ key: 'sales', available: true }],
  measures: [
    { key: 'orders', area: 'sales', shape: 'additive', unit: 'count', label: label('Orders', 'الطلبات'), description: label('', ''), dimensions: ALL },
    { key: 'till_value', area: 'sales', shape: 'additive', unit: 'SAR', label: label('Value', 'القيمة'), description: label('', ''), dimensions: ALL },
    { key: 'deliveries', area: 'sales', shape: 'additive', unit: 'count', label: label('Deliveries', 'التوصيلات'), description: label('', ''), dimensions: ALL },
    { key: 'returns', area: 'sales', shape: 'additive', unit: 'count', label: label('Returns', 'المرتجعات'), description: label('', ''), dimensions: ALL },
    { key: 'return_rate', area: 'sales', shape: 'rate', unit: 'share', label: label('Return rate', 'نسبة المرتجعات'), description: label('', ''), dimensions: ALL },
    { key: 'p50_min', area: 'sales', shape: 'percentile', unit: 'minutes', label: label('Median minutes', 'الوسيط'), description: label('', ''), dimensions: ALL },
    { key: 'p90_min', area: 'sales', shape: 'percentile', unit: 'minutes', label: label('P90 minutes', 'المئين 90'), description: label('', ''), dimensions: ALL },
  ],
  dimensions: [
    { key: 'channel_group', kind: 'category', label: label('Channel', 'القناة'), values: values('app', 'web', 'callcenter', 'aggregator', 'store') },
    { key: 'country', kind: 'category', label: label('Country', 'الدولة'), values: values('sa', 'bh', 'ae', 'kw', 'om', 'qa', 'eg') },
    { key: 'store', kind: 'category', label: label('Store', 'الفرع'), values: [] },
    { key: 'city', kind: 'category', label: label('City', 'المدينة'), values: [] },
    { key: 'day', kind: 'time', label: label('Day', 'اليوم'), values: [] },
    { key: 'weekday', kind: 'category', label: label('Weekday', 'يوم الأسبوع'), values: [] },
    { key: 'hour', kind: 'category', label: label('Hour', 'الساعة'), values: [] },
  ],
}

const offers = (measures: string[], dimensions: string[]) => chartOffers({ measures, dimensions }, MODEL)
const offered = (measures: string[], dimensions: string[]): ChartChoice[] =>
  offers(measures, dimensions).filter((o) => o.offered).map((o) => o.choice)
const reasonOf = (measures: string[], dimensions: string[], choice: ChartChoice) => {
  const o = offers(measures, dimensions).find((x) => x.choice === choice)
  return o && !o.offered ? o.reason : null
}

describe('shape rules: 755 table plus the amendments', () => {
  it('lists every choice once, offered or with a reason', () => {
    expect(offers(['orders'], ['channel_group']).map((o) => o.choice)).toEqual([
      'kpi',
      'line',
      'area',
      'bar-vertical',
      'bar-horizontal',
      'bar-stacked',
      'bar-grouped',
      'donut',
      'table',
      'heatmap',
      'combo',
    ])
  })

  it('offers nothing without a measure, and says so', () => {
    expect(offered([], ['channel_group'])).toEqual([])
    expect(reasonOf([], ['channel_group'], 'table')).toBe('noMeasure')
  })

  it('KPI: one measure and no category; a time breakdown is its sparkline', () => {
    expect(offered(['orders'], [])).toEqual(['kpi'])
    expect(offered(['orders'], ['day'])).toContain('kpi')
    expect(reasonOf(['orders'], ['channel_group'], 'kpi')).toBe('kpiShape')
    expect(reasonOf(['orders', 'deliveries'], [], 'kpi')).toBe('kpiShape')
  })

  it('line: 1–4 measures over time, or 1 measure over time by one category', () => {
    expect(offered(['orders', 'deliveries', 'returns', 'till_value'], ['day'])).toContain('line')
    expect(offered(['orders'], ['day', 'store'])).toContain('line')
    expect(reasonOf(['orders'], ['channel_group'], 'line')).toBe('needsTime')
    expect(reasonOf(['orders', 'deliveries'], ['day', 'store'], 'line')).toBe('lineShape')
  })

  it('a rate or percentile is never stacked: stacked area and stacked bar refuse it', () => {
    expect(offered(['orders'], ['day', 'channel_group'])).toContain('area')
    expect(reasonOf(['return_rate'], ['day', 'channel_group'], 'area')).toBe('rateStacked')
    expect(reasonOf(['return_rate'], ['store', 'channel_group'], 'bar-stacked')).toBe('rateStacked')
    expect(offered(['return_rate'], ['store', 'channel_group'])).toContain('bar-grouped')
    expect(reasonOf(['orders'], ['day'], 'area')).toBe('areaShape')
  })

  it('bars: 1–3 measures by one category, or 1 measure by two; stacked and grouped need two series', () => {
    expect(offered(['orders'], ['store'])).toEqual(expect.arrayContaining(['bar-vertical', 'bar-horizontal']))
    expect(reasonOf(['orders'], ['store'], 'bar-stacked')).toBe('needsSeries')
    expect(reasonOf(['orders'], ['store'], 'bar-grouped')).toBe('needsSeries')
    expect(offered(['orders', 'deliveries', 'returns'], ['store'])).toEqual(expect.arrayContaining(['bar-stacked', 'bar-grouped']))
    expect(reasonOf(['orders', 'deliveries', 'returns', 'till_value'], ['store'], 'bar-vertical')).toBe('barShape')
    expect(reasonOf(['orders', 'deliveries'], ['store', 'channel_group'], 'bar-vertical')).toBe('barShape')
  })

  it('a rate or percentile is never in a donut; a donut is one additive measure by one category', () => {
    expect(offered(['orders'], ['channel_group'])).toContain('donut')
    expect(reasonOf(['return_rate'], ['channel_group'], 'donut')).toBe('donutAdditive')
    expect(reasonOf(['p50_min'], ['channel_group'], 'donut')).toBe('donutAdditive')
    expect(reasonOf(['orders'], ['day'], 'donut')).toBe('donutShape')
    expect(reasonOf(['orders', 'deliveries'], ['channel_group'], 'donut')).toBe('donutShape')
  })

  it('table: any measures by 1–3 dimensions', () => {
    expect(offered(['orders', 'deliveries', 'returns', 'till_value'], ['store', 'channel_group', 'day'])).toContain('table')
    expect(reasonOf(['orders'], [], 'table')).toBe('tableShape')
    expect(reasonOf(['orders'], ['store', 'channel_group', 'day', 'city'], 'table')).toBe('tableShape')
  })

  it('heatmap: one measure by two dimensions', () => {
    expect(offered(['orders'], ['weekday', 'hour'])).toContain('heatmap')
    expect(reasonOf(['orders'], ['weekday'], 'heatmap')).toBe('heatmapShape')
    expect(reasonOf(['orders', 'deliveries'], ['weekday', 'hour'], 'heatmap')).toBe('heatmapShape')
  })

  it('combo needs one volume and one rate, by time or a category', () => {
    expect(offered(['orders', 'return_rate'], ['day'])).toContain('combo')
    expect(offered(['return_rate', 'orders'], ['store'])).toContain('combo')
    expect(offered(['orders', 'p90_min'], ['day'])).toContain('combo')
    expect(reasonOf(['orders', 'deliveries'], ['day'], 'combo')).toBe('comboShape')
    expect(reasonOf(['p50_min', 'p90_min'], ['day'], 'combo')).toBe('comboShape')
    expect(reasonOf(['orders', 'return_rate'], ['day', 'store'], 'combo')).toBe('comboShape')
  })

  it('Q8 (median and p90 by channel): only the table and the unstacked bars fit', () => {
    expect(offered(['p50_min', 'p90_min'], ['channel_group'])).toEqual(['bar-vertical', 'bar-horizontal', 'bar-grouped', 'table'])
    expect(reasonOf(['p50_min', 'p90_min'], ['channel_group'], 'bar-stacked')).toBe('rateStacked')
  })

  it('more than 5 members folds into "Other": an open breakdown or one with more than 5 values', () => {
    const fold = (measures: string[], dimensions: string[], choice: ChartChoice) => {
      const o = offers(measures, dimensions).find((x) => x.choice === choice)
      return o?.offered ? o.folds : null
    }
    // Channel has exactly five values: one per palette slot, nothing folds.
    expect(fold(['orders'], ['channel_group'], 'donut')).toBe(false)
    expect(fold(['orders'], ['day', 'channel_group'], 'area')).toBe(false)
    // Seven countries, or an open store list: past five, the rest is "Other".
    expect(fold(['orders'], ['country'], 'donut')).toBe(true)
    expect(fold(['orders'], ['day', 'store'], 'line')).toBe(true)
    expect(fold(['orders'], ['store', 'channel_group'], 'bar-stacked')).toBe(false)
    expect(fold(['orders'], ['channel_group', 'store'], 'bar-stacked')).toBe(true)
    // Measures as series never fold; a table never folds.
    expect(fold(['orders', 'deliveries'], ['day'], 'line')).toBe(false)
    expect(fold(['orders'], ['store'], 'table')).toBe(false)
  })
})

describe('suggestChoice (CTO demo builder pass)', () => {
  const dims = [
    { key: 'date', kind: 'time' as const, label: { en: 'Date', ar: '' }, values: [] },
    { key: 'store', kind: 'category' as const, label: { en: 'Store', ar: '' }, values: [] },
    { key: 'kind', kind: 'category' as const, label: { en: 'Kind', ar: '' }, values: [{ key: 'a', label: { en: 'A', ar: '' } }, { key: 'b', label: { en: 'B', ar: '' } }] },
  ]
  const ms = [{ key: 'n', area: 'x', shape: 'additive' as const, unit: 'count' as const, label: { en: 'N', ar: '' }, description: { en: '', ar: '' }, dimensions: ['date', 'store', 'kind'] }]
  const model = { areas: [{ key: 'x', available: true }], measures: ms, dimensions: dims }
  const pick = (dimensions: string[]) => suggestChoice(chartOffers({ measures: ['n'], dimensions }, model), { measures: ['n'], dimensions }, model)
  it('picks a KPI, a line, horizontal bars for stores, a donut for a small list, grouped bars for two', () => {
    expect(pick([])).toBe('kpi')
    expect(pick(['date'])).toBe('line')
    expect(pick(['store'])).toBe('bar-horizontal')
    expect(pick(['kind'])).toBe('donut')
    expect(pick(['store', 'kind'])).toBe('bar-grouped')
  })
  it('picks nothing without a measure', () => {
    expect(suggestChoice(chartOffers({ measures: [], dimensions: [] }, model), { measures: [], dimensions: [] }, model)).toBeNull()
  })
})

describe('shape rules with named series (825): line, area, bar, combo, table and KPI take series; donut and heatmap do not', () => {
  const withSeries = (measures: string[], dimensions: string[]) =>
    chartOffers({ measures, dimensions, series: 2 }, MODEL).filter((o) => o.offered).map((o) => o.choice)
  const why = (measures: string[], dimensions: string[], choice: ChartChoice) => {
    const o = chartOffers({ measures, dimensions, series: 2 }, MODEL).find((x) => x.choice === choice)!
    return o.offered ? 'offered' : o.reason
  }

  it('one measure over time: line, area, grouped bars, table; never a stack (its height would be a total)', () => {
    expect(withSeries(['orders'], ['day'])).toEqual(['kpi', 'line', 'area', 'bar-vertical', 'bar-horizontal', 'bar-grouped', 'table'])
    expect(why(['orders'], ['day'], 'bar-stacked')).toBe('seriesStacked')
  })

  it('one figure: a KPI per series', () => {
    expect(withSeries(['orders'], [])).toContain('kpi')
  })

  it('donut and heatmap are refused with series', () => {
    expect(why(['orders'], ['channel_group'], 'donut')).toBe('seriesForm')
    expect(why(['orders'], ['channel_group', 'day'], 'heatmap')).toBe('seriesForm')
  })

  it('combo keeps its own shape: a volume and a rate over one axis', () => {
    expect(why(['orders', 'return_rate'], ['day'], 'combo')).toBe('offered')
    // Two measures are a combo's, not a line's: the series are the colour role.
    expect(why(['orders', 'till_value'], ['day'], 'line')).toBe('seriesShape')
  })
})

describe('shape rules: a calculated column is a rate measure (spec 3519 D2, D25)', () => {
  const withCalc = (measures: string[], dimensions: string[], calculations: number) => chartOffers({ measures, dimensions, calculations }, MODEL)
  const reason = (o: ReturnType<typeof withCalc>, choice: ChartChoice) => {
    const x = o.find((y) => y.choice === choice)
    return x && !x.offered ? x.reason : null
  }

  it('refuses a donut and a stacked bar for a value and its share, and allows the share as a combo line', () => {
    const o = withCalc(['orders'], ['channel_group'], 1)
    expect(reason(o, 'donut')).toBe('donutShape')
    expect(reason(o, 'bar-stacked')).toBe('rateStacked')
    expect(o.find((x) => x.choice === 'combo')?.offered).toBe(true)
    expect(o.find((x) => x.choice === 'bar-grouped')?.offered).toBe(true)
  })

  it('counts the calculated column against the measure caps', () => {
    // A KPI is one measure: a value and its share are two.
    expect(reason(withCalc(['orders'], [], 1), 'kpi')).toBe('kpiShape')
    // A combo takes exactly one volume and one rate.
    expect(reason(withCalc(['orders', 'return_rate'], ['channel_group'], 1), 'combo')).toBe('comboShape')
  })

  it('offers what it always did without calculations', () => {
    expect(withCalc(['orders'], ['channel_group'], 0)).toEqual(offers(['orders'], ['channel_group']))
  })
})
