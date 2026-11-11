import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import i18next from 'i18next'
import { I18nextProvider } from 'react-i18next'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import boards from '@/locales/en/boards.json'
import boardsAr from '@/locales/ar/boards.json'
import common from '@/locales/en/common.json'
import commonAr from '@/locales/ar/common.json'
import type { AnalyticsAccess, AnalyticsModel } from '@/core/models/analytics'
import type { CopilotAnswerTable, CopilotTableColumn } from '@/core/models/copilot'
import { FSI, PDI } from '@/core/util/bidi'
import { ANALYTICS_ACCESS_KEY } from './access'
import { ANALYTICS_MODEL_KEY } from './api'
import CopilotTableEmbed from './CopilotTableEmbed'

// Ticket 878: what the panel's table embed draws AROUND the grid (the grid's own rows are AG Grid's, drawn in the
// browser; its columns and rows are proven in `copilot-analysis-table.test.ts` and `@/core/charts/table-columns.test.ts`).
// Rendered to static markup: no DOM, no effects, the two queries answered from a seeded cache.

const column = (key: string, role: 'dimension' | 'measure', en: string, ar: string, unit: string | null = null): CopilotTableColumn => ({
  key,
  role,
  label: { en, ar },
  unit,
  shape: role === 'measure' ? 'additive' : null,
  dateBasis: null,
  calculation: null,
  variant: null,
})
const NOTES = { untilReached: null, untilReachedByParent: null, notSplit: null, notFiltered: null, dataGap: null }

const plain: CopilotAnswerTable = {
  step: 1,
  columns: [column('city', 'dimension', 'City', 'المدينة'), column('deliveries', 'measure', 'Deliveries', 'التوصيلات', 'count')],
  rows: [{ values: ['Riyadh', '1204'], isTotal: null }],
  total: 1,
  truncated: false,
  periodFrom: '2026-10-30',
  periodTo: '2026-11-05',
  previous: null,
  previousFrom: null,
  previousTo: null,
  dataAsOf: '2026-11-11T08:00:00',
  notes: { ...NOTES },
  query: { measures: ['deliveries'], dimensions: ['city'], filters: [], period: 'last-7-days' },
}

const byCity: CopilotAnswerTable = {
  ...plain,
  step: 0,
  title: { en: 'City', ar: 'المدينة' },
  columns: [
    column('city', 'dimension', 'City', 'المدينة'),
    column('before', 'measure', 'Before', 'قبل', 'SAR'),
    column('after', 'measure', 'After', 'بعد', 'SAR'),
    column('change', 'measure', 'Change', 'التغيّر', 'SAR'),
    column('share', 'measure', 'Share of the change', 'الحصة من التغيّر', 'percent'),
  ],
  rows: [{ values: ['Riyadh', '3000', '2380', '-620', '62.0%'], isTotal: null }],
  total: 11,
  previousFrom: '2026-10-23',
  previousTo: '2026-10-29',
  query: { measures: ['net_till_value_sar'], dimensions: ['city'], filters: [], period: 'last-7-days', compareToPrevious: true },
}

const AUTHOR: AnalyticsAccess = { canView: true, canAuthor: true, canCurate: false }
const RUNNER: AnalyticsAccess = { canView: true, canAuthor: false, canCurate: false }
const EMPTY_MODEL: AnalyticsModel = { areas: [], measures: [], dimensions: [] }

const instance = i18next.createInstance()
instance.init({
  lng: 'en',
  resources: { en: { boards, common }, ar: { boards: boardsAr, common: commonAr } },
  ns: ['boards', 'common'],
  defaultNS: 'boards',
  initAsync: false,
})

function draw(table: CopilotAnswerTable, { access = AUTHOR, lang = 'en', index = 0 }: { access?: AnalyticsAccess; lang?: string; index?: number } = {}): string {
  const client = new QueryClient()
  client.setQueryData(ANALYTICS_ACCESS_KEY, access)
  client.setQueryData(ANALYTICS_MODEL_KEY, EMPTY_MODEL)
  return renderToStaticMarkup(
    createElement(
      QueryClientProvider,
      { client },
      createElement(I18nextProvider, { i18n: instance.cloneInstance({ lng: lang }) }, createElement(MemoryRouter, null, createElement(CopilotTableEmbed, { table, index }))),
    ),
  )
}

const OPEN = 'data-copilot-table-action="open-as-view"'
const NOTE = 'data-copilot-table-computed-note'
const TITLE = 'data-copilot-table-title'

