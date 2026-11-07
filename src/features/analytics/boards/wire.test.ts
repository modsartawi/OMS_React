import i18next from 'i18next'
import { describe, expect, it } from 'vitest'
import { ApiError } from '@/core/api'
import en from '@/locales/en/boards.json'
import ar from '@/locales/ar/boards.json'
import { refusedParam } from './panel-state'
import { analyticsErrorWords, analyticsRefusal, readDefinition, readItem, readItems, readModel, readReport, readResult, readWords } from './wire'

const coded = (code: string, message = `Server says ${code}.`) =>
  new ApiError('business', message, 403, [{ errorCode: code, internalErrorCode: '', errorMessage: message }])

const instance = i18next.createInstance()
await instance.init({ lng: 'en', resources: { en: { boards: en }, ar: { boards: ar } }, defaultNS: 'boards', interpolation: { escapeValue: false } })

describe('analytics wire', () => {
  it("a failure's words: a known code's own key, else the server's message, else the fallback — never one fixed string", () => {
    const t = instance.getFixedT('en', 'boards')
    expect(analyticsErrorWords(coded('ANALYTICS-404'), 'The latest revision could not be loaded.', t)).toBe(en.refusal.notFound)
    expect(analyticsErrorWords(coded('ANALYTICS-499', 'The store is read-only today.'), 'fallback', t)).toBe('The store is read-only today.')
    expect(analyticsErrorWords(new Error('boom'), 'The latest revision could not be loaded.', t)).toBe('The latest revision could not be loaded.')
  })

  it('each of ANALYTICS-401/404/406/407/410 maps to its i18n key, an unknown code falls back to the server message', () => {
    expect(analyticsRefusal(coded('ANALYTICS-401'), 'fallback')).toEqual({ code: 'ANALYTICS-401', key: 'refusal.noAccess' })
    expect(analyticsRefusal(coded('ANALYTICS-404'), 'fallback')).toEqual({ code: 'ANALYTICS-404', key: 'refusal.notFound' })
    // 773: the panel's retry states word themselves.
    expect(analyticsRefusal(coded('ANALYTICS-408'), 'fallback')).toEqual({ code: 'ANALYTICS-408', key: 'refusal.timedOut' })
    expect(analyticsRefusal(coded('ANALYTICS-409'), 'fallback')).toEqual({ code: 'ANALYTICS-409', key: 'refusal.engineDown' })
    expect(analyticsRefusal(coded('ANALYTICS-406'), 'fallback')).toEqual({ code: 'ANALYTICS-406', key: 'refusal.invalid' })
    expect(analyticsRefusal(coded('ANALYTICS-407'), 'fallback')).toEqual({ code: 'ANALYTICS-407', key: 'refusal.window' })
    expect(analyticsRefusal(coded('ANALYTICS-410'), 'fallback')).toEqual({ code: 'ANALYTICS-410', key: 'refusal.areaUnavailable' })
    // 822: the author grant's refusal.
    expect(analyticsRefusal(coded('ANALYTICS-415'), 'fallback')).toEqual({ code: 'ANALYTICS-415', key: 'refusal.needsAuthor' })
    // 825: an invalid declaration at save (a series problem, among others).
    expect(analyticsRefusal(coded('ANALYTICS-411'), 'fallback')).toEqual({ code: 'ANALYTICS-411', key: 'refusal.declaration' })
    expect(analyticsRefusal(coded('ANALYTICS-499', 'Something new.'), 'fallback')).toEqual({ code: 'ANALYTICS-499', message: 'Something new.' })
    expect(analyticsRefusal(new Error('boom'), 'The view could not be drawn.')).toEqual({ code: null, message: 'The view could not be drawn.' })

    // Each key has words in both languages, and none of them is the raw code.
    for (const key of ['refusal.noAccess', 'refusal.notFound', 'refusal.timedOut', 'refusal.engineDown', 'refusal.invalid', 'refusal.window', 'refusal.areaUnavailable', 'refusal.needsAuthor', 'refusal.declaration']) {
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

describe('analytics wire: parameters at run (823)', () => {
  it('ANALYTICS-412 maps to its words, in both languages', () => {
    expect(analyticsRefusal(coded('ANALYTICS-412'), 'fallback')).toEqual({ code: 'ANALYTICS-412', key: 'refusal.invalidValue' })
    for (const lng of ['en', 'ar']) expect(instance.exists('refusal.invalidValue', { lng })).toBe(true)
  })

  it('absent notReached and fellBack read as empty; entries without a parameter are left out', () => {
    expect(readResult({})).toMatchObject({ notReached: [], fellBack: [] })
    expect(readResult({ notReached: [{ param: 'stores', reason: 'notInArea' }, { reason: 'x' }], fellBack: [{ param: 'channel' }, 'junk'] })).toMatchObject({
      notReached: [{ param: 'stores', reason: 'notInArea' }],
      fellBack: [{ param: 'channel' }],
    })
  })

  it('a 412 names its parameter (data.param, else data.field); any other code names none', () => {
    expect(refusedParam('ANALYTICS-412', { param: 'top' })).toBe('top')
    expect(refusedParam('ANALYTICS-412', { field: 'stores' })).toBe('stores')
    expect(refusedParam('ANALYTICS-412', null)).toBeNull()
    expect(refusedParam('ANALYTICS-406', { param: 'top' })).toBeNull()
  })
})

describe('reading named series (825)', () => {
  it('reads absent series as absent, so a v1 definition stays byte-identical', () => {
    expect('series' in readDefinition({ chart: { type: 'bar' }, query: { measures: ['orders'] } })).toBe(false)
  })
  it('reads each series tolerantly: its id, both labels, its filters; one without an id is left out', () => {
    expect(
      readDefinition({
        chart: { type: 'line' },
        query: {},
        series: [{ id: 'hs', label: { en: 'HungerStation' }, filters: [{ dimension: 'channel_group', values: ['hungerstation'] }] }, { label: { en: 'nameless' } }, { id: 'qc' }],
      }).series,
    ).toEqual([
      { id: 'hs', label: { en: 'HungerStation', ar: '' }, filters: [{ dimension: 'channel_group', values: ['hungerstation'] }] },
      { id: 'qc', label: { en: '', ar: '' }, filters: [] },
    ])
  })
})

describe('reading a report (827)', () => {
  const panel = { id: 'p1', kind: 'panel', title: { en: 'Net sales' }, definition: { chart: { type: 'bar' }, query: { measures: ['net_value'], dimensions: ['channel_group'] } }, from: { viewId: 'v-9', revision: 3 }, sourceChangedSinceCopy: true }
  const raw = {
    id: 'r-1',
    kind: 'report',
    title: { en: 'Channel sales', ar: 'مبيعات القنوات' },
    revision: 3,
    definition: {
      params: [{ name: 'period', kind: 'period', label: { en: 'Period' }, required: true, default: { kind: 'period', token: 'yesterday' } }, { name: 'broken' }],
      bindings: { period: { p1: true } },
      sections: [
        { id: 's1', heading: { en: 'Sales' }, blocks: [panel, { id: 't1', kind: 'text', text: { en: 'Took {p1:total}.' } }, { id: 'x', kind: 'video' }, { kind: 'text' }] },
        { id: 's2', blocks: [{ id: 'sum', kind: 'summary' }] },
      ],
    },
  }

  it('reads sections and blocks in order, each panel with its inline definition and provenance', () => {
    const r = readReport(raw)
    expect(r.kind).toBe('report')
    expect(r.definition.sections.map((s) => [s.id, s.blocks.map((b) => `${b.kind}:${b.id}`)])).toEqual([
      ['s1', ['panel:p1', 'text:t1']],
      ['s2', ['summary:sum']],
    ])
    const p = r.definition.sections[0].blocks[0]
    expect(p.kind === 'panel' && [p.title, p.definition.query.filters, p.from, p.sourceChangedSinceCopy]).toEqual([{ en: 'Net sales', ar: '' }, [], { viewId: 'v-9', revision: 3 }, true])
    expect(r.definition.sections[1].heading).toEqual({ en: '', ar: '' })
  })

  it('keeps the well-formed parameters and the bindings; absent ones read empty', () => {
    const r = readReport(raw)
    expect(r.definition.params.map((p) => p.name)).toEqual(['period'])
    expect(r.definition.bindings).toEqual({ period: { p1: true } })
    expect(readReport({ id: 'r-2', kind: 'report' }).definition).toEqual({ params: [], bindings: {}, sections: [] })
  })

  it('reads the Words answer: each figure’s words in both languages, the summary written or unavailable, absent → none', () => {
    // 835 live walk: the server answers { value, formatted { en, ar } } per token (3408 §F); a bare string reads as both.
    const figures = {
      '{{fig:p1:net}}': { value: 388953.76, formatted: { en: 'SAR 388,953.76', ar: '388,953.76 SAR' } },
      '{{fig:p2:rate:hs}}': '9.3%',
      '{{fig:p2:rate:qc}}': { value: null, formatted: { en: '', ar: '' } },
      '{{fig:p3:x}}': 4,
    }
    expect(readWords({ figures, summary: { text: { en: 'Up.' } } })).toEqual({
      figures: { '{{fig:p1:net}}': { en: 'SAR 388,953.76', ar: '388,953.76 SAR' }, '{{fig:p2:rate:hs}}': { en: '9.3%', ar: '9.3%' } },
      summary: { text: { en: 'Up.', ar: '' } },
    })
    expect(readWords({ summary: { unavailable: 'numbers did not match' } })).toEqual({ figures: {}, summary: { unavailable: 'numbers did not match' } })
    expect(readWords(null)).toEqual({ figures: {}, summary: null })
  })

  it('reads the model’s caveat and may-still-rise window, dropping malformed ones', () => {
    const m = readModel({ measures: [{ key: 'a', caveat: { en: 'Inside OMS only' }, mayStillRiseDays: 8 }, { key: 'b', caveat: 'x', mayStillRiseDays: -1 }] })
    expect([m.measures[0].caveat, m.measures[0].mayStillRiseDays]).toEqual([{ en: 'Inside OMS only', ar: '' }, 8])
    expect([m.measures[1].caveat, m.measures[1].mayStillRiseDays]).toEqual([null, null])
  })
})
