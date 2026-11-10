import { describe, expect, it } from 'vitest'
import type { AnalyticsModel } from '@/core/models/analytics'
import type { CopilotAnswerTable, CopilotTableColumn } from '@/core/models/copilot'
import { TABLE_DEFAULT_COL_DEF } from '@/core/charts/table-columns'
import { tableLayout } from '@/core/charts/table-layout'
import { OMS_GRID_HEADER_HEIGHT, OMS_GRID_ROW_HEIGHT } from '@/core/theme/ag-grid-theme'
import { FSI, PDI } from '@/core/util/bidi'
import { untilNote } from './calculations'
import { NEW_VIEW_PATH } from '@/core/analytics-routes'
import { readEditorSeed } from './editor'
import { copilotTableDefinition, copilotTableDownload, copilotTableOpenAsView, copilotTableModel, copilotTableResult, copilotTableView } from './copilot-table'
import { panelCsv } from './panel-table'
import { areaNotes, type AreaNoteWords } from './unsplit'

// Ticket 868 (BackOffice spec 3558 D5-D7, D13): the answer's tables as SIS.Api 3564 sends them (CopilotPanelTables.cs).

const dim = (key: string, en: string, ar: string): CopilotTableColumn => ({
  key,
  role: 'dimension',
  label: { en, ar },
  unit: null,
  shape: null,
  dateBasis: null,
  calculation: null,
  variant: null,
})
const measure = (key: string, en: string, ar: string, unit = 'count'): CopilotTableColumn => ({ ...dim(key, en, ar), role: 'measure', unit, shape: 'additive' })

const table = (over: Partial<CopilotAnswerTable> = {}): CopilotAnswerTable => ({
  step: 1,
  columns: [dim('city', 'City', 'المدينة'), measure('deliveries', 'Deliveries', 'التوصيلات')],
  rows: [],
  total: 0,
  truncated: false,
  periodFrom: '2026-10-01',
  periodTo: '2026-10-31',
  previous: null,
  previousFrom: null,
  previousTo: null,
  dataAsOf: '2026-11-11T08:00:00',
  notes: { untilReached: null, untilReachedByParent: null, notSplit: null, notFiltered: null, dataGap: null },
  query: { measures: ['deliveries'], dimensions: ['city'], filters: [], period: 'last-month' },
  ...over,
})

const EMPTY_MODEL: AnalyticsModel = { areas: [], measures: [], dimensions: [] }
const WORDS = { series: 'Series', previous: (m: string) => `${m} (previous period)`, all: 'All' }

// 152 cities, deliveries NOT in any sorted order: 7, 14, 21 … taken modulo 97, so a sort would visibly move them.
const ROWS_152 = Array.from({ length: 152 }, (_, i) => ({ values: [`C${String(i).padStart(3, '0')}`, String(((i + 1) * 7) % 97)], isTotal: null }))

