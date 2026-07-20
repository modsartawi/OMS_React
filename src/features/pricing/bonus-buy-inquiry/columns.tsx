import type { ColDef, ICellRendererParams, ValueFormatterParams } from 'ag-grid-community'
import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'
import type { BbyInquiryRow } from '@/core/models/bonus-buy-inquiry'

// The MINIMAL inquiry grid (ticket 062): identity + description + status + validFrom.
// The full 28-field grouped header, sticky identity, chips and Details action are
// ticket 063 — this slice proves the AG-Grid wiring on four columns. Raw row values
// are preserved (dates stay `yyyyMMdd` on the row); formatting is display-only, so a
// later CSV export can still dump the raw fields.

export const INQUIRY_DEFAULT_COL_DEF: ColDef<BbyInquiryRow> = {
  sortable: true,
  resizable: true,
}

/** `yyyyMMdd → yyyy-MM-dd`; passes anything that isn't 8 digits through untouched. */
function formatBbyDate(raw: string): string {
  return /^\d{8}$/.test(raw) ? `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}` : raw
}

/** Identity cell: the BBY number with a green "valid today" dot when the server's
 *  `isActive` flag is set — the active state reads at a glance without re-checking
 *  the dates (story 8). Colour isn't the only channel: title + aria carry the label. */
function IdentityCell(p: ICellRendererParams<BbyInquiryRow>) {
  const { t } = useTranslation('bonus-buy-inquiry')
  const row = p.data
  if (!row) return null
  return (
    <span className="inline-flex items-center gap-2">
      {row.isActive && (
        <span
          className="inline-block h-2 w-2 shrink-0 rounded-full bg-emerald-500"
          title={t('activeMarker.label')}
          aria-label={t('activeMarker.label')}
        />
      )}
      <span className="font-mono tabular-nums">{row.bbyNumber}</span>
    </span>
  )
}

export function buildInquiryColumns(t: TFunction): ColDef<BbyInquiryRow>[] {
  return [
    {
      headerName: t('columns.bbyNumber'),
      field: 'bbyNumber',
      width: 160,
      cellRenderer: IdentityCell,
    },
    { headerName: t('columns.description'), field: 'description', flex: 1, minWidth: 220 },
    {
      headerName: t('columns.status'),
      field: 'bbyStatus',
      width: 140,
      valueFormatter: (p: ValueFormatterParams<BbyInquiryRow, string>) =>
        p.value ? t(`status.${p.value}`, { defaultValue: p.value }) : '',
    },
    {
      headerName: t('columns.validFrom'),
      field: 'validFrom',
      width: 140,
      valueFormatter: (p: ValueFormatterParams<BbyInquiryRow, string>) => formatBbyDate(p.value ?? ''),
    },
  ]
}
