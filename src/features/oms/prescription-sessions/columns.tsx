import type { ColDef, ICellRendererParams, ValueFormatterParams } from 'ag-grid-community'
import type { TFunction } from 'i18next'
import Ltr from '@/core/ui/Ltr'
import StatusBadge from '@/core/ui/StatusBadge'
import { StepSummary, Word } from '@/core/prescription-session/SessionWords'
import { wordText } from '@/core/prescription-session/words'
import { formatDateTime, formatDay } from '@/core/util/date-format'
import { listText } from '@/core/util/list-format'
import OpenRowAction from './OpenRowAction'
import type { OpenGridRow } from './open-row'

type Cell = ICellRendererParams<OpenGridRow>

/**
 * The Open grid's columns (ticket 545; BackOffice 3015's row). No column sorts by default: the rows
 * come oldest idle first and that order stands until a header is pressed.
 *
 * Every word column has a `valueGetter` that reads the word as text (sort, filter, Ctrl+C), and a
 * renderer only where it draws more than text. Cells are isolated by the core grid base (`<bdi>`,
 * dir auto: a name in either script); a renderer isolates its own values (`Ltr` for a store, a code).
 *
 * `t` is this feature's namespace, `tw` the core `prescription-session` one the codes read in.
 * `onWriteOff` asks the tab to open the write-off dialog for a row (the dialog lives in the tab).
 */
export function openColumns(
  t: TFunction,
  tw: TFunction,
  lang: string,
  onWriteOff: (row: OpenGridRow) => void,
): ColDef<OpenGridRow>[] {
  const code = 'font-mono text-[12px]'
  const when = ({ value }: ValueFormatterParams<OpenGridRow, string | null>) => formatDateTime(value)
  const num = { type: 'numericColumn', width: 90, cellClass: 'text-end tabular-nums' } as const
  const w = (key: string) => tw(key)

  return [
    { field: 'displayId', headerName: t('columns.displayId'), width: 110, cellClass: code },
    {
      colId: 'source',
      headerName: t('columns.source'),
      width: 100,
      valueGetter: ({ data }) => (data ? wordText(w, data.view.source) : ''),
    },
    { field: 'sourceKey', headerName: t('columns.sourceKey'), width: 130, cellClass: code },
    { field: 'beneficiaryName', headerName: t('columns.beneficiary'), width: 170, tooltipField: 'beneficiaryName' },
    { field: 'beneficiaryId', headerName: t('columns.beneficiaryId'), width: 120, cellClass: code },
    { field: 'holdingStore', headerName: t('columns.holdingStore'), width: 100, cellClass: code },
    {
      colId: 'otherStore',
      headerName: t('columns.otherStore'),
      headerTooltip: t('columns.otherStoreHint'),
      width: 150,
      valueGetter: ({ data }) => data?.view.otherStore?.store ?? '',
      cellRenderer: ({ data }: Cell) =>
        data?.view.otherStore ? (
          <span className="inline-flex items-center gap-1.5" data-ps-other-store={data.view.otherStore.store} data-ps-other-reason={data.view.otherStore.reason.raw}>
            <span className={code}>
              <Ltr>{data.view.otherStore.store}</Ltr>
            </span>
            <StatusBadge sev="mute">
              <Word word={data.view.otherStore.reason} />
            </StatusBadge>
          </span>
        ) : null,
    },
    {
      colId: 'state',
      headerName: t('columns.state'),
      width: 150,
      valueGetter: ({ data }) => (data ? wordText(w, data.view.state) : ''),
      cellRenderer: ({ data }: Cell) =>
        data ? (
          <span data-ps-state={data.state}>
            <StatusBadge sev={data.view.stateSev}>
              <Word word={data.view.state} />
            </StatusBadge>
          </span>
        ) : null,
    },
    {
      colId: 'route',
      headerName: t('columns.route'),
      width: 130,
      valueGetter: ({ data }) => (data ? wordText(w, data.view.route) : ''),
    },
    { field: 'orderNo', headerName: t('columns.orderNo'), width: 120, cellClass: code },
    {
      colId: 'step',
      headerName: t('columns.step'),
      width: 340,
      valueGetter: ({ data }) => data?.view.step?.label ?? '',
      tooltipValueGetter: ({ data }) => data?.view.step?.label ?? '',
      cellRenderer: ({ data }: Cell) => (data?.view.step ? <StepSummary step={data.view.step} /> : null),
    },
    { field: 'ageDays', headerName: t('columns.ageDays'), ...num },
    { field: 'idleDays', headerName: t('columns.idleDays'), ...num },
    {
      colId: 'lapsesAtEndOf',
      headerName: t('columns.lapsesAtEndOf'),
      width: 130,
      valueGetter: ({ data }) => formatDay(data?.view.lapseDay),
      cellRenderer: ({ data, value }: Cell) =>
        value ? (
          <span data-ps-lapse-day={data?.view.lapseDay ?? ''}>
            <StatusBadge sev="warn">
              <Ltr>{value}</Ltr>
            </StatusBadge>
          </span>
        ) : null,
    },
    { field: 'dispensedAt', headerName: t('columns.dispensedAt'), width: 145, valueFormatter: when },
    { field: 'invoiceOwedAt', headerName: t('columns.invoiceOwedAt'), width: 145, valueFormatter: when },
    {
      colId: 'openItems',
      headerName: t('columns.openItems'),
      width: 200,
      valueGetter: ({ data }) => (data ? listText(data.view.openItems.map((i) => wordText(w, i)), lang) : ''),
      cellRenderer: ({ data }: Cell) =>
        data && data.view.openItems.length > 0 ? (
          <span className="inline-flex flex-wrap gap-1" data-ps-open-items="">
            {data.view.openItems.map((item) => (
              <span key={item.raw} data-ps-open-item={item.raw}>
                <StatusBadge sev="warn">
                  <Word word={item} />
                </StatusBadge>
              </span>
            ))}
          </span>
        ) : null,
    },
    {
      // The row-action slot (548): "Close without invoice", on a DISPENSED row only.
      colId: 'actions',
      headerName: '',
      width: 170,
      sortable: false,
      filter: false,
      cellRenderer: ({ data }: Cell) =>
        data?.view.rowAction ? (
          <span data-ps-row-action={data.sessionId}>
            <OpenRowAction row={data} onOpen={onWriteOff} />
          </span>
        ) : null,
    },
  ]
}