describe('the copilot answer table (spec 3558 D5; ticket 868)', () => {
  it('a152RowTable_rendersEveryRow_inTheOrderSent_unsorted', () => {
    const view = copilotTableView(table({ rows: ROWS_152, total: 152 }), EMPTY_MODEL, 'en', WORDS)
    expect(view.rows).toHaveLength(152)
    expect(view.rows.slice(0, 3)).toEqual([
      { city: 'C000', deliveries: 7 },
      { city: 'C001', deliveries: 14 },
      { city: 'C002', deliveries: 21 },
    ])
    expect(view.rows.map((r) => r.city)).toEqual(ROWS_152.map((r) => r.values[0]))
    // No sort arrow: the grid starts in the order sent, and a header click sorts it (the table form's own grid).
    expect(view.sort).toBeNull()
    expect(view.cut).toBe(false)
  })

  it('aHeaderClickReSorts_andALongTableScrollsInsideTheAnswer', () => {
    // The answer draws the analytics table form (`TableChart`): every column sorts on a header click.
    expect(TABLE_DEFAULT_COL_DEF.sortable).toBe(true)
    // 152 rows scroll in a fixed viewport inside the answer, rather than growing it.
    expect(tableLayout(152, OMS_GRID_ROW_HEIGHT, OMS_GRID_HEADER_HEIGHT).kind).toBe('fixed')
  })

  it('columnLabels_areTheWiresInTheScreensLanguage', () => {
    const t = table({ rows: ROWS_152.slice(0, 2) })
    expect(copilotTableView(t, EMPTY_MODEL, 'en', WORDS).columns.map((c) => c.label)).toEqual(['City', 'Deliveries'])
    expect(copilotTableView(t, EMPTY_MODEL, 'ar', WORDS).columns.map((c) => c.label)).toEqual(['المدينة', 'التوصيلات'])
  })

  describe('notes and "All" rows, as on a view panel', () => {
    const running = (notes: Partial<CopilotAnswerTable['notes']>, within?: string[]) =>
      table({
        columns: [dim('region', 'Region', 'المنطقة'), dim('city', 'City', 'المدينة'), measure('deliveries', 'Deliveries', 'التوصيلات'), measure('share', 'Running share', 'الحصة التراكمية', 'percent')],
        rows: [{ values: ['R', 'Riyadh', '50', '50'], isTotal: null }],
        notes: { untilReached: null, untilReachedByParent: null, notSplit: null, notFiltered: null, dataGap: null, ...notes },
        query: {
          measures: ['deliveries'],
          dimensions: ['region', 'city'],
          filters: [],
          calculations: [{ key: 'share', kind: 'cumulativeShare', measure: 'deliveries', until: 80, ...(within ? { within } : {}) }],
        },
      })

    it('until_aCutThatRanOutBeforeItsUntil_isNoted', () => {
      const t = running({ untilReached: false })
      expect(untilNote(copilotTableDefinition(t), copilotTableResult(t))).toEqual({ until: 80 })
      const reached = running({ untilReached: true })
      expect(untilNote(copilotTableDefinition(reached), copilotTableResult(reached))).toBeNull()
    })

    it('until_withinAParent_namesTheParentsThatRanOut_byTheWithinDimensions', () => {
      const t = running(
        {
          untilReachedByParent: [
            { parent: ['R'], reached: true },
            { parent: ['E'], reached: false },
          ],
        },
        ['region'],
      )
      expect(untilNote(copilotTableDefinition(t), copilotTableResult(t))).toEqual({ until: 80, parents: [{ region: 'E' }] })
    })

    const WORDS_NOTES: AreaNoteWords = {
      notSplit: ({ measure, by }) => `${measure} cannot be split by ${by}.`,
      notFiltered: ({ measure, by }) => `${measure} is not filtered by ${by}.`,
      totalIn: ({ parent, value }) => `In ${parent}: ${value}`,
      total: ({ value }) => `Total: ${value}`,
    }
    const crossArea = table({
      columns: [dim('region', 'Region', 'المنطقة'), dim('category', 'Category', 'الفئة'), measure('till_sales', 'Till sales', 'مبيعات الصندوق'), measure('deliveries', 'Deliveries', 'التوصيلات')],
      rows: [
        { values: ['E', 'otc', '10', null], isTotal: null },
        { values: ['E', null, null, '4'], isTotal: true },
        { values: ['W', 'rx', '3', null], isTotal: null },
      ],
      notes: { untilReached: null, untilReachedByParent: null, notSplit: [{ measure: 'deliveries', by: ['category'] }], notFiltered: [{ measure: 'deliveries', by: ['category'] }], dataGap: null },
      query: { measures: ['till_sales', 'deliveries'], dimensions: ['region', 'category'], filters: [{ dimension: 'category', values: ['otc', 'rx'] }] },
    })

    it('notSplitAndNotFiltered_readAsOnAViewPanel_inTheWiresLabels', () => {
      const notes = areaNotes(copilotTableDefinition(crossArea), copilotTableResult(crossArea), copilotTableModel(crossArea, EMPTY_MODEL), 'en', WORDS_NOTES)
      // A table lists its "All" rows itself, so the note is the sentence alone.
      expect(notes.notSplit).toEqual([{ measure: 'deliveries', sentence: `${FSI}Deliveries${PDI} cannot be split by ${FSI}Category${PDI}.`, totals: [] }])
      expect(notes.notFiltered).toEqual([`${FSI}Deliveries${PDI} is not filtered by ${FSI}Category${PDI}.`])
    })

    it('allRows_areListedLast_onScreenAndInTheDownloads', () => {
      const view = copilotTableView(crossArea, EMPTY_MODEL, 'en', WORDS)
      expect(view.rows).toEqual([
        { region: 'E', category: 'otc', till_sales: 10, deliveries: null },
        { region: 'W', category: 'rx', till_sales: 3, deliveries: null },
        { region: 'E', category: 'All', till_sales: null, deliveries: 4 },
      ])
      const csv = panelCsv(copilotTableDownload(crossArea, EMPTY_MODEL, 'en', WORDS))
      expect(csv.split('\r\n')).toEqual(['﻿Region,Category,Till sales,Deliveries', 'E,otc,10,', 'W,rx,3,', 'E,All,,4', ''])
    })
  })

  it('openAsView_opensTheEditorSeededWithTheTablesQuery', () => {
    const query = {
      measures: ['deliveries'],
      dimensions: ['city'],
      filters: [{ dimension: 'region', values: ['R'] }],
      period: 'last-month',
      grain: null,
      order: [{ key: 'deliveries', direction: 'desc' }],
      limit: 10,
      compareToPrevious: true,
    }
    const link = copilotTableOpenAsView(table({ query }))
    expect(link.to).toBe(NEW_VIEW_PATH)
    const seed = readEditorSeed(link.state)
    expect(seed?.definition).toEqual({
      chart: { type: 'table', sort: { key: 'deliveries', direction: 'desc' } },
      query: {
        measures: ['deliveries'],
        dimensions: ['city'],
        filters: [{ dimension: 'region', values: ['R'] }],
        period: 'last-month',
        grain: null,
        limit: 10,
        compareToPrevious: true,
      },
    })
  })
})
