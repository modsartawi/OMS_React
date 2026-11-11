import { describe, expect, it } from 'vitest'
import { sqlChartOffers } from '@/core/models/analytics-sql'
import type { AnswerSql } from './answer'
import { sqlEditLink, sqlSaveBody, sqlSaveForm, sqlSaveProblem, withChartType, withValue } from './sql-save'

/**
 * BackOffice spec 3632 Q39, Q41 (ticket 889): Save on a SQL answer. The fit table is BackOffice 3675's (`POST
 * Analytics/Item/Sql`): table any · kpi 1 value · line axis + 1-4 values, or 1 value + series · area axis + 1 value ·
 * bar axis + 1-3 values, or 1 value + series · donut axis + 1 value · heatmap axis + series + 1 value · combo axis +
 * 2 values. A value column holds numbers.
 */

const offered = (columns: string[], rows: (string | null)[][]) =>
  sqlChartOffers(columns, rows)
    .filter((o) => o.offered)
    .map((o) => o.type)

describe('only the chart types the result columns fit are offered (Q41)', () => {
  it('a lone text column is a table only', () => {
    expect(offered(['Store'], [['Riyadh'], ['Jeddah']])).toEqual(['table'])
  })

  it('a lone number is a table or a KPI', () => {
    expect(offered(['Sales'], [['1250.500']])).toEqual(['kpi', 'table'])
  })

  it('a category and one number fit everything but a heat map and a combo', () => {
    expect(offered(['Store', 'Sales'], [['Riyadh', '10'], ['Jeddah', '7.5']])).toEqual(['kpi', 'line', 'area', 'bar', 'donut', 'table'])
  })

  it('a category and two numbers add the combo; two categories and a number add the heat map', () => {
    expect(offered(['Store', 'Sales', 'Margin'], [['Riyadh', '10', '0.25']])).toContain('combo')
    expect(offered(['Region', 'Store', 'Sales'], [['Central', 'Riyadh', '-3']])).toContain('heatmap')
    expect(offered(['Region', 'Store', 'Sales'], [['Central', 'Riyadh', '-3']])).not.toContain('combo')
  })

  it('a column with any text cell is not a number; NULL cells do not count against it', () => {
    expect(offered(['Store', 'Code'], [['Riyadh', '12'], ['Jeddah', 'B001']])).toEqual(['table'])
    expect(offered(['Store', 'Sales'], [['Riyadh', null], ['Jeddah', '4']])).toContain('bar')
  })

  it('a type not offered says why', () => {
    const combo = sqlChartOffers(['Store', 'Sales'], [['Riyadh', '10']]).find((o) => o.type === 'combo')
    expect(combo).toEqual({ type: 'combo', offered: false, reason: 'comboShape' })
  })
})

const answer = (over: Partial<AnswerSql> = {}): AnswerSql => ({
  ran: true,
  statement: 'SELECT TOP 1001 StoreName, SUM(NetSales) AS Sales, SUM(Margin) AS Margin\nFROM an.SalesDaily\nGROUP BY StoreName',
  tables: ['an.SalesDaily'],
  columns: ['StoreName', 'Sales', 'Margin'],
  rows: [
    ['Riyadh', '1250.500', '300.25'],
    ['Jeddah', '980', '210'],
  ],
  rowCount: 2,
  isCut: false,
  durationMs: 41,
  ...over,
})

