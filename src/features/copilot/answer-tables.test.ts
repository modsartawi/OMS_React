import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import i18next from 'i18next'
import { I18nextProvider } from 'react-i18next'
import { describe, expect, it } from 'vitest'
import copilot from '@/locales/en/copilot.json'
import { setCopilotTableEmbed } from '@/core/copilot-view-embed'
import type { CopilotAnswer, CopilotAnswerTable } from '@/core/models/copilot'
import { answerTableKey, copilotAnswerModel } from './answer'
import { AnswerTables } from './AnswerParts'

// Ticket 878 (BackOffice spec 3587 B22; wire 3621): an analysis result gives one table per cut, ALL on its one step.

const reply: Partial<CopilotAnswer> = {
  conversationId: 'c-1',
  questionNo: 1,
  answer: 'Riyadh carries 62% of the fall.',
  trace: [{ tool: 'what_changed', input: { measure: 'net_till_value_sar' }, rows: 3, ms: 900, ok: true }],
  outcome: 'answered',
  stoppedEarly: false,
  servedBy: 'anthropic/claude',
}

const cut = (key: string, en: string, ar: string, first: string): CopilotAnswerTable => ({
  step: 0,
  title: { en, ar },
  columns: [
    { key, role: 'dimension', label: { en, ar }, unit: null, shape: null, dateBasis: null, calculation: null, variant: null },
    { key: 'share', role: 'measure', label: { en: 'Share of the change', ar: 'الحصة من التغيّر' }, unit: 'percent', shape: 'rate', dateBasis: null, calculation: null, variant: null },
  ],
  rows: [{ values: [first, '62.0%'], isTotal: null }],
  total: 11,
  truncated: false,
  periodFrom: '2026-10-30',
  periodTo: '2026-11-05',
  previous: null,
  previousFrom: '2026-10-23',
  previousTo: '2026-10-29',
  dataAsOf: '2026-11-11T08:00:00',
  notes: { untilReached: null, untilReachedByParent: null, notSplit: null, notFiltered: null, dataGap: null },
  query: { measures: ['net_till_value_sar'], dimensions: [key], filters: [], period: 'last-7-days', compareToPrevious: true },
})

const THREE = [cut('city', 'City', 'المدينة', 'Riyadh'), cut('channel', 'Channel', 'القناة', 'Online'), cut('category', 'Category', 'الفئة', 'OTC')]

describe('three tables of one analysis, all on one step (ticket 878)', () => {
  it('theAnswerKeepsThem_inTheOrderSent_eachWithItsOwnTitle', () => {
    const model = copilotAnswerModel({ ...reply, tables: THREE } as Partial<CopilotAnswer>)
    expect(model.tables.map((t) => t.step)).toEqual([0, 0, 0])
    expect(model.tables.map((t) => t.title)).toEqual([
      { en: 'City', ar: 'المدينة' },
      { en: 'Channel', ar: 'القناة' },
      { en: 'Category', ar: 'الفئة' },
    ])
    expect(model.tables).toEqual(THREE)
  })

  it('eachIsKeyedByItsPlaceAsWellAsItsStep_soNoTwoShareAKey', () => {
    const keys = THREE.map(answerTableKey)
    expect(new Set(keys).size).toBe(3)
    // The step alone would be one key for all three.
    expect(new Set(THREE.map((t) => t.step)).size).toBe(1)
  })

  it('thePanelDrawsThem_inTheOrderSent_eachGivenItsOwnTableAndItsPlace', () => {
    setCopilotTableEmbed(({ table, index }) => createElement('section', { 'data-stub-table': `${index}|${table.step}|${table.title?.en}|${table.rows[0].values[0]}` }))
    const instance = i18next.createInstance()
    instance.init({ lng: 'en', resources: { en: { copilot } }, ns: ['copilot'], defaultNS: 'copilot', initAsync: false })
    const html = renderToStaticMarkup(createElement(I18nextProvider, { i18n: instance }, createElement(AnswerTables, { tables: THREE })))
    expect([...html.matchAll(/data-stub-table="([^"]*)"/g)].map((m) => m[1])).toEqual(['0|0|City|Riyadh', '1|0|Channel|Online', '2|0|Category|OTC'])
  })
})
