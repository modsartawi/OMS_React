import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import StatusBadge from '@/core/ui/StatusBadge'
import type { SdDocumentHeaderStatusModel } from '@/core/models/sd-document'
import { railEntries, type RailEntry } from './rail'
import { statusBreakdownRows } from './fields'
import FieldGroup from './FieldGroup'

/**
 * The document's state, as one line under the header (spec 083 D-3).
 *
 * The rail renders what is set: the `lastAction` anchor first as a neutral
 * outline that never takes a severity colour, then one pill per described status
 * carrying a value. It replaces the Status tab's thirteen rows of grey text —
 * those rows keep their home in the **All statuses** disclosure at the end,
 * where an em dash is correct because a disclosure's job is completeness.
 *
 * `children` is the rail's tail slot, after the disclosure: Refresh lives there,
 * because the rail is Refresh's most visible effect and putting the two apart
 * makes the operator look in two places.
 */
export default function StatusRail({
  status,
  children,
}: {
  status: SdDocumentHeaderStatusModel | null | undefined
  children?: ReactNode
}) {
  const { t } = useTranslation('document')
  const entries = railEntries(status, t)
  const rows = status ? statusBreakdownRows(status, t) : []

  return (
    <div
      // `role="group"` is load-bearing, not decoration: `aria-label` is ignored
      // on a bare div, and the accessible name this rail inherits — the Status
      // tab, the Status field group — is exactly what this ticket removes.
      role="group"
      className="flex flex-wrap items-center gap-1.5 rounded-lg border border-border/60 bg-card px-2.5 py-1.5"
      aria-label={t('rail.ariaLabel')}
    >
      {entries.map((entry) =>
        entry.sev === null ? (
          // The anchor. A hairline outline, no ground, no severity — history
          // sitting on the same line as lifecycle without being mistaken for it.
          <span
            key={entry.key}
            className="inline-flex items-center gap-1.5 rounded-full border border-border-strong px-2 py-0.5 text-xs font-medium text-muted-foreground"
          >
            <EntryText entry={entry} />
          </span>
        ) : (
          <StatusBadge key={entry.key} sev={entry.sev}>
            <span className="inline-flex items-center gap-1.5">
              <EntryText entry={entry} />
            </span>
          </StatusBadge>
        ),
      )}

      {/* Pushes the tail controls to the rail's end. */}
      <span aria-hidden className="flex-1" />

      {rows.length > 0 && (
        <details className="group relative">
          <summary className="cursor-pointer list-none rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
            {t('rail.allStatuses')} <span className="tabular-nums">{rows.length}</span>
          </summary>
          <div className="absolute end-0 z-10 mt-1 w-max max-w-[22rem] shadow-lg">
            <FieldGroup title={t('rail.allStatuses')} fields={rows} />
          </div>
        </details>
      )}

      {children}
    </div>
  )
}

/** The lead label (when it adds anything) plus the value, monospace for a code. */
function EntryText({ entry }: { entry: RailEntry }) {
  return (
    <>
      {entry.label !== null && <span className="font-normal opacity-70">{entry.label}</span>}
      <span className={entry.isCode ? 'font-mono' : undefined}>{entry.text}</span>
    </>
  )
}
