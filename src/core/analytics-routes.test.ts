import { describe, expect, it } from 'vitest'
import { boardEditHref, itemHref, NEW_SQL_PATH, reportDialogHref, reportDialogOf, reportHref, reportPrintHref, reportRunsHref, sqlEditHref } from './analytics-routes'

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
  it('833: a report’s kept runs are under its page', () => {
    expect(reportRunsHref('r 1/2')).toBe('/analytics/report/r%201%2F2/runs')
  })
  it("832 (story 108): the copilot's Share… and Schedule… open the report's page with that dialog open", () => {
    expect(reportDialogHref('r 1', 'share')).toBe('/analytics/report/r%201#share')
    expect(reportDialogHref('r-1', 'schedule')).toBe('/analytics/report/r-1#schedule')
    expect(reportDialogOf('#share')).toBe('share')
    expect(reportDialogOf('#schedule')).toBe('schedule')
    // A panel's permalink, or nothing, opens no dialog.
    expect(reportDialogOf('#panel-p1')).toBeNull()
    expect(reportDialogOf('')).toBeNull()
  })
})

// 890: the SQL editor — a SQL item's, its id escaped, and a statement not yet saved (the statement rides in route state).
describe('the SQL editor routes', () => {
  it('builds an item editor link and names the new-statement editor', () => {
    expect(sqlEditHref('q 1/x')).toBe('/analytics/sql/q%201%2Fx')
    expect(NEW_SQL_PATH).toBe('/analytics/sql/new')
  })
})
