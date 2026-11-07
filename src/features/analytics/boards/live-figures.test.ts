import { describe, expect, it } from 'vitest'
import type { AnalyticsModel, AnalyticsViewDefinition } from '@/core/models/analytics'
import { chipSegments, chipsText, figureToken, figuresOf, fillTokens, insertToken, tokensIn } from './live-figures'

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

// 835 live walk (BackOffice 3408 §F, the authority): a token is {{fig:<panel>:<measure>}} or
// {{fig:<panel>:<measure>:<series>}}; the Words door keys each figure by the token as written and answers
// { value, formatted { en, ar } }.
describe('live figure tokens', () => {
  it('parses every {{fig:…}} token in a text, in order', () => {
    expect(tokensIn('HungerStation sold {{fig:p2:net_value:hs}} against {{fig:p2:net_value:qc}}; total {{fig:p1:net_value}}.')).toEqual([
      { token: '{{fig:p2:net_value:hs}}', panel: 'p2', figure: 'net_value:hs', measure: 'net_value', series: 'hs' },
      { token: '{{fig:p2:net_value:qc}}', panel: 'p2', figure: 'net_value:qc', measure: 'net_value', series: 'qc' },
      { token: '{{fig:p1:net_value}}', panel: 'p1', figure: 'net_value', measure: 'net_value', series: null },
    ])
  })

  it('reads braces that are not a token as text — the web’s earlier {panel:figure} included', () => {
    expect(tokensIn('a {b} c {p1:total} {{fig:p1}} {{fig:p1:}} {{p1:x}}')).toEqual([])
  })

  it('fills each token from the Words answer in the reader’s language, keeping the text around it', () => {
    const figures = { '{{fig:p1:net_value}}': { en: 'SAR 1,250,000', ar: '1,250,000 SAR' } }
    expect(fillTokens('Tills took {{fig:p1:net_value}} in the period.', figures, 'en')).toEqual([
      { kind: 'text', text: 'Tills took ' },
      { kind: 'figure', token: '{{fig:p1:net_value}}', value: 'SAR 1,250,000' },
      { kind: 'text', text: ' in the period.' },
    ])
    expect(fillTokens('{{fig:p1:net_value}}', figures, 'ar')).toEqual([{ kind: 'figure', token: '{{fig:p1:net_value}}', value: '1,250,000 SAR' }])
  })

  it('an Arabic figure the answer left blank reads its English', () => {
    expect(fillTokens('{{fig:p3:rate:hs}}', { '{{fig:p3:rate:hs}}': { en: '4.2%', ar: '' } }, 'ar')).toEqual([{ kind: 'figure', token: '{{fig:p3:rate:hs}}', value: '4.2%' }])
  })

  it('renders a figure the answer lacks as missing — never the raw token as text', () => {
    const parts = fillTokens('Rates were {{fig:p3:rate:hs}} and {{fig:p3:rate:qc}}.', { '{{fig:p3:rate:hs}}': label('4.2%') }, 'en')
    expect(parts).toEqual([
      { kind: 'text', text: 'Rates were ' },
      { kind: 'figure', token: '{{fig:p3:rate:hs}}', value: '4.2%' },
      { kind: 'text', text: ' and ' },
      { kind: 'missing', token: '{{fig:p3:rate:qc}}' },
      { kind: 'text', text: '.' },
    ])
    expect(parts.filter((p) => p.kind === 'text').some((p) => p.text.includes('{{fig'))).toBe(false)
  })

  it('marks every token pending while no answer has come', () => {
    expect(fillTokens('{{fig:p1:net_value}}!', null, 'en')).toEqual([
      { kind: 'pending', token: '{{fig:p1:net_value}}' },
      { kind: 'text', text: '!' },
    ])
  })

  it('treats an empty figure (a selection with no data) as missing', () => {
    expect(fillTokens('{{fig:p1:net_value}}', { '{{fig:p1:net_value}}': label('') }, 'en')).toEqual([{ kind: 'missing', token: '{{fig:p1:net_value}}' }])
  })
})

describe('figuresOf', () => {
  it('offers each measure for each named series (there is no total across series)', () => {
    const series = [
      { id: 'hs', label: label('HungerStation'), filters: [] },
      { id: 'qc', label: label('QC'), filters: [] },
    ]
    expect(figuresOf(def(['cancellation_rate', 'net_value'], series), model).map((f) => f.figure)).toEqual([
      'cancellation_rate:hs',
      'cancellation_rate:qc',
      'net_value:hs',
      'net_value:qc',
    ])
  })

  it('offers each measure over the panel’s whole selection — a rate too (the server computes it Σ÷Σ)', () => {
    expect(figuresOf(def(['net_value', 'cancellation_rate']), model)).toEqual([
      { figure: 'net_value', measure: 'net_value', series: null },
      { figure: 'cancellation_rate', measure: 'cancellation_rate', series: null },
    ])
  })
})

describe('the designer’s tokens (829)', () => {
  it('a KPI offers its one figure whatever its shape', () => {
    const kpi: AnalyticsViewDefinition = { chart: { type: 'kpi' }, query: { measures: ['cancellation_rate'], dimensions: [], filters: [] } }
    expect(figuresOf(kpi, model)).toEqual([{ figure: 'cancellation_rate', measure: 'cancellation_rate', series: null }])
  })

  it('inserting a chip writes its token, spaced from the words around it', () => {
    const token = figureToken('p2', 'orders:hs')
    expect(token).toBe('{{fig:p2:orders:hs}}')
    expect(insertToken('HungerStation took orders', token, 18)).toEqual({ text: 'HungerStation took {{fig:p2:orders:hs}} orders', caret: 39 })
    expect(insertToken('', token)).toEqual({ text: token, caret: token.length })
    expect(insertToken('Took ', token).text).toBe(`Took ${token}`)
    expect(insertToken('Took', token, 4).text).toBe(`Took ${token}`)
    expect(insertToken('Took.', token, 4).text).toBe(`Took ${token}.`)
  })

  it('never inserts inside another token', () => {
    expect(insertToken('{{fig:p1:net_value}} sold', '{{fig:p2:orders:hs}}', 6).text).toBe('{{fig:p1:net_value}} {{fig:p2:orders:hs}} sold')
  })

  it('the text ↔ chip round-trip is exact', () => {
    const text = 'HungerStation took {{fig:p2:orders:hs}} against {{fig:p2:orders:qc}}.\n{{fig:p1:net_value}} in all'
    const segs = chipSegments(text)
    expect(segs.map((s) => s.kind)).toEqual(['text', 'chip', 'text', 'chip', 'text', 'chip', 'text'])
    expect(segs[1]).toEqual({ kind: 'chip', token: '{{fig:p2:orders:hs}}', panel: 'p2', figure: 'orders:hs' })
    expect(chipsText(segs)).toBe(text)
    expect(chipsText(chipSegments(''))).toBe('')
    // A brace that is no token stays words.
    expect(chipSegments('{not a token}')).toEqual([{ kind: 'text', text: '{not a token}' }])
  })
})
