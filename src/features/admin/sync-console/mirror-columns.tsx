import type { ColDef, ICellRendererParams, ValueFormatterParams } from 'ag-grid-community'
import type { TFunction } from 'i18next'

import type { DeadLetter, MirrorEntityCounts } from '@/core/models/sync-console'
import { MONO, formatTime } from './console-columns'
import type { CodeBadge } from './helpers'
import { formatFigure } from './store-columns'
import { deadLetterReasonLabel, deadLetterStageLabel } from './store-helpers'

/**
 * The Mirror tab's grid columns (spec 2563, ticket 457): the inbox by entity type and
 * the dead letters. As on every console grid, nothing sorts or filters on the client —
 * the door orders and pages the list, and its filters are the tab's own.
 *
 * 🚩 There is no payload column: the door never sends one, and none is asked for.
 */

/** A code's word, or the raw code when this bundle has no word for it. Plain text: the base cell isolates it. */
const codeWord = (t: TFunction, badge: (code: string) => CodeBadge) => (p: ValueFormatterParams) => {
  const code = p.value as string | null | undefined
  if (code == null) return ''
  const { labelKey } = badge(code)
  return labelKey ? t(labelKey) : code
}

export function buildEntityCountColumns(t: TFunction): ColDef<MirrorEntityCounts>[] {
  return [
    { headerName: t('mirrorTab.byEntityType.columns.entityType'), field: 'entityType', flex: 1, minWidth: 200, cellClass: MONO },
    { headerName: t('mirrorTab.byEntityType.columns.pending'), field: 'pending', width: 120, type: 'rightAligned', valueFormatter: formatFigure },
    { headerName: t('mirrorTab.byEntityType.columns.deferred'), field: 'deferred', width: 120, type: 'rightAligned', valueFormatter: formatFigure },
    { headerName: t('mirrorTab.byEntityType.columns.deadLetters'), field: 'deadLetters', width: 130, type: 'rightAligned', valueFormatter: formatFigure },
  ]
}

export function buildDeadLetterColumns(t: TFunction, onOpenError: (row: DeadLetter) => void): ColDef<DeadLetter>[] {
  return [
    { headerName: t('mirrorTab.columns.stage'), field: 'stage', width: 90, valueFormatter: codeWord(t, deadLetterStageLabel) },
    { headerName: t('mirrorTab.columns.reason'), field: 'reason', width: 200, valueFormatter: codeWord(t, deadLetterReasonLabel) },
    { headerName: t('mirrorTab.columns.entityType'), field: 'entityType', width: 170, cellClass: MONO },
    { headerName: t('mirrorTab.columns.entityId'), field: 'entityId', width: 170, cellClass: MONO },
    // `null` on the pull stage: blank.
    { headerName: t('mirrorTab.columns.action'), field: 'action', width: 110, cellClass: MONO },
    { headerName: t('mirrorTab.columns.attempts'), field: 'attempts', width: 100, type: 'rightAligned', valueFormatter: formatFigure },
    { headerName: t('mirrorTab.columns.firstSeenAt'), field: 'firstSeenAt', width: 160, valueFormatter: formatTime },
    { headerName: t('mirrorTab.columns.lastSeenAt'), field: 'lastSeenAt', width: 160, valueFormatter: formatTime },
    {
      // The clamped error, free text: truncated in the row, whole behind its button.
      headerName: t('mirrorTab.columns.error'),
      field: 'error',
      flex: 1,
      minWidth: 280,
      cellRenderer: (p: ICellRendererParams<DeadLetter>) =>
        p.data?.error ? (
          <span className="flex min-w-0 items-center gap-2">
            <bdi className="min-w-0 truncate" data-dead-letter-error="">
              {p.data.error}
            </bdi>
            <button
              type="button"
              onClick={() => p.data && onOpenError(p.data)}
              className="shrink-0 text-xs font-medium text-primary underline-offset-2 hover:underline"
              data-dead-letter-expand={`${p.data.stage}-${p.data.id}`}
            >
              {t('mirrorTab.showError')}
            </button>
          </span>
        ) : null,
    },
    // Who acknowledged it, when and why — blank on an open dead letter.
    { headerName: t('mirrorTab.columns.acknowledgedAt'), field: 'acknowledgedAt', width: 160, valueFormatter: formatTime },
    { headerName: t('mirrorTab.columns.acknowledgedBy'), field: 'acknowledgedBy', width: 140 },
    { headerName: t('mirrorTab.columns.acknowledgeReason'), field: 'acknowledgeReason', width: 220 },
  ]
}
