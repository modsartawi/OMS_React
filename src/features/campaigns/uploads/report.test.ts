import { describe, expect, it } from 'vitest'
import type { RuleUploadIssue, RuleUploadReport } from '@/core/models/rule-upload'
import { dayOf, issueRows, issueSheets, issueView, readReportView, windowDays } from './report'

const issue = (at: string, message = 'something', over: Partial<RuleUploadIssue> = {}): RuleUploadIssue => ({
  at,
  sheet: '',
  row: 0,
  column: '',
  message,
  ...over,
})

const report = (over: Partial<RuleUploadReport> = {}): RuleUploadReport => ({
  accepted: true,
  stored: true,
  promotionCode: '0001000048-261009-261015',
  stacking: 'compete',
  note: 'SAP promotion number 0001000048, 9-15 October',
  revision: 3,
  mechanics: { percentOff: 2, buyNGetMFree: 1 },
  skuCount: 41,
  windowFrom: '2026-10-09T00:00:00',
  windowUntil: '2026-10-15T00:00:00',
  campaigns: [],
  errors: [],
  warnings: [],
  ...over,
})

describe('issueView', () => {
  it('reads Campaigns!12:Value as sheet Campaigns, row 12, column Value', () => {
    const v = issueView(issue('Campaigns!12:Value'), 'error', 0)
    expect(v).toMatchObject({ sheet: 'Campaigns', row: 12, column: 'Value', place: 'cell', kind: 'error' })
  })

  it('reads Items!40 as the whole row 40', () => {
    expect(issueView(issue('Items!40'), 'warning', 0)).toMatchObject({ sheet: 'Items', row: 40, column: '', place: 'row' })
  })

  it('reads Upload, or any row 0, as the whole sheet', () => {
    expect(issueView(issue('Upload'), 'error', 0)).toMatchObject({ sheet: 'Upload', row: 0, place: 'sheet' })
    expect(issueView(issue('Upload', 'x', { sheet: 'Upload', row: 0, column: '' }), 'error', 0).place).toBe('sheet')
  })

  it('takes the server fields when they are sent, and keeps at and the message as sent', () => {
    const v = issueView(issue('Campaigns!7:Buy', 'Buy is missing', { sheet: 'Campaigns', row: 7, column: 'Buy' }), 'error', 2)
    expect(v).toMatchObject({ at: 'Campaigns!7:Buy', sheet: 'Campaigns', row: 7, column: 'Buy', message: 'Buy is missing' })
  })
})

describe('issueRows', () => {
  it('puts every error before every warning, each in the order HQ sent', () => {
    const rows = issueRows(
      report({
        accepted: false,
        warnings: [issue('Campaigns!3:NameAr', 'w1'), issue('Upload', 'w2')],
        errors: [issue('Items!40', 'e1'), issue('Campaigns!12:Value', 'e2')],
      }),
    )
    expect(rows.map((r) => `${r.kind}:${r.message}`)).toEqual(['error:e1', 'error:e2', 'warning:w1', 'warning:w2'])
    // Unique keys, so the grid can tell two identical lines apart.
    expect(new Set(rows.map((r) => r.key)).size).toBe(4)
  })

  it('lists each sheet once, in the order met, for the sheet filter', () => {
    const rows = issueRows(report({ errors: [issue('Items!4'), issue('Campaigns!2:Code')], warnings: [issue('Items!9'), issue('Upload')] }))
    expect(issueSheets(rows)).toEqual(['Items', 'Campaigns', 'Upload'])
  })
})

describe('windowDays', () => {
  it('shows windowUntil as sent: the inclusive last day, never moved a day', () => {
    expect(windowDays('2026-10-09T00:00:00', '2026-10-15T00:00:00')).toBe('2026-10-09 – 2026-10-15')
    // A day-only value (the stored summary's) reads the same.
    expect(windowDays('2026-10-09', '2026-10-15')).toBe('2026-10-09 – 2026-10-15')
  })

  it('never parses the day through a Date, so no time zone moves it', () => {
    expect(dayOf('2026-10-15T23:59:59')).toBe('2026-10-15')
    expect(dayOf('2026-10-15T00:00:00')).toBe('2026-10-15')
  })

  it('gives no range when the window is null, or never set', () => {
    expect(windowDays(null, null)).toBeNull()
    expect(windowDays('0001-01-01T00:00:00', '0001-01-01T00:00:00')).toBeNull()
    expect(dayOf(undefined)).toBe('')
  })

  it('gives no range for a lone end, never a one-day window', () => {
    expect(windowDays('2026-10-09T00:00:00', null)).toBeNull()
    expect(windowDays('0001-01-01T00:00:00', '2026-10-15T00:00:00')).toBeNull()
  })
})

describe('readReportView', () => {
  it('accepted:false is the all-or-none state, N = errors.length', () => {
    const v = readReportView(report({ accepted: false, stored: false, revision: 0, errors: [issue('Items!40'), issue('Upload'), issue('Campaigns!1:Code')] }))
    expect(v.state).toBe('refused')
    expect(v.errorCount).toBe(3)
    expect(v.revision).toBeNull()
  })

  it('accepted:true, stored:true is the waiting state, with its revision and note', () => {
    const v = readReportView(report())
    expect(v.state).toBe('waiting')
    expect(v.revision).toBe(3)
    expect(v.note).toBe('SAP promotion number 0001000048, 9-15 October')
    expect(v.promotionCode).toBe('0001000048-261009-261015')
    expect(v.window).toBe('2026-10-09 – 2026-10-15')
  })

  it('a read that was accepted but not stored claims no revision', () => {
    const v = readReportView(report({ stored: false, revision: 0 }))
    expect(v.state).toBe('unstored')
    expect(v.revision).toBeNull()
  })

  it('a null window gives no range', () => {
    expect(readReportView(report({ accepted: false, windowFrom: null, windowUntil: null })).window).toBeNull()
  })

  it('makes a tile of every mechanics key, unknown ones included, in the order sent', () => {
    const v = readReportView(report({ mechanics: { percentOff: 4, buyXGetY: 1, tieredSpend: 2 } }))
    expect(v.mechanics).toEqual([
      { mechanic: 'percentOff', count: 4 },
      { mechanic: 'buyXGetY', count: 1 },
      { mechanic: 'tieredSpend', count: 2 },
    ])
  })

  it('counts the campaigns and the generated Arabic names', () => {
    const c = (code: string, nameArGenerated: boolean) => ({ code, id: `D-${code}`, row: 2, mechanic: 'percentOff', stacking: 'compete', nameArGenerated, campaign: null })
    const v = readReportView(report({ campaigns: [c('A', true), c('B', false), c('C', true)] }))
    expect(v.campaignCount).toBe(3)
    expect(v.generatedNames).toBe(2)
  })
})
