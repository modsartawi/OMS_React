import type { TFunction } from 'i18next'
import type { ColDef, ValueFormatterParams } from 'ag-grid-community'
import type { BupaOutcomeSummaryRow } from '@/core/models/bupa-line-outcome'

/**
 * The summary grid's columns (oms 899): kind · what was sent · what was dispensed · the counts. Counts are the door's,
 * shown as sent. A dispensed side that is null (voided / unresolved) reads "—". The totals row is pinned below and
 * carries only its counts, so every other column formats a missing value as blank.
 *
 * Codes are machine values (monospace); the grid base's renderer isolates every cell.
 */

/** A summary row, or the pinned totals row (counts only, `total: true`). */
export type SummaryGridRow = Partial<BupaOutcomeSummaryRow> & { total?: boolean }

const CODE = 'font-mono text-[12px]'
const COUNT: Partial<ColDef<SummaryGridRow>> = { type: 'numericColumn', cellClass: 'text-end tabular-nums', minWidth: 90, width: 100 }

export function summaryColumns(t: TFunction): ColDef<SummaryGridRow>[] {
  const dash = t('dash')
  /** A dispensed field: "—" when nothing was dispensed; the totals row stays blank. */
  const dispensed = (pick: (d: NonNullable<BupaOutcomeSummaryRow['dispensed']>) => string | null): Partial<ColDef<SummaryGridRow>> => ({
    valueGetter: ({ data }) => (!data || data.total ? '' : data.dispensed ? (pick(data.dispensed) ?? '') : dash),
  })
  const count = (field: keyof BupaOutcomeSummaryRow, header: string): ColDef<SummaryGridRow> => ({
    colId: field,
    field,
    headerName: t(`column.${header}`),
    ...COUNT,
  })
  return [
    {
      colId: 'kind',
      field: 'kind',
      headerName: t('column.kind'),
      minWidth: 130,
      valueFormatter: ({ data, value }: ValueFormatterParams<SummaryGridRow>) =>
        data?.total ? t('report.total') : value ? t(`kind.${value}`) : '',
      cellClass: ({ data }) => (data?.total ? 'font-semibold' : ''),
    },
    { colId: 'sentMaterial', headerName: t('column.sentMaterial'), valueGetter: ({ data }) => data?.sent?.materialNumber ?? '', cellClass: CODE, width: 120 },
    { colId: 'sentSfda', headerName: t('column.sentSfda'), valueGetter: ({ data }) => data?.sent?.sfdaCode ?? '', cellClass: CODE, width: 130 },
    { colId: 'sentText', headerName: t('column.sentText'), valueGetter: ({ data }) => data?.sent?.text ?? '', minWidth: 160, flex: 1, tooltipValueGetter: ({ value }) => value },
    { colId: 'sentNameEn', headerName: t('column.sentNameEn'), valueGetter: ({ data }) => data?.sent?.nameEn ?? '', minWidth: 160, flex: 1 },
    { colId: 'sentNameAr', headerName: t('column.sentNameAr'), valueGetter: ({ data }) => data?.sent?.nameAr ?? '', minWidth: 160, flex: 1 },
    { colId: 'dispensedMaterial', headerName: t('column.dispensedMaterial'), ...dispensed((d) => d.materialNumber), cellClass: CODE, width: 120 },
    { colId: 'dispensedSfda', headerName: t('column.dispensedSfda'), ...dispensed((d) => d.sfdaCode), cellClass: CODE, width: 130 },
    { colId: 'dispensedNameEn', headerName: t('column.dispensedNameEn'), ...dispensed((d) => d.nameEn), minWidth: 160, flex: 1 },
    { colId: 'dispensedNameAr', headerName: t('column.dispensedNameAr'), ...dispensed((d) => d.nameAr), minWidth: 160, flex: 1 },
    count('orders', 'orders'),
    count('lines', 'lines'),
    count('linesQtyDiffers', 'linesQtyDiffers'),
    count('sentBaseUnits', 'sentBaseUnits'),
    count('dispensedBaseUnits', 'dispensedBaseUnits'),
  ]
}
