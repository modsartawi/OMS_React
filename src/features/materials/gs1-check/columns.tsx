import type { ReactNode } from 'react'
import type { ColDef, ICellRendererParams, ValueFormatterParams, ValueGetterParams } from 'ag-grid-community'
import type { TFunction } from 'i18next'
import { ChevronDown, ChevronRight, Info } from 'lucide-react'
import type { Gs1CheckAnswer } from '@/core/models/materials'
import { pinStart } from '@/core/theme/direction'
import StatusBadge from '@/core/ui/StatusBadge'
import { historyRequest } from './history-on-demand'
import { visibleScan } from './scan-buffer'
import {
  batchView,
  isDuplicate,
  issueCategoryKey,
  materialReasonView,
  showsSyncNote,
  statusView,
  wellFormedView,
  type VerdictView,
} from './verdict-view'

/** One row of the scan list: a scan, and the server's answer once it has come. */
export interface ScanRow {
  id: number
  /** The raw scan, byte for byte. */
  code: string
  /** The list's own flag: the same code was already in the list. */
  listDuplicate: boolean
  answer: Gs1CheckAnswer | null
  /** Its batch failed: it has no answer and is not being checked. */
  failed: boolean
}

/** What the grid's cells read from the page through AG Grid's `context`. */
export interface ScanGridContext {
  expandedId: number | null
  toggle: (id: number) => void
}

/** The column the export leaves out: the expand button holds no value. */
export const EXPAND_COL_ID = 'expand'

/** Identities the export writes as text, so Excel never totals one or strips its leading zeros. */
export const EXPORT_AS_TEXT: ReadonlySet<string> = new Set(['code', 'materialNumber', 'lot', 'serial'])

type Row = ScanRow

/** A verdict cell: a badge on screen; the label alone in the export (through `valueFormatter`). */
function badgeColumn(
  t: TFunction,
  colId: string,
  width: number,
  view: (answer: Gs1CheckAnswer) => VerdictView | null,
  after?: (answer: Gs1CheckAnswer) => ReactNode,
): ColDef<Row> {
  const label = (row: Row | undefined) => {
    if (!row?.answer) return ''
    const v = view(row.answer)
    return v ? t(v.key) : ''
  }
  return {
    colId,
    headerName: t(`columns.${colId}`),
    width,
    valueGetter: ({ data }: ValueGetterParams<Row>) => label(data),
    cellRenderer: ({ data }: ICellRendererParams<Row>) => {
      if (!data?.answer) return null
      const v = view(data.answer)
      if (!v) return null
      return (
        <span className="inline-flex items-center gap-1" data-verdict={colId} data-sev={v.sev}>
          <StatusBadge sev={v.sev}>{t(v.key)}</StatusBadge>
          {after?.(data.answer)}
        </span>
      )
    },
  }
}

/**
 * The scan list (ticket 454, spec 2544 stories 41–43): one row per scan — code, duplicate flag,
 * material, lot, serial, expiry, well-formed, issues, batch, status and history count — with a
 * first column that opens the unit's history under the grid.
 *
 * Every plain cell is isolated by the core grid base (`<bdi>`, dir auto). A badge column renders
 * its label as a child and exports the same label as text.
 */
