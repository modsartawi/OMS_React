import type { ColDef, GridApi } from 'ag-grid-community'
import { stripIsolates } from '@/core/util/bidi'
import type { InquiryExportColumn, InquiryExportRequest, InquiryExportScreen } from './api'

/**
 * Export month…'s request, planned (BackOffice spec 4314, ticket 4318): the range checked against the 31-day rule
 * before anything is queued, and the user's visible columns read off the grid. Pure — the dialog only draws it.
 */

/** What a screen hands its split button for Export month…. */
export interface ExportMonthSource {
  /** The live grid, when mounted: its displayed columns (the user's order, moves and hides included) win. */
  gridApi: GridApi | null
  /** The screen's column definitions as built for the grid — read when the grid is not mounted (an empty result). */
  columnDefs: readonly ColDef[]
  /** The APPLIED filters, spelt as the grid's query string, without the limit and without the range keys. */
  filters: Record<string, unknown>
  /** The range to pre-fill (`yyyy-MM-dd`, '' when the screen's filter leaves that end open). */
  range: { from: string; to: string }
  /** A column the server does not export (an actions column): left out of the request. */
  skipColumn?: (colId: string) => boolean
  /**
   * The screen's filters bound the export on their own, so it needs no range (BackOffice 4323, spec story 37: Cash
   * Collections narrowed to one ACR — the server reads the whole ACR in one pass, as the grid does). The dialog then
   * asks for no dates and sends none.
   */
  undated?: boolean
}


/** The longest range a job may cover, both ends counted (the server's `InquiryExport:MaxRangeDays` default). */
export const MAX_RANGE_DAYS = 31

/** Why a range or a request is refused before it is sent. Each is a `inquiry-export:dialog.problem.*` sentence. */
export type ExportMonthProblem = 'missingEnd' | 'reversed' | 'tooLong' | 'noColumns'

export type ExportMonthPlan = { ok: true; request: InquiryExportRequest } | { ok: false; problem: ExportMonthProblem }

const DAY = /^\d{4}-\d{2}-\d{2}$/

/** Whole days from `from` to `to`, both ends counted (calendar days, read as UTC midnights so no DST shift bites). */
function inclusiveDays(from: string, to: string): number {
  const ms = Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)
  return Math.round(ms / 86_400_000) + 1
}

/** The range's problem, or null. Both ends are required; at most `MAX_RANGE_DAYS` days. */
export function rangeProblem(from: string, to: string): ExportMonthProblem | null {
  if (!DAY.test(from) || !DAY.test(to)) return 'missingEnd'
  if (to < from) return 'reversed'
  if (inclusiveDays(from, to) > MAX_RANGE_DAYS) return 'tooLong'
  return null
}

/**
 * The columns the user can see, in their order, with the header text they see. The live grid wins (it knows a column
 * the user dragged or hid); with no grid mounted the screen's own column definitions stand in. Isolates are stripped:
 * the header is written into a file, never a bidi sink.
 */
export function exportColumns(source: ExportMonthSource): InquiryExportColumn[] {
  const skip = source.skipColumn ?? (() => false)
  const api = source.gridApi
  const columns: InquiryExportColumn[] = api
    ? api.getAllDisplayedColumns().map((c) => ({
        id: c.getColId(),
        header: api.getDisplayNameForColumn(c, 'header') ?? '',
      }))
    : source.columnDefs
        .filter((d) => !d.hide)
        .map((d) => ({ id: d.colId ?? (typeof d.field === 'string' ? d.field : ''), header: d.headerName ?? '' }))
  return columns
    .filter((c) => c.id !== '' && !skip(c.id))
    .map((c) => ({ id: c.id, header: stripIsolates(c.header).trim() }))
}

/** The dialog's Send: refuse what the server would refuse for the range or the columns, or build the request. */
export function planExportMonth(input: {
  screen: InquiryExportScreen
  from: string
  to: string
  source: ExportMonthSource
  language: 'en' | 'ar'
}): ExportMonthPlan {
  const undated = input.source.undated === true
  const problem = undated ? null : rangeProblem(input.from, input.to)
  if (problem) return { ok: false, problem }
  const columns = exportColumns(input.source)
  if (columns.length === 0) return { ok: false, problem: 'noColumns' }
  return {
    ok: true,
    request: {
      screen: input.screen,
      fromDate: undated ? null : input.from,
      toDate: undated ? null : input.to,
      filters: input.source.filters,
      columns,
      language: input.language,
    },
  }
}
