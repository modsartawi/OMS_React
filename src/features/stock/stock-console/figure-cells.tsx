import type { TFunction } from 'i18next'
import Ltr from '@/core/ui/Ltr'
import StatusBadge from '@/core/ui/StatusBadge'
import { fsi } from '@/core/util/bidi'
import { formatDateTime } from '@/core/util/date-format'
import { formatFigure } from '@/core/util/number-format'
import { freeLabel, reservedView, type ReservedFigures } from './figures'

/**
 * Reserved and free as every console grid draws them (oms 940; shared with the item rows at 941): reserved "not
 * computed" (never a zero), the figure with a stale mark and its time, or the figure; free with "reserved not included"
 * whenever reserved is not in it. Each isolates its own values (a renderer replaces the base `BdiCell`).
 */
export function ReservedCell({ row, t }: { row: ReservedFigures; t: TFunction }) {
  const view = reservedView(row)
  if (view.kind === 'notComputed')
    return (
      <span className="italic text-muted-foreground" data-reserved="notComputed">
        {t('reserved.notComputed')}
      </span>
    )
  const at = formatDateTime(view.at)
  return (
    <span
      className="inline-flex items-center gap-1.5"
      data-reserved={view.kind}
      title={at ? t('reserved.at', { at: fsi(at) }) : undefined}
    >
      <Ltr>{formatFigure(view.value)}</Ltr>
      {view.kind === 'stale' && (
        <>
          <StatusBadge sev="warn">{t('reserved.stale')}</StatusBadge>
          {at && (
            <span className="font-mono text-[11px] text-muted-foreground">
              <Ltr>{at}</Ltr>
            </span>
          )}
        </>
      )}
    </span>
  )
}

export function FreeCell({ row, t }: { row: ReservedFigures & { free: number }; t: TFunction }) {
  const label = freeLabel(row)
  return (
    <span className="inline-flex items-center gap-1.5" data-free-label={label ?? ''}>
      <Ltr>{formatFigure(row.free)}</Ltr>
      {label && <span className="text-xs text-muted-foreground">{t(`free.${label}`)}</span>}
    </span>
  )
}