export function scanColumns(t: TFunction, language: string): ColDef<Row>[] {
  const code = 'font-mono text-[12px]'
  const list = new Intl.ListFormat(language, { type: 'unit' })
  const parse = (row: Row | undefined) => row?.answer?.parse ?? null

  return [
    {
      colId: EXPAND_COL_ID,
      headerName: t('columns.expand'),
      width: 76,
      pinned: pinStart,
      sortable: false,
      filter: false,
      cellRenderer: ({ data, context }: ICellRendererParams<Row, unknown, ScanGridContext>) => {
        if (!data?.answer) return null
        const can = historyRequest(data.answer) !== null
        const open = context.expandedId === data.id
        const label = !can ? t('grid.noHistory') : open ? t('grid.collapse') : t('grid.expand')
        return (
          <button
            type="button"
            disabled={!can}
            onClick={() => context.toggle(data.id)}
            aria-expanded={can ? open : undefined}
            aria-label={label}
            title={label}
            className="inline-flex items-center rounded-md p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent"
            data-expand={data.id}
          >
            {/* Logical: rtl:rotate-180 mirrors the closed chevron with the text direction. */}
            {open ? <ChevronDown className="h-4 w-4" aria-hidden /> : <ChevronRight className="h-4 w-4 rtl:rotate-180" aria-hidden />}
          </button>
        )
      },
    },
    {
      colId: 'code',
      headerName: t('columns.code'),
      width: 300,
      cellClass: code,
      valueGetter: ({ data }: ValueGetterParams<Row>) => data?.code ?? '',
      // The GS character is invisible on screen and illegal in the xlsx: shown — and exported — as
      // `<GS>`. The row's own data keeps the raw scan.
      valueFormatter: ({ value }: ValueFormatterParams<Row, string>) => visibleScan(value ?? ''),
      tooltipValueGetter: ({ data }) => (data ? visibleScan(data.code) : ''),
    },
    {
      colId: 'duplicate',
      headerName: t('columns.duplicate'),
      width: 110,
      valueGetter: ({ data }: ValueGetterParams<Row>) => (data && isDuplicate(data.listDuplicate, data.answer) ? t('badges.duplicate') : ''),
      cellRenderer: ({ data }: ICellRendererParams<Row>) =>
        data && isDuplicate(data.listDuplicate, data.answer) ? (
          <span data-duplicate="">
            <StatusBadge sev="warn">{t('badges.duplicate')}</StatusBadge>
          </span>
        ) : null,
    },
    {
      colId: 'materialNumber',
      headerName: t('columns.materialNumber'),
      width: 190,
      // The material number; with none, the reason why (as text in the export too).
      valueGetter: ({ data }: ValueGetterParams<Row>) => {
        const a = data?.answer
        if (!a) return data?.failed ? t('grid.notChecked') : t('grid.pending')
        if (a.material) return a.material.materialNumber
        return a.materialReason ? t(materialReasonView(a.materialReason).key) : ''
      },
      cellClass: ({ data }) => (data?.answer?.material ? code : undefined),
    },
    { colId: 'description', headerName: t('columns.description'), width: 220, valueGetter: ({ data }) => data?.answer?.material?.description ?? '' },
    { colId: 'description2', headerName: t('columns.description2'), width: 200, valueGetter: ({ data }) => data?.answer?.material?.description2 ?? '' },
    { colId: 'lot', headerName: t('columns.lot'), width: 100, cellClass: code, valueGetter: ({ data }) => parse(data)?.lot ?? '' },
    { colId: 'serial', headerName: t('columns.serial'), width: 130, cellClass: code, valueGetter: ({ data }) => parse(data)?.serial ?? '' },
    // `yyyy-MM-dd` as sent — a day, never turned into an instant.
    { colId: 'expiry', headerName: t('columns.expiry'), width: 110, cellClass: 'tabular-nums', valueGetter: ({ data }) => parse(data)?.expiry ?? '' },
    badgeColumn(t, 'wellFormed', 140, (a) => wellFormedView(a.parse.valid)),
    {
      colId: 'issues',
      headerName: t('columns.issues'),
      width: 200,
      valueGetter: ({ data }: ValueGetterParams<Row>) =>
        list.format([...new Set((parse(data)?.issues ?? []).map((i) => t(issueCategoryKey(i.category))))]),
      tooltipValueGetter: ({ data }) => (parse(data)?.issues ?? []).map((i) => i.message).join('\n'),
    },
    badgeColumn(t, 'batch', 140, (a) => batchView(a.batch)),
    badgeColumn(
      t,
      'status',
      140,
      (a) => statusView(a.status),
      // "History only covers invoices already synced to HQ" — beside every SELLABLE verdict.
      (a) =>
        showsSyncNote(a.status) ? (
          <span title={t('card.syncNote')} aria-label={t('card.syncNote')} className="text-muted-foreground" data-sync-note="">
            <Info className="h-3.5 w-3.5" aria-hidden />
          </span>
        ) : null,
    ),
    {
      colId: 'historyCount',
      headerName: t('columns.historyCount'),
      width: 100,
      type: 'numericColumn',
      cellClass: 'text-end tabular-nums',
      valueGetter: ({ data }: ValueGetterParams<Row>) => data?.answer?.historyCount ?? null,
    },
  ]
}
