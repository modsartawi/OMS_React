import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import i18next from 'i18next'
import { I18nextProvider } from 'react-i18next'
import { describe, expect, it } from 'vitest'
import boards from '@/locales/en/boards.json'
import boardsAr from '@/locales/ar/boards.json'
import { NEW_VIEW_PATH } from '@/core/analytics-routes'
import type { AnalyticsModel } from '@/core/models/analytics'
import type { CopilotAnswerTable, CopilotTableColumn } from '@/core/models/copilot'
import { tableColumnDefs } from '@/core/charts/table-columns'
import { FSI, PDI } from '@/core/util/bidi'
import ComputedColumnsNote from './ComputedColumnsNote'
import CopilotTableTitle from './CopilotTableTitle'
import {
  copilotTableComputedColumns,
  copilotTableDefinition,
  copilotTableDownload,
  copilotTableFileBase,
  copilotTableOpenAsView,
  copilotTableOpensAsView,
  copilotTableParts,
  copilotTableResult,
  copilotTableTitle,
  copilotTableView,
} from './copilot-table'
import { readEditorSeed } from './editor'
import { lastYearNotes } from './last-year'
import { panelCsv, panelSheet } from './panel-table'

// Ticket 878 (BackOffice spec 3587 B22, B13): an analysis result's tables as SIS.Api 3621 sends them
// (CopilotPartTables.cs), and an answer table with last year as 3607 sends it (CopilotPanelTables.cs).

const column = (key: string, role: 'dimension' | 'measure', en: string, ar: string, unit: string | null = null, shape: string | null = null): CopilotTableColumn => ({
  key,
  role,
  label: { en, ar },
  unit,
  shape,
  dateBasis: null,
  calculation: null,
  variant: null,
})

const NOTES = { untilReached: null, untilReachedByParent: null, notSplit: null, notFiltered: null, dataGap: null }

/** A plain query's table, as today (868): no title. */
const plain = (over: Partial<CopilotAnswerTable> = {}): CopilotAnswerTable => ({
  step: 1,
  columns: [column('city', 'dimension', 'City', 'المدينة'), column('deliveries', 'measure', 'Deliveries', 'التوصيلات', 'count', 'additive')],
  rows: [
    { values: ['Riyadh', '1204'], isTotal: null },
    { values: ['Jeddah', '880'], isTotal: null },
  ],
  total: 2,
  truncated: false,
  periodFrom: '2026-10-30',
  periodTo: '2026-11-05',
  previous: null,
  previousFrom: null,
  previousTo: null,
  dataAsOf: '2026-11-11T08:00:00',
  notes: { ...NOTES },
  query: { measures: ['deliveries'], dimensions: ['city'], filters: [], period: 'last-7-days' },
  ...over,
})

/** One cut of a "what changed" result (3621's Build notes): the tool's own texts, its computed columns, its inner query. */
const cut = (key: string, en: string, ar: string, rows: (string | null)[][], over: Partial<CopilotAnswerTable> = {}): CopilotAnswerTable => ({
  step: 0,
  title: { en, ar },
  columns: [
    column(key, 'dimension', en, ar),
    column('before', 'measure', 'Before', 'قبل', 'SAR', 'additive'),
    column('after', 'measure', 'After', 'بعد', 'SAR', 'additive'),
    column('change', 'measure', 'Change', 'التغيّر', 'SAR', 'additive'),
    column('share', 'measure', 'Share of the change', 'الحصة من التغيّر', 'percent', 'rate'),
  ],
  rows: rows.map((values) => ({ values, isTotal: null })),
  total: 11,
  truncated: false,
  periodFrom: '2026-10-30',
  periodTo: '2026-11-05',
  previous: null,
  previousFrom: '2026-10-23',
  previousTo: '2026-10-29',
  dataAsOf: '2026-11-11T08:00:00',
  notes: { ...NOTES },
  query: { measures: ['net_till_value_sar'], dimensions: [key], filters: [], period: 'last-7-days', compareToPrevious: true },
  ...over,
})

