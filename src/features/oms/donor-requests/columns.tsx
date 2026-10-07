import type { ColDef, ICellRendererParams, ValueFormatterParams } from 'ag-grid-community'
import type { TFunction } from 'i18next'
import StatusBadge from '@/core/ui/StatusBadge'
import type { DonorRequestModel } from '@/core/models/sd-document'
import type { Elapsed } from '@/core/oms/donor-moments'
import { formatDateTime } from '@/core/util/date-format'
import { DONOR_REQUEST_STATES } from './criteria'
import type { DonorRowView } from './donor-row'

/** A list row: the request as the door sent it, and what this side derives from it. */
export type DonorRequestRow = DonorRequestModel & { view: DonorRowView }

/** An elapsed time in the namespace's short form: `25m`, `1h 20m`, `2d 3h`. */
export function elapsedText(t: TFunction, e: Elapsed): string {
  if (e.days) return t('elapsed.days', { d: e.days, h: e.hours })
  if (e.hours) return t('elapsed.hours', { h: e.hours, m: e.minutes })
  return t('elapsed.minutes', { m: e.minutes })
}

const KNOWN_STATES: ReadonlySet<string> = new Set(DONOR_REQUEST_STATES)

/**
 * The pick time as a number to sort on: a waiting row by how long it has waited, a picked one by
 * how long the pick took, and a row with neither last.
 */
function pickMinutes(row: DonorRequestRow | undefined): number {
  const w = row?.view.waiting
  if (w) return w.days * 1440 + w.hours * 60 + w.minutes
  return row?.view.minutesToPick ?? -1
}

/**
 * The donor request list's columns (ticket 431, spec 430 D3).
 *
 * 🔑 Every label is a `valueFormatter`, never only a renderer: 432's export writes each cell's
 * formatted value, so a state or an outcome drawn only by a renderer would leave as a raw code.
 * Cells are isolated by the core grid base; a column with its own renderer isolates its own value.
 */
export function donorColumns(t: TFunction): ColDef<DonorRequestRow>[] {
  const code = 'font-mono text-[12px]'
  const when = ({ value }: ValueFormatterParams<DonorRequestRow, string>) => formatDateTime(value)
  const stateLabel = (wire: string) => {
    const norm = wire.trim().toUpperCase()
    return KNOWN_STATES.has(norm) ? t(`state.${norm}`) : wire
  }
  const outcomeLabel = (row: DonorRequestRow | undefined) => {
    if (!row) return ''
    const { outcome, cancelledAfterPicked, tone } = row.view
    if (cancelledAfterPicked) return t('outcome.cancelledAfterPicked')
    if (outcome) return t(`outcome.${outcome}`)
    // A cancelled state the server sent no outcome for still reads as a cancel.
    if (tone === 'muted') return t('outcome.cancelled')
    return row.outcome ?? ''
  }
  const pickTime = (row: DonorRequestRow | undefined) => {
    if (!row) return ''
    if (row.view.waiting) return t('pick.waiting', { elapsed: elapsedText(t, row.view.waiting) })
    if (row.view.minutesToPick === null) return ''
    const m = row.view.minutesToPick
    return t('pick.took', {
      elapsed: elapsedText(t, { days: Math.floor(m / 1440), hours: Math.floor((m % 1440) / 60), minutes: m % 60 }),
    })
  }

  return [
    { field: 'requestNo', headerName: t('columns.requestNo'), width: 130, cellClass: code },
    { field: 'deliveryNo', headerName: t('columns.deliveryNo'), width: 130, cellClass: code },
    { field: 'donorStore', headerName: t('columns.donorStore'), width: 110, cellClass: code },
    { field: 'orderStore', headerName: t('columns.orderStore'), width: 110, cellClass: code },
    {
      field: 'state',
      headerName: t('columns.state'),
      width: 120,
      valueFormatter: ({ value }: ValueFormatterParams<DonorRequestRow, string>) => stateLabel(value ?? ''),
    },
    {
      colId: 'outcome',
      headerName: t('columns.outcome'),
      width: 190,
      valueGetter: ({ data }) => outcomeLabel(data),
      cellRenderer: ({ data, value }: ICellRendererParams<DonorRequestRow, string>) =>
        data && value ? (
          <span data-donor-tone={data.view.tone ?? ''} data-donor-outcome={data.view.outcome ?? ''}>
            <StatusBadge sev={data.view.tone === 'attention' ? 'warn' : 'mute'}>
              <bdi>{value}</bdi>
            </StatusBadge>
          </span>
        ) : null,
    },
    { field: 'outcomeReason', headerName: t('columns.outcomeReason'), width: 200, tooltipField: 'outcomeReason' },
    {
      field: 'required',
      headerName: t('columns.asked'),
      width: 90,
      type: 'numericColumn',
      cellClass: 'text-end tabular-nums',
    },
    {
      field: 'picked',
      headerName: t('columns.given'),
      width: 90,
      type: 'numericColumn',
      cellClass: 'text-end tabular-nums',
    },
    { field: 'raisedAt', headerName: t('columns.raisedAt'), width: 145, valueFormatter: when },
    { field: 'fulfilledAt', headerName: t('columns.pickedAt'), width: 145, valueFormatter: when },
    { field: 'outcomeAt', headerName: t('columns.endedAt'), width: 145, valueFormatter: when },
    {
      colId: 'pickTime',
      headerName: t('columns.pickTime'),
      headerTooltip: t('columns.pickTimeHint'),
      width: 150,
      valueGetter: ({ data }) => pickTime(data),
      // The text is what the export writes; the order is the duration's, not the text's.
      comparator: (_a, _b, nodeA, nodeB) => pickMinutes(nodeA.data) - pickMinutes(nodeB.data),
      // The elapsed time carries words (`1h 20m`): dir auto keeps each locale in its own order.
      cellRenderer: ({ data, value }: ICellRendererParams<DonorRequestRow, string>) =>
        value ? (
          <bdi data-donor-waiting={data?.view.waiting ? '' : undefined} className={data?.view.waiting ? 'font-medium text-foreground' : ''}>
            {value}
          </bdi>
        ) : null,
    },
  ]
}
