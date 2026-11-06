import { describe, expect, it } from 'vitest'
import type { AnalyticsModel, AnalyticsViewDefinition } from '@/core/models/analytics'
import { figuresOf, fillTokens, tokensIn } from './live-figures'

const label = (en: string) => ({ en, ar: en })
const model: AnalyticsModel = {
  areas: [],
  measures: [
    { key: 'net_value', area: 'sales', shape: 'additive', unit: 'SAR', label: label('Net value'), description: label(''), dimensions: ['channel_group', 'day'] },
    { key: 'cancellation_rate', area: 'orders', shape: 'rate', unit: 'share', label: label('Cancellation rate'), description: label(''), dimensions: ['day'] },
  ],
  dimensions: [],
}
const def = (measures: string[], series?: AnalyticsViewDefinition['series']): AnalyticsViewDefinition => ({
  chart: { type: 'bar' },
  query: { measures, dimensions: ['day'], filters: [] },
  ...(series ? { series } : {}),
})

describe('live figure tokens', () => {
  it('parses every {panel:figure} token in a text, in order', () => {
    expect(tokensIn('HungerStation sold {p2:hs} against {p2:qc}; total {p1:total}.')).toEqual([
      { token: '{p2:hs}', panel: 'p2', figure: 'hs' },
      { token: '{p2:qc}', panel: 'p2', figure: 'qc' },
      { token: '{p1:total}', panel: 'p1', figure: 'total' },
    ])
  })

  it('reads braces that are not a token as text', () => {
    expect(tokensIn('a {b} c {P1:x} {p1:}')).toEqual([])
  })

  it('fills each token from the Words answer, keeping the text around it', () => {
    expect(fillTokens('Tills took {p1:total} in the period.', { '{p1:total}': 'SAR 1,250,000' })).toEqual([
      { kind: 'text', text: 'Tills took ' },
      { kind: 'figure', token: '{p1:total}', value: 'SAR 1,250,000' },
      { kind: 'text', text: ' in the period.' },
    ])
  })

  it('accepts a figure keyed without its braces (panel:figure)', () => {
    expect(fillTokens('{p3:hs}', { 'p3:hs': '4.2%' })).toEqual([{ kind: 'figure', token: '{p3:hs}', value: '4.2%' }])
  })

  it('renders a figure the answer lacks as missing — never the raw token as text', () => {
    const parts = fillTokens('Rates were {p3:hs} and {p3:qc}.', { '{p3:hs}': '4.2%' })
    expect(parts).toEqual([
      { kind: 'text', text: 'Rates were ' },
      { kind: 'figure', token: '{p3:hs}', value: '4.2%' },
      { kind: 'text', text: ' and ' },
      { kind: 'missing', token: '{p3:qc}' },
      { kind: 'text', text: '.' },
    ])
    expect(parts.filter((p) => p.kind === 'text').some((p) => p.text.includes('{p3:qc}'))).toBe(false)
  })

  it('marks every token pending while no answer has come', () => {
    expect(fillTokens('{p1:total}!', null)).toEqual([
      { kind: 'pending', token: '{p1:total}' },
      { kind: 'text', text: '!' },
    ])
  })

  it('treats an empty figure as missing', () => {
    expect(fillTokens('{p1:total}', { '{p1:total}': '' })).toEqual([{ kind: 'missing', token: '{p1:total}' }])
  })
})

describe('figuresOf', () => {
  it('offers one figure per named series', () => {
    const series = [
      { id: 'hs', label: label('HungerStation'), filters: [] },
      { id: 'qc', label: label('QC'), filters: [] },
    ]
    expect(figuresOf(def(['cancellation_rate'], series), model).map((f) => f.figure)).toEqual(['hs', 'qc'])
  })

  it('offers the total of an additive measure', () => {
    expect(figuresOf(def(['net_value']), model)).toEqual([{ figure: 'total', series: null }])
  })

  it('offers no single value for a rate without series (a rate has no total)', () => {
    expect(figuresOf(def(['cancellation_rate']), model)).toEqual([])
  })
})
