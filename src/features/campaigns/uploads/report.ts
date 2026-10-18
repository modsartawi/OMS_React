import type { RuleUploadIssue, RuleUploadMechanic, RuleUploadReport } from '@/core/models/rule-upload'
import { formatRange } from '@/core/util/bidi'

/**
 * What the screen makes of a read report (ticket 530): pure, no React, no i18n — the page renders
 * these words through its own keys.
 *
 * The decided rules it serves (BackOffice brief 2839): all or none — `accepted: false` stored
 * nothing, whatever the rest of the report says; a valid read IS the approval request, so the
 * stored state is "waiting for approval" at its revision; and `windowUntil` is the sheet's
 * inclusive last day, shown as sent (never the campaign JSON's exclusive `window.until`).
 */

export type IssueKind = 'error' | 'warning'

/** Where an issue points: one cell, a whole row (`column` ""), or the whole sheet (`row` 0). */
export type IssuePlace = 'cell' | 'row' | 'sheet'

export interface IssueView {
  /** Unique within the report: two identical lines are still two rows. */
  key: string
  kind: IssueKind
  at: string
  sheet: string
  row: number
  column: string
  place: IssuePlace
  message: string
}

/** `Campaigns!12:Value`, `Items!40`, `Upload`. */
const AT = /^([^!]*)(?:!(\d+)(?::(.*))?)?$/

/**
 * One issue for the grid. HQ sends `sheet`, `row` and `column` beside `at`; they are taken as sent,
 * and `at` is read only when the sheet is missing.
 */
export function issueView(issue: RuleUploadIssue, kind: IssueKind, index: number): IssueView {
  let sheet = issue.sheet ?? ''
  let row = issue.row ?? 0
  let column = issue.column ?? ''
  if (!sheet) {
    const m = AT.exec(issue.at ?? '')
    if (m) {
      sheet = m[1]
      row = m[2] ? Number(m[2]) : 0
      column = m[3] ?? ''
    }
  }
  const place: IssuePlace = row === 0 ? 'sheet' : column === '' ? 'row' : 'cell'
  return { key: `${kind}-${index}`, kind, at: issue.at ?? '', sheet, row, column, place, message: issue.message ?? '' }
}

/** Every error, then every warning, each in HQ's order. The warnings list is open: all of it. */
export function issueRows(report: Pick<RuleUploadReport, 'errors' | 'warnings'>): IssueView[] {
  return [
    ...(report.errors ?? []).map((i, n) => issueView(i, 'error', n)),
    ...(report.warnings ?? []).map((i, n) => issueView(i, 'warning', n)),
  ]
}

/** The sheets the issues name, each once, in the order met: the sheet filter's choices. */
export function issueSheets(rows: IssueView[]): string[] {
  return [...new Set(rows.map((r) => r.sheet).filter((s) => s !== ''))]
}

/**
 * The day a wire date names, `yyyy-MM-dd`, cut from the string as sent — never through a `Date`,
 * so no time zone can move it. Blank for a missing or never-set (`0001-01-01`) date.
 */
export function dayOf(value: string | null | undefined): string {
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(value ?? '')
  if (!m || m[1].startsWith('0001-')) return ''
  return m[1]
}

/**
 * The window as ONE range of inclusive days (isolate it once), or null when there is none. HQ sends
 * both ends or neither; a lone end is no window, never shown as a one-day campaign.
 */
export function windowDays(from: string | null | undefined, until: string | null | undefined): string | null {
  const first = dayOf(from)
  const last = dayOf(until)
  return first && last ? formatRange(first, last) : null
}

/**
 * - `refused`: `accepted: false` — nothing was stored; the all-or-none message.
 * - `waiting`: stored — the deal's pending upload at `revision`, waiting for an approver.
 * - `unstored`: accepted but not stored, which the contract does not send; the report alone.
 */
export type ReadState = 'refused' | 'waiting' | 'unstored'

export interface ReadReportView {
  state: ReadState
  errorCount: number
  warningCount: number
  dealCode: string
  stacking: string
  note: string
  /** Only when stored. */
  revision: number | null
  campaignCount: number
  /** Every key of `mechanics`, in the order sent, unknown ones included. */
  mechanics: { mechanic: RuleUploadMechanic; count: number }[]
  skuCount: number
  window: string | null
  generatedNames: number
}

export function readReportView(report: RuleUploadReport): ReadReportView {
  const state: ReadState = !report.accepted ? 'refused' : report.stored ? 'waiting' : 'unstored'
  const campaigns = report.campaigns ?? []
  return {
    state,
    errorCount: (report.errors ?? []).length,
    warningCount: (report.warnings ?? []).length,
    dealCode: report.dealCode ?? '',
    stacking: report.stacking ?? '',
    note: report.note ?? '',
    revision: state === 'waiting' ? report.revision : null,
    campaignCount: campaigns.length,
    mechanics: Object.entries(report.mechanics ?? {}).map(([mechanic, count]) => ({ mechanic, count })),
    skuCount: report.skuCount ?? 0,
    window: windowDays(report.windowFrom, report.windowUntil),
    generatedNames: campaigns.filter((c) => c.nameArGenerated).length,
  }
}
