import type { ColDef, ICellRendererParams, ValueFormatterParams, ValueGetterParams } from 'ag-grid-community'
import type { TFunction } from 'i18next'
import { ListTree } from 'lucide-react'
import type { HybrisStockPushRow } from '@/core/models/hybris-stock'
import { pinStart } from '@/core/theme/direction'
import Button from '@/core/ui/Button'
import LtrCell from '@/core/ui/LtrCell'
import { formatDateTime } from '@/core/util/date-format'
import { formatFigure as figure } from '@/core/util/number-format'
import { PushStatus, PushTarget, PushType } from './PushCells'
import { statusLabel, targetLabel, typeLabel } from './push-labels'

type Row = HybrisStockPushRow

const time = ({ value }: ValueFormatterParams<Row, string | null>) => formatDateTime(value)

/**
 * The push log grid (ticket 849): started, finished, type, status ("Delivered to hot folder"), the
 * stores covered, rows, target (shadow / live), files, error, who asked and why (push now), and
 * Lines. A failed push's row is red (the page's row rule).
 */
export function pushColumns(t: TFunction, onLines: (row: Row) => void): ColDef<Row>[] {
  const code = 'font-mono text-[12px]'
  return [
    { field: 'pushId', headerName: t('columns.push'), width: 110, pinned: pinStart, cellClass: code, cellRenderer: LtrCell },
    { field: 'startedAt', headerName: t('columns.startedAt'), width: 150, valueFormatter: time, cellRenderer: LtrCell },
    { field: 'finishedAt', headerName: t('columns.finishedAt'), width: 150, valueFormatter: time, cellRenderer: LtrCell },
    {
      colId: 'type',
      headerName: t('columns.type'),
      width: 170,
      valueGetter: ({ data }: ValueGetterParams<Row>) => (data ? t(typeLabel(data.type)) : ''),
      cellRenderer: ({ data }: ICellRendererParams<Row>) => (data ? <PushType type={data.type} /> : null),
    },
    {
      colId: 'status',
      headerName: t('columns.status'),
      width: 190,
      valueGetter: ({ data }: ValueGetterParams<Row>) => (data ? t(statusLabel(data.status).key) : ''),
      cellRenderer: ({ data }: ICellRendererParams<Row>) => (data ? <PushStatus status={data.status} /> : null),
    },
    {
      colId: 'stores',
      headerName: t('columns.stores'),
      width: 170,
      valueGetter: ({ data }: ValueGetterParams<Row>) => (data ? data.storeCodes.join(', ') : ''),
      tooltipValueGetter: ({ data }) => (data ? data.storeCodes.join(', ') : null),
      cellClass: code,
    },
    {
      field: 'rows',
      headerName: t('columns.rows'),
      width: 100,
      type: 'rightAligned',
      valueFormatter: ({ value }: ValueFormatterParams<Row, number>) => (typeof value === 'number' ? figure(value) : ''),
    },
    {
      colId: 'target',
      headerName: t('columns.target'),
      width: 200,
      valueGetter: ({ data }: ValueGetterParams<Row>) => (data ? t(targetLabel(data.target).key) : ''),
      cellRenderer: ({ data }: ICellRendererParams<Row>) => (data ? <PushTarget target={data.target} /> : null),
    },
    {
      colId: 'files',
      headerName: t('columns.files'),
      width: 300,
      valueGetter: ({ data }: ValueGetterParams<Row>) => (data ? data.files.join(', ') : ''),
      tooltipValueGetter: ({ data }) => (data ? data.files.join('\n') : null),
      cellClass: code,
    },
    { field: 'error', headerName: t('columns.error'), width: 260, tooltipField: 'error' },
    { field: 'requestedBy', headerName: t('columns.requestedBy'), width: 120, cellClass: code, cellRenderer: LtrCell },
    { field: 'reason', headerName: t('columns.reason'), width: 220, tooltipField: 'reason' },
    {
      colId: 'actions',
      headerName: t('columns.actions'),
      width: 110,
      sortable: false,
      filter: false,
      cellRenderer: ({ data }: ICellRendererParams<Row>) =>
        data ? (
          <span className="flex h-full items-center">
            <Button variant="ghost" onClick={() => onLines(data)} data-push-lines={data.pushId}>
              <ListTree className="h-3.5 w-3.5" aria-hidden />
              {t('lines.button')}
            </Button>
          </span>
        ) : null,
    },
  ]
}
