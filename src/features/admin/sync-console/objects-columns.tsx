import type { ColDef, ICellRendererParams, ValueFormatterParams } from 'ag-grid-community'
import type { TFunction } from 'i18next'
import { Trans } from 'react-i18next'

import Button from '@/core/ui/Button'
import Ltr from '@/core/ui/Ltr'
import StatusBadge from '@/core/ui/StatusBadge'
import type { PushObject } from '@/core/models/sync-console'
import { MONO } from './console-columns'
import { figure } from './helpers'
import { objectState, objectStateBadge } from './objects-helpers'

/** A count as drawn; `null` (no HQ table) is blank. The base `defaultColDef` isolates the cell. */
const formatCount = (p: ValueFormatterParams) => (typeof p.value === 'number' ? figure(p.value) : '')

/**
 * The Objects page's grid (ticket 662). With `canEnrol`, a ready row carries **Enrol**; a row
 * that is enrolled or has no line number carries nothing, and without the grant there is no
 * action column at all (absent, not disabled), as on Sync pending.
 */
export function buildObjectColumns(
  t: TFunction,
  canEnrol: boolean,
  onEnrol: (o: PushObject) => void,
): ColDef<PushObject>[] {
  const columns: ColDef<PushObject>[] = [
    { headerName: t('objects.columns.objectId'), field: 'objectId', flex: 1, minWidth: 220, cellClass: MONO },
    { headerName: t('objects.columns.table'), field: 'table', flex: 1, minWidth: 180, cellClass: MONO },
    { headerName: t('objects.columns.lineNumber'), field: 'lineNumber', width: 90, cellClass: MONO },
    { headerName: t('objects.columns.hqRows'), field: 'hqRows', width: 120, valueFormatter: formatCount },
    {
      headerName: t('objects.columns.state'),
      colId: 'state',
      width: 200,
      cellRenderer: (p: ICellRendererParams<PushObject>) => {
        if (!p.data) return null
        const state = objectState(p.data)
        const badge = objectStateBadge(state)
        return (
          <span className="flex items-center gap-2" data-object-state={state}>
            <StatusBadge sev={badge.sev}>{t(badge.labelKey)}</StatusBadge>
            {state === 'enrolled' && (
              <span className="text-xs text-muted-foreground">
                <Trans
                  t={t}
                  i18nKey="objects.storesEnrolled"
                  count={p.data.storesEnrolled}
                  values={{ n: figure(p.data.storesEnrolled) }}
                  components={{ n: <Ltr /> }}
                />
              </span>
            )}
          </span>
        )
      },
      tooltipValueGetter: (p) => (p.data && objectState(p.data) === 'noLine' ? t('objects.noLineHint') : undefined),
    },
  ]
  if (canEnrol)
    columns.push({
      headerName: '',
      colId: 'enrol',
      width: 120,
      cellRenderer: (p: ICellRendererParams<PushObject>) =>
        p.data && objectState(p.data) === 'ready' ? (
          <Button variant="link" onClick={() => p.data && onEnrol(p.data)} data-object-enrol={p.data.objectId}>
            {t('objects.enrol')}
          </Button>
        ) : null,
    })
  return columns
}
