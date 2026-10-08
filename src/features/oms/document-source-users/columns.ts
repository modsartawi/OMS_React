import type { ColDef } from 'ag-grid-community'
import type { TFunction } from 'i18next'
import type { SdDocumentSourceUserModel } from '@/core/models/document-source-user'
import { formatDateTime } from '@/core/util/date-format'

// The Document source users grid (ticket 438, spec 430 D7/D15): WPF's four fields. Every cell is
// isolated whole by the core grid base; no column has its own renderer. The time is a
// `valueFormatter`, so sort reads the ISO value and the quick filter and export read what is drawn.

const CODE = 'font-mono text-[12px]'

export function sourceUserColumns(t: TFunction): ColDef<SdDocumentSourceUserModel>[] {
  return [
    { field: 'userId', headerName: t('columns.userId'), width: 140, cellClass: CODE },
    { field: 'documentSource', headerName: t('columns.documentSource'), width: 180, cellClass: CODE },
    { field: 'updatedBy', headerName: t('columns.updatedBy'), width: 160 },
    {
      field: 'updatedAt',
      headerName: t('columns.updatedAt'),
      width: 160,
      // An unset time (`0001-01-01`) is drawn blank.
      valueFormatter: ({ value }) => formatDateTime(value),
      getQuickFilterText: ({ value }) => formatDateTime(value),
    },
  ]
}

/** Identities the export writes as text, so Excel never reshapes a user ID that looks like a number. */
export const EXPORT_AS_TEXT: ReadonlySet<string> = new Set(['userId', 'documentSource'])