describe("the copilot panel's table embed (ticket 878)", () => {
  it('anAnalysisTable_isDrawnUnderItsTitle_inThePanelsLanguage_andNamedByIt', () => {
    const en = draw(byCity)
    expect(en).toMatch(/<section[^>]*aria-labelledby="([^"]+)"[^>]*><span class="text-sm font-medium" id="\1" data-copilot-table-title="true"><bdi>City<\/bdi><\/span><div[^>]*data-chart="table"/)
    expect(draw(byCity, { lang: 'ar' })).toContain('<bdi>المدينة</bdi>')
  })

  it('theGridIsHandedEveryColumnSent_theComputedOnesToo', () => {
    // The table form's own label lists the columns it was given.
    expect(draw(byCity)).toContain(`aria-label="${FSI}Before, After, Change, and Share of the change${PDI} by ${FSI}City${PDI}, table"`)
    expect(draw(plain)).toContain(`aria-label="${FSI}Deliveries${PDI} by ${FSI}City${PDI}, table"`)
  })

  it('anAuthor_isOfferedOpenAsView_withTheOneLineNote_inBothLanguages', () => {
    const en = draw(byCity)
    expect(en).toContain(OPEN)
    expect(en).toContain(`Open as view shows the table&#x27;s query only, without ${FSI}Before, After, Change, and Share of the change${PDI} (computed by the analysis).`)
    expect(draw(byCity, { lang: 'ar' })).toContain(`«فتح كعرض» يعرض استعلام الجدول فقط، دون ${FSI}قبل وبعد والتغيّر والحصة من التغيّر${PDI} (من حساب التحليل).`)
  })

  it('aRunner_hasNoOpenAsView_soNoNoteAboutIt', () => {
    const html = draw(byCity, { access: RUNNER })
    expect(html).not.toContain(OPEN)
    expect(html).not.toContain(NOTE)
    expect(html).toContain(TITLE)
  })

  it('aPartFromNoSingleQuery_offersNoOpenAsView_butKeepsItsDownloads', () => {
    const html = draw({ ...byCity, title: { en: 'The headline', ar: 'الخلاصة' }, query: {} })
    expect(html).not.toContain(OPEN)
    expect(html).not.toContain(NOTE)
    expect(html).toContain('data-copilot-table-action="csv"')
    expect(html).toContain('data-copilot-table-action="xlsx"')
  })

  it('threeTablesOnOneStep_areToldApartByTheirPlace', () => {
    expect([0, 1, 2].map((index) => /data-copilot-table="0" data-copilot-table-index="(\d)"/.exec(draw(byCity, { index }))?.[1])).toEqual(['0', '1', '2'])
  })

  it('aTableWithoutATitle_isDrawnAsToday_noTitle_noNote_openAsViewForAnAuthor', () => {
    const html = draw(plain)
    expect(html).not.toContain(TITLE)
    expect(html).not.toContain('aria-labelledby')
    expect(html).not.toContain(NOTE)
    expect(html).not.toContain('data-panel-last-year-not-held')
    expect(html).toContain(OPEN)
    // The section opens straight onto the table, as before.
    expect(html).toMatch(/^<section class="flex min-w-0 flex-col gap-1\.5" data-copilot-table="1" data-copilot-table-index="0"><div[^>]*data-chart="table"/)
    expect(draw(plain, { access: RUNNER })).not.toContain(OPEN)
  })

  it('anUnnamedChangeFromLastYear_isHeadedByItsComparison_inTheScreensWords', () => {
    const change: CopilotTableColumn = { ...column('chg_ly', 'measure', 'chg_ly', 'chg_ly', 'percent'), calculation: { kind: 'change', measure: 'deliveries', of: null, within: null, from: 'lastYear' } }
    const table: CopilotAnswerTable = {
      ...plain,
      columns: [...plain.columns, change],
      rows: [{ values: ['Riyadh', '1204', '9.5'], isTotal: null }],
      query: { ...plain.query, compareToLastYear: true, calculations: [{ key: 'chg_ly', kind: 'change', measure: 'deliveries', from: 'lastYear' }] },
    }
    expect(draw(table)).toContain(`aria-label="${FSI}Deliveries and Change in Deliveries from last year${PDI} by ${FSI}City${PDI}, table"`)
  })

  it('aTableWhoseLastYearIsNotHeld_saysTheDayItsDataStarts', () => {
    const notHeld: CopilotAnswerTable = {
      ...plain,
      lastYear: [],
      lastYearFrom: '2025-10-31',
      lastYearTo: '2025-11-06',
      notes: { ...NOTES, lastYearNotHeld: [{ area: 'deliveries', dataFrom: '2026-01-01', measures: ['deliveries'] }] },
      query: { ...plain.query, compareToLastYear: true },
    }
    expect(draw(notHeld)).toContain(`Last year is not shown for ${FSI}Deliveries${PDI}: the data starts on ${FSI}Jan 1, 2026${PDI}.`)
    expect(draw(notHeld, { lang: 'ar' })).toContain('لا يُعرض العام الماضي لـ')
  })
})
