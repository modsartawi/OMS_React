import { describe, expect, it } from 'vitest'
import { boardEditHref, itemHref, reportHref, reportPrintHref } from './analytics-routes'

describe('analytics item routes', () => {
  it('a view and a board open their own page, the id escaped', () => {
    expect(itemHref('view', 'v-42')).toBe('/analytics/view/v-42')
    expect(itemHref('board', 'b 7/x')).toBe('/analytics/board/b%207%2Fx')
  })
  it("a board's editor is under its page", () => {
    expect(boardEditHref('b-ops')).toBe('/analytics/board/b-ops/edit')
  })
  it('827: a report opens at its page, and its print page carries the values of the page it was opened from', () => {
    expect(itemHref('report', 'r-1042')).toBe('/analytics/report/r-1042')
    expect(reportHref('r-1042', 'period=last-week&city=riyadh')).toBe('/analytics/report/r-1042?period=last-week&city=riyadh')
    expect(reportPrintHref('r-1042', '?period=last-week')).toBe('/analytics/print/report/r-1042?period=last-week')
    expect(reportPrintHref('r-1042')).toBe('/analytics/print/report/r-1042')
    expect(reportPrintHref('r-1042', '')).toBe('/analytics/print/report/r-1042')
  })
})
