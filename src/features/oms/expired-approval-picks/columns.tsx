import type { TFunction } from 'i18next'
import type { ColDef, ICellRendererParams } from 'ag-grid-community'
import type { ExpiredApprovalPickPharmacist, ExpiredApprovalPickRow } from '@/core/models/expired-approval-pick'
import { pinStart } from '@/core/theme/direction'
import { formatDateTime } from '@/core/util/date-format'

/**
 * The expired approval picks report's columns, one set per tab (BackOffice ticket 3874). Counts are the door's, sorted as
 * sent; a pharmacist row opens that pharmacist's picks (the page's `onRowClicked`), so no cell carries its own link.
 *
 * Codes (store, pharmacist id, document, approval, delivery) are machine values: monospace, and exported as text so a
 * spreadsheet never turns `0012…` into a number.
 */

const CODE = 'font-mono text-[12px]'
const COUNT: Partial<ColDef> = { type: 'numericColumn', cellClass: 'text-end tabular-nums', minWidth: 90, flex: 1 }

/** Every column id, so each has its header in both locales (`i18n-keys.test.ts`). */
export const COLUMN_IDS = [
  'store', 'pharmacist', 'soldNotBilled', 'neverSold', 'picks', 'units',
  'documentNo', 'sourceType', 'sourceKey', 'outcome', 'deliveryNo', 'pickedAt', 'expiredAt',
] as const

/** Every code column id, exported as text. */
export const TEXT_COLUMNS = new Set(['store', 'pharmacist', 'documentNo', 'sourceType', 'sourceKey', 'deliveryNo'])

/** A blank pharmacist is a pick no name could be read off: shown as such, never as a person. */
function PharmacistCell({ pharmacist, t }: { pharmacist: string | undefined; t: TFunction }) {
  return pharmacist ? (
    <span className={CODE}>{pharmacist}</span>
  ) : (
    <span className="italic text-muted-foreground" data-eap-unknown-pharmacist="">
      {t('unknownPharmacist')}
    </span>
  )
}

const pharmacistText = (t: TFunction, pharmacist: string | undefined) => pharmacist || t('unknownPharmacist')

function count<R>(t: TFunction, field: string): ColDef<R> {
  return { colId: field, field: field as ColDef<R>['field'], headerName: t(`column.${field}`), ...(COUNT as Partial<ColDef<R>>) }
}

function pharmacistColumn<R extends { pharmacist: string }>(t: TFunction): ColDef<R> {
  return {
    colId: 'pharmacist',
    headerName: t('column.pharmacist'),
    minWidth: 150,
    valueGetter: ({ data }) => pharmacistText(t, data?.pharmacist),
    cellRenderer: ({ data }: ICellRendererParams<R>) => <PharmacistCell pharmacist={data?.pharmacist} t={t} />,
  }
}

export function pharmacistColumns(t: TFunction): ColDef<ExpiredApprovalPickPharmacist>[] {
  return [
    { colId: 'store', field: 'storeCode', headerName: t('column.store'), pinned: pinStart, minWidth: 100, cellClass: CODE },
    { ...pharmacistColumn<ExpiredApprovalPickPharmacist>(t), pinned: pinStart },
    { ...count(t, 'soldNotBilled'), headerTooltip: t('tileHint.soldNotBilled') },
    { ...count(t, 'neverSold'), headerTooltip: t('tileHint.neverSold') },
    {
      ...(COUNT as Partial<ColDef<ExpiredApprovalPickPharmacist>>),
      colId: 'picks',
      headerName: t('column.picks'),
      valueGetter: ({ data }) => (data ? data.soldNotBilled + data.neverSold : null),
    },
    count(t, 'units'),
  ]
}

export function pickColumns(t: TFunction): ColDef<ExpiredApprovalPickRow>[] {
  const dash = t('dash')
  const text = (value: string | undefined) => value || dash
  return [
    { colId: 'expiredAt', headerName: t('column.expiredAt'), pinned: pinStart, minWidth: 150, valueGetter: ({ data }) => formatDateTime(data?.expiredAt) || dash },
    { colId: 'store', field: 'storeCode', headerName: t('column.store'), minWidth: 90, cellClass: CODE },
    pharmacistColumn<ExpiredApprovalPickRow>(t),
    {
      colId: 'outcome',
      headerName: t('column.outcome'),
      minWidth: 150,
      valueGetter: ({ data }) => (data ? t(`outcomeShort.${data.outcome}`, { defaultValue: data.outcome }) : dash),
      tooltipValueGetter: ({ data }) => (data ? t(`outcome.${data.outcome}`, { defaultValue: data.outcome }) : ''),
    },
    { colId: 'documentNo', field: 'documentNo', headerName: t('column.documentNo'), minWidth: 140, cellClass: CODE },
    { colId: 'sourceType', field: 'sourceType', headerName: t('column.sourceType'), minWidth: 100, cellClass: CODE },
    { colId: 'sourceKey', headerName: t('column.sourceKey'), minWidth: 160, flex: 1, cellClass: CODE, valueGetter: ({ data }) => text(data?.sourceKey) },
    { colId: 'deliveryNo', headerName: t('column.deliveryNo'), minWidth: 130, cellClass: CODE, valueGetter: ({ data }) => text(data?.deliveryNo) },
    count(t, 'units'),
    { colId: 'pickedAt', headerName: t('column.pickedAt'), minWidth: 150, valueGetter: ({ data }) => formatDateTime(data?.pickedAt) || dash },
  ]
}