const byCity = cut('city', 'City', 'المدينة', [
  ['Riyadh', '3000', '2380', '-620', '62.0%'],
  ['Jeddah', '1500.5', '1250.25', '-250.25', '25.0%'],
  ['Abha', '90', '80', '-10', '9.5%'],
  ['Dammam', '400', '430', '30', '-3.0%'],
])

const byChannel = cut('channel', 'Channel', 'القناة', [['Online', '900', '500', '-400', '40.0%']])
const byCategory = cut('category', 'Category', 'الفئة', [['OTC', '700', '400', '-300', '30.0%']])
/** One analysis: three cuts, all on the one step of its tool call. */
const THREE = [byCity, byChannel, byCategory]

const EMPTY_MODEL: AnalyticsModel = { areas: [], measures: [], dimensions: [] }
const WORDS = { series: 'Series', previous: (m: string) => `${m} (previous period)`, lastYear: (m: string, range: string) => `${m} (last year, ${range})`, all: 'All' }
const viewOf = (t: CopilotAnswerTable, lang = 'en', model: AnalyticsModel = EMPTY_MODEL) => copilotTableView(copilotTableParts(t, model), lang, WORDS)
const csvOf = (t: CopilotAnswerTable, lang = 'en') => panelCsv(copilotTableDownload(copilotTableParts(t, EMPTY_MODEL), lang, WORDS)).split('\r\n')

