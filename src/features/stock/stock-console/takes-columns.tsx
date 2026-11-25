import type { ColDef, ICellRendererParams } from 'ag-grid-community'
import type { TFunction } from 'i18next'
import { Trans } from 'react-i18next'
import { Link } from 'react-router'

import type { StockConsoleTakeRow } from '@/core/models/stock-console'
import Ltr from '@/core/ui/Ltr'
import LtrCell from '@/core/ui/LtrCell'
import StatusBadge from '@/core/ui/StatusBadge'
import { localizedName } from '@/core/util/localized-name'
import { formatFigure } from '@/core/util/number-format'
import { MONO, formatTime } from './columns'
import { rowKey } from './row-ids'
import { itemHref } from './items-columns'
import { fallbackNoteWord, takeCells, takeFallback, takeFallbackValue } from './takes'
import WordOrRaw from './WordOrRaw'

type Cell = ICellRendererParams<StockConsoleTakeRow>

/** One take door call per row. Module-level, as AG Grid wants. */
export const takeRowId = (row: StockConsoleTakeRow) => rowKey(row.takeId, row.at)

/**
 * The Takes grid's columns (oms 942, spec 4157 stories 40–42), each cell by the row's kind (`takeCells`, pure and
 * tested): time, kind, item, name, quantity, the batches taken (or the batch the door named), a refusal's reason and a
 * failure's status.
 */
export function buildTakesColumns(t: TFunction, language: string, store: string): ColDef<StockConsoleTakeRow>[] {
  return [
    { headerName: t('takes.column.at'), field: 'at', width: 140, cellClass: MONO, valueFormatter: formatTime, cellRenderer: LtrCell },
    {
      headerName: t('takes.column.kind'),
      field: 'kind',
      width: 110,
      cellRenderer: (p: Cell) => {
        if (!p.data) return null
        const { kind } = takeCells(p.data)
        return (
          <span data-take-kind={String(p.data.kind)}>
            <StatusBadge sev={kind.sev}><WordOrRaw word={kind} /></StatusBadge>
          </span>
        )
      },
    },
    {
      headerName: t('takes.column.item'),
      colId: 'item',
      width: 100,
      cellClass: MONO,
      cellRenderer: (p: Cell) => {
        const item = p.data ? takeCells(p.data).item : null
        return item ? (
          <Link to={itemHref(store, item)} className="font-medium text-primary underline-offset-2 hover:underline" data-item-link={item}>
            <Ltr>{item}</Ltr>
          </Link>
        ) : null
      },
    },
    {
      // Free text in either script: the base cell isolates it as `<bdi>`.
      headerName: t('takes.column.name'),
      colId: 'name',
      width: 200,
      valueGetter: (p) => {
        const names = p.data ? takeCells(p.data).names : null
        return names ? localizedName(names, language) : ''
      },
    },
    {
      headerName: t('takes.column.quantity'),
      colId: 'quantity',
      width: 90,
      type: 'numericColumn',
      valueGetter: (p) => (p.data ? formatFigure(takeCells(p.data).quantity) : ''),
      cellRenderer: LtrCell,
    },
    {
      headerName: t('takes.column.batches'),
      colId: 'batches',
      width: 200,
      // Each batch (with its quantity) is one value, isolated once; the list itself is not a range.
      cellRenderer: (p: Cell) => {
        const batches = p.data ? takeCells(p.data).batches : []
        return batches.length === 0 ? null : (
          <span className="inline-flex flex-wrap gap-1.5">
            {batches.map((b, i) => (
              <span key={`${b}-${i}`} className={MONO}>
                <Ltr>{b}</Ltr>
              </span>
            ))}
          </span>
        )
      },
    },
    {
      // BackOffice 4277: the pack's own (scanned) vendor batch, whatever the kind.
      headerName: t('takes.column.vendorBatch'),
      colId: 'vendorBatch',
      width: 130,
      cellClass: MONO,
      valueGetter: (p) => p.data?.scannedVendorBatch ?? '',
      cellRenderer: LtrCell,
    },
    {
      // BackOffice 4277 (spec 4275, ADR 0146): placed by the expiry fallback, would have been (a Record store), or why not.
      headerName: t('takes.column.fallback'),
      colId: 'fallback',
      width: 330,
      valueGetter: (p) => (p.data ? takeFallbackValue(p.data, (key) => t(key)) : ''),
      cellRenderer: (p: Cell) => {
        const cell = p.data ? takeFallback(p.data) : null
        if (!cell) return null
        return (
          <span className="inline-flex flex-wrap items-center gap-1.5" data-take-fallback={cell.key}>
            <StatusBadge sev={cell.sev}>{t(cell.key)}</StatusBadge>
            {cell.batches.map((b, i) => (
              <span key={`${b}-${i}`} className={MONO}>
                <Ltr>{b}</Ltr>
              </span>
            ))}
            {cell.note && (
              <span className="text-xs text-muted-foreground">
                <WordOrRaw word={fallbackNoteWord(cell.note)} />
              </span>
            )}
          </span>
        )
      },
    },
    {
      // Server text (or a code): the base cell isolates it as `<bdi>`.
      headerName: t('takes.column.reason'),
      colId: 'reason',
      width: 240,
      valueGetter: (p) => (p.data ? (takeCells(p.data).reason ?? '') : ''),
    },
    {
      headerName: t('takes.column.status'),
      colId: 'status',
      width: 170,
      cellRenderer: (p: Cell) => {
        const status = p.data ? takeCells(p.data).status : null
        if (!status) return null
        return status.ms === null ? (
          <Ltr>{formatFigure(status.code)}</Ltr>
        ) : (
          <Trans
            t={t}
            i18nKey="takes.status"
            values={{ code: formatFigure(status.code), ms: formatFigure(status.ms) }}
            components={{ c: <Ltr />, ms: <Ltr /> }}
          />
        )
      },
    },
  ]
}
