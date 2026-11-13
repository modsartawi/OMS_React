import type { ColDef, ICellRendererParams, ValueFormatterParams } from 'ag-grid-community'
import type { TFunction } from 'i18next'
import { RotateCcw } from 'lucide-react'

import { OMS_GRID_BASE_COL_DEF } from '@/core/theme/grid-base'
import type { NphiesUndispenseRequest, NphiesUndispenseState } from '@/core/models/nphies'
import { formatStamp } from '@/core/nphies/format'
import { formatPair } from '@/core/util/bidi'
import Button from '@/core/ui/Button'
import StatusBadge from '@/core/ui/StatusBadge'
import type { Severity } from '@/core/ui/severity'
import { originKey } from './undispense-rules'

/**
 * The Undispense list's columns (ticket 898, BackOffice spec 3208 story 5): authorization, store,
 * return, origin, who, attempts, last error, added and processed times — and Retry on a failed row.
 *
 * The list is the server's (newest first, capped at 500), so nothing sorts or filters client-side:
 * a client sort of a capped list would reorder a slice and read as the whole.
 */
export const UNDISPENSE_DEFAULT_COL_DEF: ColDef<NphiesUndispenseRequest> = {
  ...OMS_GRID_BASE_COL_DEF,
  sortable: false,
  filter: false,
  resizable: true,
  cellDataType: false,
}

const STATE_SEVERITY: Record<NphiesUndispenseState, Severity> = { pending: 'go', failed: 'bad', done: 'ok' }

/**
 * 🚩 `onRetry` and `canRetry` must be STABLE for the life of the screen: AG Grid rebuilds every cell
 * when `columnDefs` changes identity, which throws keyboard focus to the body mid-act. The page reads
 * the grant and the in-flight state through a ref behind them (the authorizations list's precedent).
 */
export function buildUndispenseColumns(
  t: TFunction,
  canRetry: (row: NphiesUndispenseRequest) => boolean,
  onRetry: (row: NphiesUndispenseRequest) => void,
): ColDef<NphiesUndispenseRequest>[] {
  const stamp = (p: ValueFormatterParams<NphiesUndispenseRequest, string | null>) => formatStamp(p.value)
  return [
    { headerName: t('list.columns.authId'), field: 'authId', width: 170 },
    {
      headerName: t('list.columns.state'),
      colId: 'state',
      width: 110,
      cellRenderer: (p: ICellRendererParams<NphiesUndispenseRequest>) => {
        if (!p.data) return null
        const state = p.data.state
        const known = state in STATE_SEVERITY
        return (
          <StatusBadge sev={known ? STATE_SEVERITY[state] : 'mute'}>{known ? t(`state.${state}`) : <bdi>{state}</bdi>}</StatusBadge>
        )
      },
    },
    {
      // Beside the state it acts on, not at the row's far end: a wide row scrolls, and the act
      // must be where the agent reads "Failed".
      headerName: t('list.columns.acts'),
      colId: 'acts',
      width: 110,
      cellRenderer: (p: ICellRendererParams<NphiesUndispenseRequest>) =>
        p.data && canRetry(p.data) ? (
          <Button
            variant="outlined"
            onClick={() => p.data && onRetry(p.data)}
            data-testid="undispense-retry"
          >
            <RotateCcw className="h-3 w-3" aria-hidden />
            {t('list.retry')}
          </Button>
        ) : null,
    },
    { headerName: t('list.columns.store'), field: 'storeCode', width: 90 },
    { headerName: t('list.columns.return'), field: 'returnTransactionId', width: 170 },
    {
      headerName: t('list.columns.origin'),
      field: 'origin',
      width: 120,
      valueFormatter: (p: ValueFormatterParams<NphiesUndispenseRequest, string>) => {
        const key = originKey(p.value)
        return key ? t(key) : (p.value ?? '')
      },
    },
    {
      // A till sends no name; the login is what there is.
      headerName: t('list.columns.who'),
      colId: 'who',
      width: 130,
      valueGetter: (p) => p.data?.requestedByName || p.data?.requestedBy || '',
    },
    { headerName: t('list.columns.attempts'), field: 'attempts', width: 95 },
    // Headed neutrally: on a failed row it is the last error, on a done row the service's note.
    { headerName: t('list.columns.lastError'), field: 'lastError', flex: 1, minWidth: 200, tooltipField: 'lastError' },
    { headerName: t('list.columns.note'), field: 'note', width: 180, tooltipField: 'note' },
    { headerName: t('list.columns.addedTime'), field: 'addedTime', width: 145, valueFormatter: stamp },
    { headerName: t('list.columns.processedTime'), field: 'processedTime', width: 145, valueFormatter: stamp },
    {
      headerName: t('list.columns.retriedBy'),
      colId: 'retried',
      width: 150,
      // One `when · who` pair, formatted whole (bidi rule); the base col def isolates the cell.
      valueGetter: (p) => (p.data?.retriedBy ? formatPair(formatStamp(p.data.retriedTime), p.data.retriedBy) : ''),
    },
  ]
}
