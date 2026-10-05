import Ltr from '@/core/ui/Ltr'
import type { BbyRefusal } from '@/core/models/bonus-buy-maintenance'

/**
 * What an act did, under the overview — SAP shows its outcome messages in the same place.
 * Each row is one number (a bonus buy, or the promotion) with its outcome word and every
 * refusal in BOTH languages, as the validator returned them (spec 2374 story 37).
 */
export interface ReportRow {
  number?: string
  /** An already-translated outcome word, or a thrown error's message. */
  outcome?: string
  message?: string
  refusals: BbyRefusal[]
}

export interface Report {
  title: string
  tone: 'ok' | 'bad'
  rows: ReportRow[]
  /** The editor's stale-version refusal: the page offers a reload beside the report. */
  stale?: boolean
}

export function RefusalList({ refusals }: { refusals: BbyRefusal[] }) {
  if (refusals.length === 0) return null
  return (
    <ul className="mt-1 flex flex-col gap-1 ps-4">
      {refusals.map((r, i) => (
        <li key={i} className="text-xs">
          <span className="font-mono text-muted-foreground">
            <Ltr>{r.code}</Ltr>
          </span>{' '}
          <bdi>{r.english}</bdi>
          {r.arabic && (
            <div className="text-muted-foreground" lang="ar">
              <bdi dir="rtl">{r.arabic}</bdi>
            </div>
          )}
        </li>
      ))}
    </ul>
  )
}

export default function ActReport({ report }: { report: Report }) {
  return (
    <div
      role="status"
      className={
        'rounded-lg border px-3 py-2 text-sm ' +
        (report.tone === 'bad'
          ? 'border-danger-border bg-danger-050 text-danger-800'
          : 'border-border/60 bg-card')
      }
    >
      <div className="font-medium">{report.title}</div>
      {report.rows.length > 0 && (
        <ul className="mt-1 flex flex-col gap-1.5">
          {report.rows.map((row, i) => (
            <li key={i}>
              {row.number && (
                <span className="font-mono">
                  <Ltr>{row.number}</Ltr>
                </span>
              )}
              {row.outcome && <span className="ms-2 font-medium">{row.outcome}</span>}
              {row.message && (
                <span className="ms-2">
                  <bdi>{row.message}</bdi>
                </span>
              )}
              <RefusalList refusals={row.refusals} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
