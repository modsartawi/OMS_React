import type { ColDef, ICellRendererParams, ValueFormatterParams } from 'ag-grid-community'
import type { TFunction } from 'i18next'
import { Trans } from 'react-i18next'
import Ltr from '@/core/ui/Ltr'
import { formatDateTime } from '@/core/util/date-format'
import type { FailedLine, JobLabel, LineAction, RequestState } from './failed-line'

/** Where a line's two links go: the donor list seeded on its request, and the delivery's details. */
export interface LineLinks {
  openRequest: (requestNo: string) => void
  openDelivery: (deliveryNo: string) => void
}

/** The job's label in words. */
export function jobText(t: TFunction, job: JobLabel): string {
  return job.kind === 'raw' ? job.status : t(`job.${job.kind}`)
}

/** What the line asks of HQ, as plain text — the cell's value, for sort and Ctrl+C. */
export function actionText(t: TFunction, action: LineAction): string {
  if (action.kind !== 'reverse') return t(`action.${action.kind}`)
  // 2371 marks a line reverse-by-hand only once DRS reported the STO; an empty one never prints a gap.
  return action.sto ? t('action.reverse', { sto: action.sto }) : t('action.reverseNoSto')
}

/** The request state in words. */
export function stateText(t: TFunction, state: RequestState): string {
  return state.kind === 'known' ? t(`state.${state.state}`) : state.state
}

const LINK = 'font-mono text-[12px] text-primary underline-offset-2 hover:underline focus-visible:underline focus:outline-none'

/**
 * The Failed donor transfers grid (ticket 434, spec 430 D12/D15): the WPF columns, in WPF's order.
 *
 * Labels are `valueGetter`s/`valueFormatter`s, so sort and Ctrl+C read words, not codes. Cells are
 * isolated by the core grid base; a column with its own renderer isolates its own whole value —
 * the request and delivery links and the STO with `Ltr`, DRS's free-text error with `<bdi>`.
 */
export function lineColumns(t: TFunction, links: LineLinks): ColDef<FailedLine>[] {
  const code = 'font-mono text-[12px]'
  const when = ({ value }: ValueFormatterParams<FailedLine, string | null>) => formatDateTime(value)
  /** A number that opens something: the whole value isolated, the click handed on. */
  const linkCell = (kind: 'request' | 'delivery', title: string, onOpen: (no: string) => void) =>
    function LinkCell({ value }: ICellRendererParams<FailedLine, string>) {
      const no = value?.trim()
      return no ? (
        <button type="button" className={LINK} title={title} data-line-open={kind} onClick={() => onOpen(no)}>
          <Ltr>{no}</Ltr>
        </button>
      ) : null
    }

  return [
    {
      colId: 'action',
      headerName: t('columns.action'),
      width: 250,
      valueGetter: ({ data }) => (data ? actionText(t, data.action) : ''),
      cellRenderer: ({ data }: ICellRendererParams<FailedLine>) => {
        if (!data) return null
        const { action } = data
        return (
          <span data-line-action={action.kind} className={action.kind === 'reverse' ? 'font-medium text-attention-800' : ''}>
            {action.kind === 'reverse' && action.sto ? (
              // The STO is a machine value inside a sentence: one isolate around it, words around that.
              <Trans t={t} i18nKey="action.reverseRich" values={{ sto: action.sto }} components={{ sto: <Ltr /> }} />
            ) : (
              <bdi>{actionText(t, action)}</bdi>
            )}
          </span>
        )
      },
    },
    {
      colId: 'requestNo',
      headerName: t('columns.requestNo'),
      width: 130,
      valueGetter: ({ data }) => data?.row.requestNo ?? '',
      cellRenderer: linkCell('request', t('links.openRequest'), links.openRequest),
    },
    {
      colId: 'deliveryNo',
      headerName: t('columns.deliveryNo'),
      width: 130,
      valueGetter: ({ data }) => data?.row.deliveryNo ?? '',
      cellRenderer: linkCell('delivery', t('links.openDelivery'), links.openDelivery),
    },
    { colId: 'donorStore', headerName: t('columns.donorStore'), width: 110, cellClass: code, valueGetter: ({ data }) => data?.row.donorStore ?? '' },
    { colId: 'orderStore', headerName: t('columns.orderStore'), width: 110, cellClass: code, valueGetter: ({ data }) => data?.row.orderStore ?? '' },
    {
      colId: 'requestState',
      headerName: t('columns.requestState'),
      width: 120,
      valueGetter: ({ data }) => (data ? stateText(t, data.requestState) : ''),
    },
    { colId: 'job', headerName: t('columns.job'), width: 105, valueGetter: ({ data }) => (data ? jobText(t, data.job) : '') },
    {
      colId: 'attemptCount',
      headerName: t('columns.attempts'),
      width: 95,
      type: 'numericColumn',
      cellClass: 'text-end tabular-nums',
      valueGetter: ({ data }) => data?.row.attemptCount ?? null,
    },
    {
      colId: 'lastAttempt',
      headerName: t('columns.lastAttempt'),
      width: 145,
      valueGetter: ({ data }) => data?.lastAttemptAt ?? null,
      valueFormatter: when,
    },
    {
      colId: 'deadline',
      headerName: t('columns.deadline'),
      width: 145,
      valueGetter: ({ data }) => data?.deadlineAt ?? null,
      valueFormatter: when,
    },
    { colId: 'transferStoNo', headerName: t('columns.sto'), width: 120, cellClass: code, valueGetter: ({ data }) => data?.row.transferStoNo ?? '' },
    {
      colId: 'reverseByHand',
      headerName: t('columns.reverseByHand'),
      width: 130,
      valueGetter: ({ data }) => (data?.row.reverseByHand ? t('reverseByHand.yes') : ''),
    },
    {
      colId: 'errorMessage',
      headerName: t('columns.lastError'),
      flex: 1,
      minWidth: 240,
      valueGetter: ({ data }) => data?.row.errorMessage ?? '',
      tooltipValueGetter: ({ value }) => (typeof value === 'string' && value ? value : undefined),
      // DRS's own words, in whichever script: free text, dir auto.
      cellRenderer: ({ value }: ICellRendererParams<FailedLine, string>) => (value ? <bdi data-line-error="">{value}</bdi> : null),
    },
  ]
}
