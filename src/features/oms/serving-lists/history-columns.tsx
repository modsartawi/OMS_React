import type { ColDef, ICellRendererParams } from 'ag-grid-community'
import type { TFunction } from 'i18next'
import { Trans, useTranslation } from 'react-i18next'

import type { ServingListChangeRow } from '@/core/models/serving-list'
import { OMS_GRID_BASE_COL_DEF } from '@/core/theme/grid-base'
import LtrCell from '@/core/ui/LtrCell'
import { formatDateTime } from '@/core/util/date-format'
import { changeRow, type ChangeNames } from './change-row'

/**
 * The History grid's columns (oms ticket 571, BackOffice spec 3042): when, who, the action in words, the
 * store (blank for a list-level action), a create's / rename's names, and the note. Read-only: the log is
 * append-only and has no undo. Every column's value is the text the grid shows, so the grid-xlsx export
 * writes the same words.
 */

/** Sortable, resizable; the door sends the rows newest first and the grid keeps that order until sorted. */
export const HISTORY_DEFAULT_COL_DEF: ColDef = {
  ...OMS_GRID_BASE_COL_DEF,
  sortable: true,
  filter: false,
  resizable: true,
  cellDataType: false,
}

/** The names as one plain sentence (the column's value: what the export writes and the sort reads). */
function namesText(t: TFunction, names: ChangeNames): string {
  // The locale marks each name with a `<v>` slot for the cell's `<bdi>`; the plain text drops the markers.
  const plain = (s: string) => s.replace(/<\/?v>/g, '')
  if (names.kind === 'create') return plain(t('history.names.create', { en: names.en, ar: names.ar }))
  if (names.kind === 'rename')
    return plain(t('history.names.rename', { fromEn: names.fromEn, fromAr: names.fromAr, toEn: names.toEn, toAr: names.toAr }))
  return ''
}

/** A create's or rename's names: each name is free text in either script, isolated on its own by a `<bdi>`; the words carry the order. */
function NamesCell(p: ICellRendererParams<ServingListChangeRow>) {
  const { t } = useTranslation('serving-lists')
  if (!p.data) return null
  const { names } = changeRow(p.data)
  if (names.kind === 'none') return null
  return (
    <span data-names={names.kind}>
      {names.kind === 'create' ? (
        <Trans t={t} i18nKey="history.names.create" values={{ en: names.en, ar: names.ar }} components={{ v: <bdi /> }} />
      ) : (
        <Trans
          t={t}
          i18nKey="history.names.rename"
          values={{ fromEn: names.fromEn, fromAr: names.fromAr, toEn: names.toEn, toAr: names.toAr }}
          components={{ v: <bdi /> }}
        />
      )}
    </span>
  )
}

export function buildHistoryColumns(t: TFunction): ColDef<ServingListChangeRow>[] {
  return [
    {
      headerName: t('history.columns.changedAt'),
      field: 'changedAt',
      width: 170,
      valueFormatter: ({ value }) => formatDateTime(value),
      cellRenderer: LtrCell,
      cellClass: 'font-mono text-[12px]',
    },
    { headerName: t('history.columns.changedBy'), field: 'changedBy', width: 140, tooltipField: 'changedBy' },
    {
      headerName: t('history.columns.action'),
      colId: 'action',
      width: 160,
      // The words, or the raw value of an action this screen does not know.
      valueGetter: (p) => {
        if (!p.data) return ''
        const view = changeRow(p.data)
        return view.actionKey ? t(view.actionKey) : view.action
      },
      cellClassRules: { 'font-mono text-[12px]': (p) => !!p.data && changeRow(p.data).actionKey === null },
    },
    {
      headerName: t('history.columns.storeCode'),
      colId: 'storeCode',
      width: 110,
      valueGetter: (p) => (p.data ? changeRow(p.data).storeCode : ''),
      cellRenderer: LtrCell,
      cellClass: 'font-mono text-[12px]',
    },
    {
      headerName: t('history.columns.names'),
      colId: 'names',
      flex: 1,
      minWidth: 260,
      autoHeight: true,
      wrapText: true,
      valueGetter: (p) => (p.data ? namesText(t, changeRow(p.data).names) : ''),
      cellRenderer: NamesCell,
    },
    { headerName: t('history.columns.note'), field: 'note', flex: 1, minWidth: 200, tooltipField: 'note' },
  ]
}
