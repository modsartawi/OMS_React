import type { ColDef, ICellRendererParams, ValueFormatterParams } from 'ag-grid-community'
import type { TFunction } from 'i18next'
import { ListTree } from 'lucide-react'
import StatusBadge from '@/core/ui/StatusBadge'
import { formatMoneyOfUnknownCurrency } from '@/core/money'
import { formatDateTime } from '@/core/util/date-format'
import type { CentralInvoiceListRow } from '@/core/models/central-invoice'
import { STATUS_SEVERITY, hasSerialDetail, pickOutcomeOf, statusOf } from './list-rows'

type Row = CentralInvoiceListRow

/**
 * The central-invoice list's columns (ticket 333).
 *
 * 🔑 **Every label is a `valueFormatter`, never only a renderer.** The XLSX export
 * (`@/core/util/grid-xlsx`) writes each cell's *formatted* value, so a status, an outcome or
 * the GS1 flag drawn only by a renderer would reach finance as raw codes. The renderers
 * draw the same words as pills.
 *
 * Money is `formatMoneyOfUnknownCurrency`: the row carries its store's country but no
 * currency, and a Bahraini remainder drawn at two decimals would lose a fils. The export
 * keeps the raw number, so Excel can total it.
 */
export function listColumns(t: TFunction, onOpenSerials: (row: Row) => void): ColDef<Row>[] {
  const statusLabel = (wire: string) => {
    const known = statusOf(wire)
    return known === 'unknown' ? wire : t(`list.status.${known}`)
  }
  const outcomeLabel = (wire: string) => {
    const known = pickOutcomeOf(wire)
    // Not billed yet, so no outcome yet: blank, never "None".
    if (known === 'pending') return ''
    return known === 'unknown' ? wire : t(`list.outcome.${known}`)
  }
  const money = ({ value }: ValueFormatterParams<Row, number | null>) => formatMoneyOfUnknownCurrency(value)
  const when = ({ value }: ValueFormatterParams<Row, string>) => formatDateTime(value)
  const code = 'font-mono text-[12px]'

  return [
    { field: 'deliveryNo', headerName: t('list.columns.deliveryNo'), width: 130, cellClass: code },
    { field: 'storeCode', headerName: t('list.columns.store'), width: 90 },
    { field: 'country', headerName: t('list.columns.country'), width: 95 },
    { field: 'requestedBy', headerName: t('list.columns.requestedBy'), width: 130 },
    { field: 'requestedAt', headerName: t('list.columns.requestedAt'), width: 145, valueFormatter: when },
    { field: 'reason', headerName: t('list.columns.reason'), width: 220, tooltipField: 'reason' },
    {
      field: 'status',
      headerName: t('list.columns.status'),
      width: 115,
      valueFormatter: ({ value }: ValueFormatterParams<Row, string>) => statusLabel(value ?? ''),
      cellRenderer: ({ value }: ICellRendererParams<Row, string>) => (
        <StatusBadge sev={STATUS_SEVERITY[statusOf(value ?? '')]}>{statusLabel(value ?? '')}</StatusBadge>
      ),
    },
    { field: 'refusalCode', headerName: t('list.columns.refusalCode'), width: 200, cellClass: code },
    { field: 'trxNumber', headerName: t('list.columns.invoiceNo'), width: 140, cellClass: code },
    {
      field: 'invoiceTotal',
      headerName: t('list.columns.invoiceTotal'),
      width: 120,
      type: 'numericColumn',
      cellClass: 'text-end tabular-nums',
      valueFormatter: money,
    },
    {
      field: 'cashRemainder',
      headerName: t('list.columns.cashRemainder'),
      headerTooltip: t('list.columns.cashRemainderHint'),
      width: 135,
      type: 'numericColumn',
      cellClass: 'text-end tabular-nums',
      valueFormatter: money,
    },
    { field: 'billedAt', headerName: t('list.columns.billedAt'), width: 145, valueFormatter: when },
    { field: 'pickDocumentNo', headerName: t('list.columns.pickDocument'), width: 140, cellClass: code },
    {
      field: 'pickOutcome',
      headerName: t('list.columns.pickOutcome'),
      width: 120,
      valueFormatter: ({ value }: ValueFormatterParams<Row, string>) => outcomeLabel(value ?? ''),
    },
    {
      field: 'serialisedInGs1Market',
      headerName: t('list.columns.gs1'),
      headerTooltip: t('list.columns.gs1Hint'),
      width: 175,
      valueFormatter: ({ value }: ValueFormatterParams<Row, boolean>) => (value ? t('list.gs1.yes') : t('list.gs1.no')),
      cellRenderer: ({ value }: ICellRendererParams<Row, boolean>) =>
        value ? <StatusBadge sev="warn">{t('list.gs1.yes')}</StatusBadge> : t('list.gs1.no'),
    },
    {
      colId: 'serials',
      headerName: t('list.columns.serials'),
      width: 130,
      // The count, so the export carries a number regulatory can total; the packs themselves
      // are the dialog and the export's second sheet.
      valueGetter: ({ data }) => data?.serials.length ?? 0,
      type: 'numericColumn',
      filter: 'agNumberColumnFilter',
      cellRenderer: ({ data }: ICellRendererParams<Row, number>) =>
        data && hasSerialDetail(data) ? (
          <button
            type="button"
            data-central-invoice-serials={data.deliveryNo}
            onClick={() => onOpenSerials(data)}
            className="inline-flex items-center gap-1 rounded-full border border-border/60 px-2 py-0.5 text-xs font-medium text-foreground hover:bg-muted"
          >
            <ListTree className="h-3 w-3" aria-hidden />
            {t('list.serials.open', { count: data.serials.length })}
          </button>
        ) : null,
    },
  ]
}