describe("an analysis result's tables in the copilot panel (spec 3587 B22; ticket 878)", () => {
  describe('the title', () => {
    it('aTableWithATitle_showsItInThePanelsLanguage', () => {
      expect(copilotTableTitle(byCity, 'en')).toBe('City')
      expect(copilotTableTitle(byCity, 'ar')).toBe('المدينة')
      expect(copilotTableTitle(byCity, 'ar-SA')).toBe('المدينة')
    })

    it('aTitleWithNoArabic_readsInEnglish_ratherThanBlank', () => {
      expect(copilotTableTitle({ ...byCity, title: { en: 'The headline', ar: '' } }, 'ar')).toBe('The headline')
    })

    const heading = (t: CopilotAnswerTable, lang: string) => renderToStaticMarkup(createElement(CopilotTableTitle, { table: t, lang, id: 'title-1' }))

    it('theTitle_isDrawnAboveTheTable_asOneIsolatedText_thatCanNameTheTable', () => {
      expect(heading(byCity, 'en')).toBe('<span class="text-sm font-medium" id="title-1" data-copilot-table-title="true"><bdi>City</bdi></span>')
      expect(heading(byCity, 'ar')).toContain('<bdi>المدينة</bdi>')
    })

    it('aTableWithoutATitle_drawsNothingAboveIt_asToday', () => {
      expect(heading(plain(), 'en')).toBe('')
      expect(heading(plain({ title: null }), 'ar')).toBe('')
    })

    it('aTableWithoutATitle_hasNone', () => {
      expect(copilotTableTitle(plain(), 'en')).toBe('')
      expect(copilotTableTitle(plain({ title: null }), 'ar')).toBe('')
      expect(copilotTableTitle(plain({ title: { en: '  ', ar: '' } }), 'en')).toBe('')
    })
  })

  describe('the columns the analysis computed', () => {
    it('everyColumnSent_isShown_inTheOrderSent_underTheWiresLabels', () => {
      expect(viewOf(byCity).columns.map((c) => [c.key, c.role, c.label])).toEqual([
        ['city', 'dimension', 'City'],
        ['before', 'measure', 'Before'],
        ['after', 'measure', 'After'],
        ['change', 'measure', 'Change'],
        ['share', 'measure', 'Share of the change'],
      ])
      expect(viewOf(byCity, 'ar').columns.map((c) => c.label)).toEqual(['المدينة', 'قبل', 'بعد', 'التغيّر', 'الحصة من التغيّر'])
    })

    it('everyCell_isTheServersText_asSent_neverReformattedOrComputed', () => {
      const view = viewOf(byCity)
      // "1500.5" stays "1500.5" (not "SAR 1,500.50"), "62.0%" stays "62.0%", and the order is the server's.
      expect(view.rows).toEqual([
        { city: 'Riyadh', before: '3000', after: '2380', change: '-620', share: '62.0%' },
        { city: 'Jeddah', before: '1500.5', after: '1250.25', change: '-250.25', share: '25.0%' },
        { city: 'Abha', before: '90', after: '80', change: '-10', share: '9.5%' },
        { city: 'Dammam', before: '400', after: '430', change: '30', share: '-3.0%' },
      ])
      expect(view.sort).toBeNull()
      expect(view.cut).toBe(false)
      expect(view.empty).toBe(false)
      // The same texts under Arabic: a figure is not localised either.
      expect(viewOf(byCity, 'ar').rows.map((r) => r.share)).toEqual(['62.0%', '25.0%', '9.5%', '-3.0%'])
    })

    it('aCellWithNoFigure_staysEmpty', () => {
      const view = viewOf(cut('city', 'City', 'المدينة', [['Tabuk', null, '40', '40', null]]))
      expect(view.rows).toEqual([{ city: 'Tabuk', before: null, after: '40', change: '40', share: null }])
    })

    it('aMember_isNamedByTheModel_asOnAnOrdinaryTable', () => {
      const model: AnalyticsModel = {
        areas: [],
        measures: [],
        dimensions: [{ key: 'city', kind: 'category', label: { en: 'City (model)', ar: 'م' }, values: [{ key: 'Riyadh', label: { en: 'Riyadh City', ar: 'الرياض' } }] }],
      }
      const view = viewOf(byCity, 'ar', model)
      expect(view.rows.map((r) => r.city)).toEqual(['الرياض', 'Jeddah', 'Abha', 'Dammam'])
      // The header stays the wire's.
      expect(view.columns[0].label).toBe('المدينة')
    })

    it('thePreviousPeriodsDays_withoutItsRows_drawNoComparisonColumn', () => {
      // 3621: `previous` is null while `previousFrom` / `previousTo` hold the comparison's days.
      expect(byCity.previous).toBeNull()
      expect(byCity.previousFrom).toBe('2026-10-23')
      expect(viewOf(byCity).columns.map((c) => c.key)).toEqual(['city', 'before', 'after', 'change', 'share'])
      expect(Object.keys(viewOf(byCity).rows[0])).toEqual(['city', 'before', 'after', 'change', 'share'])
    })
  })

  describe('sorting by a computed column', () => {
    // What a header click does: the grid orders the view's rows by the column's own comparator (`tableColumnDefs`).
    const sortedBy = (key: string, direction: 'asc' | 'desc') => {
      const view = viewOf(byCity)
      const compare = tableColumnDefs(view.columns, view.sort, 'en').find((d) => d.colId === key)!.comparator as unknown as (a: unknown, b: unknown) => number
      const rows = [...view.rows].sort((a, b) => compare(a[key], b[key]))
      return (direction === 'asc' ? rows : rows.reverse()).map((r) => `${r.city} ${r[key]}`)
    }

    it('theShare_sortsByNumber_andEveryCellStillReadsAsSent', () => {
      // As text, "9.5%" would sort above "62.0%" and "25.0%".
      expect(sortedBy('share', 'desc')).toEqual(['Riyadh 62.0%', 'Jeddah 25.0%', 'Abha 9.5%', 'Dammam -3.0%'])
    })

    it('theChange_sortsByNumber_negativesBelowPositives', () => {
      // As text, "-10" would sort below "-250.25" and "-620".
      expect(sortedBy('change', 'asc')).toEqual(['Riyadh -620', 'Jeddah -250.25', 'Abha -10', 'Dammam 30'])
      expect(sortedBy('before', 'desc')).toEqual(['Riyadh 3000', 'Jeddah 1500.5', 'Dammam 400', 'Abha 90'])
    })
  })

  describe('the downloads of an analysis table', () => {
    it('theCsv_writesEveryColumnAndEveryText_asSent', () => {
      expect(csvOf(byCity)).toEqual([
        '\uFEFFCity,Before,After,Change,Share of the change',
        'Riyadh,3000,2380,-620,62.0%',
        'Jeddah,1500.5,1250.25,-250.25,25.0%',
        'Abha,90,80,-10,9.5%',
        'Dammam,400,430,30,-3.0%',
        '',
      ])
      expect(csvOf(byCity, 'ar')[0]).toBe('\uFEFFالمدينة,قبل,بعد,التغيّر,الحصة من التغيّر')
    })

    it('theXlsx_writesTheTextsAsSent_notNumbersItWorkedOut', () => {
      const sheet = panelSheet(copilotTableDownload(copilotTableParts(byCity, EMPTY_MODEL), 'en', WORDS), 'City')
      expect(sheet.data[0].map((c) => (c as { value: unknown }).value)).toEqual(['City', 'Before', 'After', 'Change', 'Share of the change'])
      expect(sheet.data[2]).toEqual([
        { type: String, value: 'Jeddah' },
        { type: String, value: '1500.5' },
        { type: String, value: '1250.25' },
        { type: String, value: '-250.25' },
        { type: String, value: '25.0%' },
      ])
    })
  })

  describe('three tables of one analysis share a step', () => {
    it('eachIsDrawnUnderItsOwnTitle_withItsOwnRows_inTheOrderSent', () => {
      expect(THREE.map((t) => t.step)).toEqual([0, 0, 0])
      expect(THREE.map((t) => copilotTableTitle(t, 'en'))).toEqual(['City', 'Channel', 'Category'])
      expect(THREE.map((t) => copilotTableTitle(t, 'ar'))).toEqual(['المدينة', 'القناة', 'الفئة'])
      expect(THREE.map((t) => viewOf(t).rows[0])).toEqual([
        { city: 'Riyadh', before: '3000', after: '2380', change: '-620', share: '62.0%' },
        { channel: 'Online', before: '900', after: '500', change: '-400', share: '40.0%' },
        { category: 'OTC', before: '700', after: '400', change: '-300', share: '30.0%' },
      ])
    })

    it('eachDownloadsUnderItsOwnName_byItsPlaceAsWellAsItsStep', () => {
      expect(THREE.map((t, i) => copilotTableFileBase(t, i))).toEqual(['analytics-copilot-0-1', 'analytics-copilot-0-2', 'analytics-copilot-0-3'])
    })

    it('aPlainQuerysTable_keepsTodaysDownloadName_whereverItSits', () => {
      expect(copilotTableFileBase(plain(), 0)).toBe('analytics-copilot-1')
      expect(copilotTableFileBase(plain({ step: 4 }), 2)).toBe('analytics-copilot-4')
    })
  })

  describe('"Open as view" on an analysis table', () => {
    const instance = i18next.createInstance()
    instance.init({ lng: 'en', resources: { en: { boards }, ar: { boards: boardsAr } }, ns: ['boards'], defaultNS: 'boards', initAsync: false })
    const note = (columns: string[], lang: string) =>
      renderToStaticMarkup(createElement(I18nextProvider, { i18n: instance.cloneInstance({ lng: lang }) }, createElement(ComputedColumnsNote, { columns, lang })))

    it('opensTheTablesOwnQuery_withoutTheColumnsTheAnalysisComputed', () => {
      const link = copilotTableOpenAsView(copilotTableDefinition(byCity))
      expect(link.to).toBe(NEW_VIEW_PATH)
      expect(readEditorSeed(link.state)?.definition).toEqual({
        chart: { type: 'table' },
        query: { measures: ['net_till_value_sar'], dimensions: ['city'], filters: [], period: 'last-7-days', compareToPrevious: true },
      })
      expect(copilotTableOpensAsView(byCity)).toBe(true)
    })

    it('againstLastYear_theQueryKeepsItsComparison', () => {
      const lastYear = cut('city', 'City', 'المدينة', [['Riyadh', '3100', '2380', '-720', '80.0%']], {
        previousFrom: '2025-10-31',
        previousTo: '2025-11-06',
        query: { measures: ['net_till_value_sar'], dimensions: ['city'], filters: [], period: 'last-7-days', compareToLastYear: true },
      })
      expect(readEditorSeed(copilotTableOpenAsView(copilotTableDefinition(lastYear)).state)?.definition.query).toEqual({
        measures: ['net_till_value_sar'],
        dimensions: ['city'],
        filters: [],
        period: 'last-7-days',
        compareToLastYear: true,
      })
    })

    it('theColumnsNotInItsQuery_areTheOnesTheAnalysisComputed_inTheScreensLanguage', () => {
      expect(copilotTableComputedColumns(byCity, copilotTableDefinition(byCity), 'en')).toEqual(['Before', 'After', 'Change', 'Share of the change'])
      expect(copilotTableComputedColumns(byCity, copilotTableDefinition(byCity), 'ar')).toEqual(['قبل', 'بعد', 'التغيّر', 'الحصة من التغيّر'])
    })

    it('theNote_saysSoInOneLine_inBothLanguages', () => {
      const en = note(['Before', 'After', 'Change', 'Share of the change'], 'en')
      expect(en).toContain(`Open as view shows the table&#x27;s query only, without ${FSI}Before, After, Change, and Share of the change${PDI} (computed by the analysis).`)
      expect(en).toContain('data-copilot-table-computed-note')
      const ar = note(['قبل', 'بعد', 'التغيّر', 'الحصة من التغيّر'], 'ar')
      expect(ar).toContain(`«فتح كعرض» يعرض استعلام الجدول فقط، دون ${FSI}قبل وبعد والتغيّر والحصة من التغيّر${PDI} (من حساب التحليل).`)
    })

    it('aTableWhoseEveryColumnIsInItsQuery_hasNoNote', () => {
      const whole = cut('city', 'City', 'المدينة', [['Riyadh', '3000']], {
        columns: [column('city', 'dimension', 'City', 'المدينة'), column('net_till_value_sar', 'measure', 'Net till value', 'صافي قيمة الصندوق', 'SAR', 'additive')],
      })
      expect(copilotTableComputedColumns(whole, copilotTableDefinition(whole), 'en')).toEqual([])
      expect(note([], 'en')).toBe('')
    })

    it('aPartFromNoSingleQuery_offersNoOpenAsView_andNoNote', () => {
      const headline = cut('figure', 'The headline', 'الخلاصة', [['Net till value', '3000', '2380', '-620', '100.0%']], { query: {} })
      expect(copilotTableOpensAsView(headline)).toBe(false)
      expect(copilotTableOpensAsView({ ...headline, query: { show: true } })).toBe(false)
      expect(copilotTableComputedColumns(headline, copilotTableDefinition(headline), 'en')).toEqual([])
      // It is still drawn, whole.
      expect(viewOf(headline).rows).toEqual([{ figure: 'Net till value', before: '3000', after: '2380', change: '-620', share: '100.0%' }])
    })

    it('aPlainQuerysTable_isOfferedOpenAsView_asToday_andNeverHasTheNote', () => {
      expect(copilotTableOpensAsView(plain())).toBe(true)
      // Whatever its query holds: only the empty query of a part from no single query is not opened.
      expect(copilotTableOpensAsView(plain({ query: { dimensions: ['city'], variants: [{ key: 'otc', measure: 'deliveries', filters: [] }] } }))).toBe(true)
      expect(copilotTableComputedColumns(plain(), copilotTableDefinition(plain()), 'en')).toEqual([])
      // Even with a column its query does not name: only an analysis result's table computes columns of its own.
      const odd = plain({ columns: [...plain().columns, column('extra', 'measure', 'Extra', 'إضافي', 'count', 'additive')] })
      expect(copilotTableComputedColumns(odd, copilotTableDefinition(odd), 'en')).toEqual([])
    })
  })

  describe('a copilot table with the same weeks last year (spec 3587 B13; wire 3607)', () => {
    const row = (...values: (string | null)[]) => ({ values, isTotal: null })
    const asked = (over: Partial<CopilotAnswerTable> = {}) =>
      plain({
        lastYear: [row('Jeddah', '900'), row('Riyadh', '1100')],
        lastYearFrom: '2025-10-31',
        lastYearTo: '2025-11-06',
        query: { measures: ['deliveries'], dimensions: ['city'], filters: [], period: 'last-7-days', compareToLastYear: true },
        ...over,
      })
    const LAST_YEAR = 'Deliveries (last year, Oct 31, 2025 – Nov 6, 2025)'

    it('aTableWithLastYearsRows_showsTheLastYearColumn_asTheQueryBuildersTableDoes', () => {
      const view = viewOf(asked())
      expect(view.columns.map((c) => [c.key, c.label])).toEqual([
        ['city', 'City'],
        ['deliveries', 'Deliveries'],
        ['deliveries:lastYear', LAST_YEAR],
      ])
      // Matched by member, not by place; the rows stay in the order sent.
      expect(view.rows).toEqual([
        { city: 'Riyadh', deliveries: 1204, 'deliveries:lastYear': 1100 },
        { city: 'Jeddah', deliveries: 880, 'deliveries:lastYear': 900 },
      ])
    })

    it('theDownloadsCarryTheLastYearColumn', () => {
      expect(csvOf(asked())).toEqual([`﻿City,Deliveries,"${LAST_YEAR}"`, 'Riyadh,1204,1100', 'Jeddah,880,900', ''])
    })

    it('withBothComparisons_thePreviousPeriodComesFirst_thenLastYear', () => {
      const both = asked({ previous: [row('Riyadh', '1000'), row('Jeddah', '870')], previousFrom: '2026-10-23', previousTo: '2026-10-29' })
      expect(viewOf(both).columns.map((c) => c.label)).toEqual(['City', 'Deliveries', 'Deliveries (previous period)', LAST_YEAR])
      expect(viewOf(both).rows[0]).toEqual({ city: 'Riyadh', deliveries: 1204, 'deliveries:previous': 1000, 'deliveries:lastYear': 1100 })
    })

    it('lastYearNotHeld_drawsNoColumn_andTheNoteSaysTheDayTheDataStarts', () => {
      // 3607: asked and not held — `lastYear` is `[]`, the days are set, the note names the area's measures.
      const notHeld = asked({ lastYear: [], notes: { ...NOTES, lastYearNotHeld: [{ area: 'deliveries', dataFrom: '2026-01-01', measures: ['deliveries'] }] } })
      expect(viewOf(notHeld).columns.map((c) => c.key)).toEqual(['city', 'deliveries'])
      const parts = copilotTableParts(notHeld, EMPTY_MODEL)
      const words = { notHeld: (v: { measures: string; day: string }) => `Last year is not shown for ${v.measures}: the data starts on ${v.day}.`, notHeldNoDay: () => 'no day' }
      expect(lastYearNotes(parts.result, parts.model, 'en', words)).toEqual([`Last year is not shown for ${FSI}Deliveries${PDI}: the data starts on ${FSI}Jan 1, 2026${PDI}.`])
    })

    it('overSeveralAreas_onlyTheHeldMeasureGetsALastYearColumn', () => {
      const two = asked({
        columns: [...plain().columns, column('points', 'measure', 'Points', 'النقاط', 'count', 'additive')],
        rows: [row('Riyadh', '1204', '50')],
        // A not-held figure is empty last year; even a 0 sent by mistake draws no column.
        lastYear: [row('Riyadh', '1100', '0')],
        notes: { ...NOTES, lastYearNotHeld: [{ area: 'loyalty', dataFrom: '2026-01-01', measures: ['points'] }] },
        query: { measures: ['deliveries', 'points'], dimensions: ['city'], filters: [], compareToLastYear: true },
      })
      expect(viewOf(two).columns.map((c) => c.key)).toEqual(['city', 'deliveries', 'deliveries:lastYear', 'points'])
    })

    it('aTableThatDidNotAsk_isReadAsToday_withNoLastYearAnywhere', () => {
      for (const t of [plain(), plain({ lastYear: null, lastYearFrom: null, lastYearTo: null })]) {
        const result = copilotTableResult(t)
        expect('lastYear' in result).toBe(false)
        expect('lastYearPeriod' in result).toBe(false)
        expect('lastYearNotHeld' in result).toBe(false)
        expect(viewOf(t).columns.map((c) => c.key)).toEqual(['city', 'deliveries'])
      }
    })

    describe('a change column says which comparison it is from (columns[].calculation.from)', () => {
      const change = (key: string, label: string, from?: string): CopilotTableColumn => ({
        ...column(key, 'measure', label, label, 'percent', 'rate'),
        calculation: { kind: 'change', measure: 'deliveries', of: null, within: null, ...(from ? { from } : {}) },
      })
      const changes = (lastYearLabel: string) =>
        asked({
          columns: [...plain().columns, change('chg', 'chg'), change('chg_ly', lastYearLabel, 'lastYear')],
          rows: [row('Riyadh', '1204', '20.4', '9.5')],
          lastYear: [row('Riyadh', '1100', null, null)],
          query: {
            measures: ['deliveries'],
            dimensions: ['city'],
            filters: [],
            compareToPrevious: true,
            compareToLastYear: true,
            calculations: [
              { key: 'chg', kind: 'change', measure: 'deliveries' },
              { key: 'chg_ly', kind: 'change', measure: 'deliveries', from: 'lastYear' },
            ],
          },
        })
      const none = () => ''
      const NAMING = {
        lang: 'en',
        words: { shareOfTotal: none, ratio: none, cumulativeShare: none, average: none, shareOfTotalWithin: none, cumulativeShareWithin: none, change: none, changeLastYear: (v: { measure: string }) => `Change in ${v.measure} from last year` },
      }
      const labels = (t: CopilotAnswerTable, naming?: typeof NAMING) => copilotTableView(copilotTableParts(t, EMPTY_MODEL, naming), 'en', WORDS).columns.map((c) => c.label)

      it('theColumnsOrigin_isReadFromTheWire', () => {
        const result = copilotTableResult(changes('chg_ly'))
        expect(result.columns.find((c) => c.key === 'chg_ly')?.calculation).toEqual({ kind: 'change', measure: 'deliveries', from: 'lastYear' })
        expect(result.columns.find((c) => c.key === 'chg')?.calculation).toEqual({ kind: 'change', measure: 'deliveries' })
      })

      it('aChangeFromLastYear_theServerLeftUnnamed_isNamedFromLastYear', () => {
        expect(labels(changes('chg_ly'), NAMING)).toEqual(['City', 'Deliveries', LAST_YEAR, 'chg', 'Change in Deliveries from last year'])
      })

      it('aNameTheServerGave_wins_andEveryOtherColumnIsHeadedAsToday', () => {
        expect(labels(changes('Versus last year'), NAMING)).toEqual(['City', 'Deliveries', LAST_YEAR, 'chg', 'Versus last year'])
        expect(labels(plain(), NAMING)).toEqual(['City', 'Deliveries'])
      })
    })
  })

  describe('a table without a title renders as today', () => {
    it('aPlainQuerysTable_downloadsAsBefore_numbersRaw', () => {
      expect(csvOf(plain())).toEqual(['\uFEFFCity,Deliveries', 'Riyadh,1204', 'Jeddah,880', ''])
      const sheet = panelSheet(copilotTableDownload(copilotTableParts(plain(), EMPTY_MODEL), 'en', WORDS), 'Deliveries')
      expect(sheet.data[1]).toEqual([
        { type: String, value: 'Riyadh' },
        { type: Number, value: 1204 },
      ])
    })

    it('aPlainQuerysTable_isDrawnAsBefore_numbersFormattedByTheTableForm', () => {
      expect(viewOf(plain())).toEqual({
        kind: 'table',
        columns: [
          { key: 'city', role: 'dimension', label: 'City' },
          { key: 'deliveries', role: 'measure', label: 'Deliveries', unit: 'count', max: 1204 },
        ],
        rows: [
          { city: 'Riyadh', deliveries: 1204 },
          { city: 'Jeddah', deliveries: 880 },
        ],
        members: ['Riyadh', 'Jeddah'],
        sort: null,
        cut: false,
        empty: false,
      })
    })
  })
})
