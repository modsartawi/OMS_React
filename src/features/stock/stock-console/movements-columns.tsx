import type { ColDef, ICellRendererParams } from 'ag-grid-community'
import type { TFunction } from 'i18next'

import type { StockConsoleLedgerLine } from '@/core/models/stock-console'
import Ltr from '@/core/ui/Ltr'
import LtrCell from '@/core/ui/LtrCell'
import StatusBadge from '@/core/ui/StatusBadge'
import { MONO, formatQuantity, formatTime } from './columns'
import { feedCell, ledgerDocument, ledgerEffects, type EffectCell } from './movements'

type Cell = ICellRendererParams<StockConsoleLedgerLine>

/** A ledger line is its ledger id. */
export const ledgerRowId = (row: StockConsoleLedgerLine) => row.id

/** A counter's effect: the signed figure isolated as a machine value, or a quiet dash for none. */
function Effect({ cell, t }: { cell: EffectCell; t: TFunction }) {
  return cell.kind === 'moves' ? (
    <Ltr>{cell.text}</Ltr>
  ) : (
    <span className="text-muted-foreground" data-no-effect="">
      {t('movements.noEffect')}
    </span>
  )
}

/**
 * The item's ledger lines (oms 945, spec 4157 story 60), newest first: time, feed (SAP or till), movement type, quantity,
 * batch, the document it came from, and its effect on each counter. A line not applied yet says so beside its document.
 */
export function buildLedgerColumns(t: TFunction): ColDef<StockConsoleLedgerLine>[] {
  return [
    {
      headerName: t('movements.column.at'),
      field: 'at',
      width: 140,
      cellClass: MONO,
      valueFormatter: formatTime,
      cellRenderer: LtrCell,
    },
    {
      headerName: t('movements.column.feed'),
      field: 'feed',
      width: 90,
      cellRenderer: (p: Cell) => {
        if (!p.data) return null
        const cell = feedCell(p.data.feed)
        return <span data-ledger-feed={p.data.feed}>{'key' in cell ? t(cell.key) : <bdi>{cell.raw}</bdi>}</span>
      },
    },
    { headerName: t('movements.column.movementType'), field: 'movementType', width: 120, cellClass: MONO, cellRenderer: LtrCell },
    {
      headerName: t('movements.column.quantity'),
      field: 'quantity',
      width: 100,
      type: 'numericColumn',
      valueFormatter: formatQuantity,
      cellRenderer: LtrCell,
    },
    { headerName: t('movements.column.batch'), field: 'batch', width: 120, cellClass: MONO, cellRenderer: LtrCell },
    {
      headerName: t('movements.column.document'),
      colId: 'document',
      width: 240,
      cellRenderer: (p: Cell) => {
        if (!p.data) return null
        const doc = ledgerDocument(p.data)
        return (
          <span className="inline-flex items-center gap-1.5">
            {doc && (
              <span className={MONO}>
                <Ltr>{doc}</Ltr>
              </span>
            )}
            {!p.data.applied && (
              <span data-not-applied="">
                <StatusBadge sev="warn">{t('movements.notApplied')}</StatusBadge>
              </span>
            )}
          </span>
        )
      },
    },
    {
      headerName: t('movements.column.onSap'),
      colId: 'onSap',
      width: 150,
      type: 'numericColumn',
      cellRenderer: (p: Cell) => (p.data ? <Effect cell={ledgerEffects(p.data).onSap} t={t} /> : null),
    },
    {
      headerName: t('movements.column.onTill'),
      colId: 'onTill',
      width: 170,
      type: 'numericColumn',
      cellRenderer: (p: Cell) => (p.data ? <Effect cell={ledgerEffects(p.data).onTill} t={t} /> : null),
    },
  ]
}