describe('Save sends the statement, the question, the title and the mapping (Q39, Q41)', () => {
  it('the default is a table, and its body is the answer statement as shown, the question and the title', () => {
    const sql = answer()
    const form = sqlSaveForm(sql, 'Top stores by sales last week?')
    expect(form.type).toBe('table')
    const body = sqlSaveBody(sql, 'Top stores by sales last week?', { ...form, title: { en: '  Top stores  ', ar: 'أعلى الفروع' } })
    expect(body).toEqual({
      statement: 'SELECT TOP 1001 StoreName, SUM(NetSales) AS Sales, SUM(Margin) AS Margin\nFROM an.SalesDaily\nGROUP BY StoreName',
      question: 'Top stores by sales last week?',
      title: { en: 'Top stores', ar: 'أعلى الفروع' },
      chart: { type: 'table', values: [] },
    })
  })

  it('a bar sends its axis and its values, each with its label and format', () => {
    const sql = answer()
    let form = withChartType(sqlSaveForm(sql, 'q'), 'bar', sql)
    expect(form.axis).toBe('StoreName')
    expect(form.values.map((v) => v.column)).toEqual(['Sales', 'Margin'])
    form = withValue(form, 0, { label: { en: 'Net sales', ar: 'صافي المبيعات' }, format: 'money' })
    form = withValue(form, 1, { format: 'percent' })
    expect(sqlSaveBody(sql, 'q', { ...form, title: { en: 'Sales', ar: '' } }).chart).toEqual({
      type: 'bar',
      axis: 'StoreName',
      values: [
        { column: 'Sales', label: { en: 'Net sales', ar: 'صافي المبيعات' }, format: 'money' },
        { column: 'Margin', label: { en: '', ar: '' }, format: 'percent' },
      ],
    })
  })

  it('a heat map sends an axis, a series and one value; a KPI no axis', () => {
    const sql = answer({ columns: ['Region', 'StoreName', 'Sales'], rows: [['Central', 'Riyadh', '10']] })
    const heat = withChartType(sqlSaveForm(sql, 'q'), 'heatmap', sql)
    expect(sqlSaveBody(sql, 'q', { ...heat, title: { en: 'T', ar: '' } }).chart).toEqual({
      type: 'heatmap',
      axis: 'Region',
      series: 'StoreName',
      values: [{ column: 'Sales', label: { en: '', ar: '' }, format: 'number' }],
    })
    const kpi = withChartType(heat, 'kpi', sql)
    expect(sqlSaveBody(sql, 'q', { ...kpi, title: { en: 'T', ar: '' } }).chart).toEqual({
      type: 'kpi',
      values: [{ column: 'Sales', label: { en: '', ar: '' }, format: 'number' }],
    })
  })

  it('the question is cut to the server limit of 2,000 characters', () => {
    const sql = answer()
    const long = 'x'.repeat(2500)
    expect(sqlSaveBody(sql, long, { ...sqlSaveForm(sql, long), title: { en: 'T', ar: '' } }).question).toHaveLength(2000)
  })

  it('cannot be sent without a title, or with a mapping the type does not take', () => {
    const sql = answer()
    const form = sqlSaveForm(sql, 'q')
    expect(sqlSaveProblem({ ...form, title: { en: ' ', ar: '' } }, sql)).toBe('title')
    const bar = { ...withChartType(form, 'bar', sql), title: { en: 'T', ar: '' } }
    expect(sqlSaveProblem(bar, sql)).toBeNull()
    expect(sqlSaveProblem({ ...bar, axis: null }, sql)).toBe('axis')
    expect(sqlSaveProblem({ ...bar, values: [] }, sql)).toBe('values')
    expect(sqlSaveProblem({ ...bar, values: [bar.values[0], { ...bar.values[0] }] }, sql)).toBe('sameColumn')
    expect(sqlSaveProblem({ ...bar, axis: 'Margin', values: [{ ...bar.values[0], column: 'StoreName' }] }, sql)).toBe('notNumber')
    // With a series a bar takes one value.
    expect(sqlSaveProblem({ ...bar, series: 'Margin', values: [bar.values[0]] }, sql)).toBeNull()
    expect(sqlSaveProblem({ ...bar, series: 'Margin' }, sql)).toBe('values')
  })

  it('a title the dialog starts from is the question, in its script and cut to 200 characters', () => {
    expect(sqlSaveForm(answer(), 'Top stores?').title).toEqual({ en: 'Top stores?', ar: '' })
    expect(sqlSaveForm(answer(), 'أعلى الفروع؟').title).toEqual({ en: '', ar: 'أعلى الفروع؟' })
    expect(sqlSaveForm(answer(), 'y'.repeat(300)).title.en).toHaveLength(200)
  })
})

// Ticket 890 (spec 3632 Q45): the SQL answer's Edit opens the SQL editor on its statement, by route string, the statement
// and question in route state (never the URL). Only for a reader with the SQL grant, and only when there is a statement.
describe('Edit', () => {
  const answer = { ran: false, statement: 'SELECT store FROM sales', tables: [], columns: [], rows: [], rowCount: 0, isCut: false, durationMs: 0 }
  it('opens the editor on the statement and the question, even when the statement did not run', () => {
    expect(sqlEditLink(answer, 'Net by store?', true)).toEqual({
      to: '/analytics/sql/new',
      state: { statement: 'SELECT store FROM sales', question: 'Net by store?' },
    })
    expect(sqlEditLink(answer, undefined, true)?.state).toEqual({ statement: 'SELECT store FROM sales' })
  })
  it('is not offered without the SQL grant, or without a statement', () => {
    expect(sqlEditLink(answer, 'q', false)).toBeNull()
    expect(sqlEditLink({ ...answer, statement: '' }, 'q', true)).toBeNull()
  })
})
