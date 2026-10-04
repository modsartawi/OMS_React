import { useTranslation } from 'react-i18next'
import type { ColDef, ICellRendererParams, ValueFormatterParams } from 'ag-grid-community'
import type { TFunction } from 'i18next'
import { Check, X } from 'lucide-react'

import { formatDateTime } from '@/core/util/date-format'
import ChangeFromTo from './ChangeFromTo'
import type { ChangeQueueRow } from './change-queue'
import type { ChangeRefusal } from './change-refusal'
import { entryKindLabel } from './entry-cells'
import { settlementMoney } from './money-display'

/**
 * The **Change requests** tab's columns (ticket 353, story 19) — one waiting request per
 * row: branch, entry number, kind, old → new (only what differs), the entry today,
 * requester and time, and the Reason — then **Approve** / **Reject**, decided inline.
 *
 * 🔑 **What is asked is drawn by `ChangeFromTo`**, the waiting card's own renderer, so the
 * queue and the entry panel cannot draw one request two ways. Each figure is at the
 * branch's own scale (`currencyKey`, 2285) — BHD keeps its third decimal.
 *
 * 🔑 **A refused approve stays on its row, with its refusal said there** (story 20) — 344's
 * sentence and its step, in the Decision cell under the buttons. That cell, *What is
 * asked* and the Reason size the row (`autoHeight`), so a refusal, a three-field change or
 * a long Reason is never cut — and the widths add up to one screen, so Reject never
 * scrolls off its edge.
 *
 * 🚩 `data-row-action` on every button is load-bearing: a row click opens the entry's
 * branch account, and AG Grid's row listener is nearer the target than React's (287's
 * finding) — `ChangeQueue`'s row handler looks for the marker.
 */
export function buildChangeQueueColumns(
  t: TFunction,
  {
    busy,
    refusals,
    onApprove,
    onReject,
  }: {
    /** An act is in flight — every Approve / Reject is held until it answers. */
    busy: boolean
    /** The refusal last answered for a request, by its id. */
    refusals: ReadonlyMap<string, ChangeRefusal>
    onApprove: (row: ChangeQueueRow) => void
    onReject: (row: ChangeQueueRow) => void
  },
): ColDef<ChangeQueueRow>[] {
  const money = (row: ChangeQueueRow | undefined) => (v: number | null | undefined) =>
    settlementMoney(v, row?.currencyKey)

  return [
    {
      headerName: t('open.changes.columns.entryNumber'),
      field: 'entryNumber',
      colId: 'entryNumber',
      width: 90,
      filter: 'agNumberColumnFilter',
      cellRenderer: (p: ICellRendererParams<ChangeQueueRow, number | null>) =>
        !p.data ? null : p.data.entryNumber === null ? (
          <span className="whitespace-normal italic leading-tight text-muted-foreground">{t('open.changes.entryMissing')}</span>
        ) : (
          <span className="font-mono tabular-nums">{p.data.entryNumber}</span>
        ),
    },
    {
      headerName: t('open.changes.columns.branch'),
      colId: 'branch',
      field: 'storeName',
      flex: 1,
      minWidth: 160,
      filterValueGetter: (p) => `${p.data?.storeName ?? ''} ${p.data?.storeId ?? ''}`,
      cellRenderer: (p: ICellRendererParams<ChangeQueueRow>) =>
        p.data ? (
          <span className="flex flex-col justify-center leading-tight">
            {/* The Store master's name — routinely Arabic, so on its own direction. */}
            <span className="font-medium" dir="auto">
              {p.data.storeName}
            </span>
            <span className="font-mono text-[11px] text-muted-foreground">{p.data.storeId}</span>
          </span>
        ) : null,
    },
    {
      headerName: t('open.changes.columns.request'),
      colId: 'kind',
      width: 120,
      // Sorted and filtered on what is ON SCREEN — the label, not the wire's enum.
      valueGetter: (p) => (p.data ? t(`open.changes.kind.${p.data.kind}`) : ''),
      cellRenderer: (p: ICellRendererParams<ChangeQueueRow>) =>
        p.data ? (
          <span className="flex flex-col justify-center leading-tight" data-request-kind={p.data.kind}>
            <span className="font-medium">{t(`open.changes.kind.${p.data.kind}`)}</span>
            {p.data.entryKind && (
              <span className="text-[11px] text-muted-foreground">{entryKindLabel(t, p.data.entryKind)}</span>
            )}
          </span>
        ) : null,
    },
    {
      headerName: t('open.changes.columns.asked'),
      colId: 'asked',
      flex: 1.4,
      minWidth: 200,
      autoHeight: true,
      sortable: false,
      filter: false,
      cellRenderer: (p: ICellRendererParams<ChangeQueueRow>) =>
        p.data ? (
          <div className="flex min-h-[44px] flex-col justify-center gap-0.5 py-1.5 leading-snug" data-testid="change-queue-asked">
            <AskedLines row={p.data} />
          </div>
        ) : null,
    },
    {
      // 🔑 The entry NOW (2285's committed reads) — what the supervisor decides against —
      // never the figure at the request, which *What is asked* already shows.
      headerName: t('open.changes.columns.today'),
      colId: 'today',
      width: 140,
      type: 'numericColumn',
      filter: 'agNumberColumnFilter',
      valueGetter: (p) => p.data?.now?.amount ?? null,
      valueFormatter: (p: ValueFormatterParams<ChangeQueueRow, number | null>) => money(p.data)(p.value),
      cellRenderer: (p: ICellRendererParams<ChangeQueueRow>) => {
        const row = p.data
        if (!row) return null
        if (!row.now)
          return (
            <span className="block whitespace-normal text-end italic leading-tight text-muted-foreground">
              {t('open.changes.todayMissing')}
            </span>
          )
        return (
          <span className="flex flex-col items-end justify-center leading-tight tabular-nums" data-testid="change-queue-today">
            <span>{t('open.changes.today', { amount: money(row)(row.now.amount) })}</span>
            <span className="text-[11px] text-muted-foreground" data-testid="change-queue-spent">
              {t('open.changes.spent', { spent: money(row)(row.now.spentAmount) })}
            </span>
          </span>
        )
      },
    },
    {
      headerName: t('open.changes.columns.askedBy'),
      colId: 'askedBy',
      field: 'by',
      width: 160,
      cellRenderer: (p: ICellRendererParams<ChangeQueueRow>) =>
        p.data ? (
          <span className="flex flex-col justify-center leading-tight">
            <span dir="auto">{p.data.by}</span>
            <span className="text-[11px] tabular-nums text-muted-foreground">
              {p.data.at ? formatDateTime(p.data.at) : t('open.changes.noAt')}
            </span>
          </span>
        ) : null,
    },
    {
      // Server text, routinely Arabic — on its own direction.
      headerName: t('open.changes.columns.reason'),
      colId: 'reason',
      field: 'reason',
      flex: 1,
      minWidth: 140,
      // Up to 200 characters — wrapped whole rather than cut, so the row grows with it.
      autoHeight: true,
      cellRenderer: (p: ICellRendererParams<ChangeQueueRow>) =>
        p.data ? (
          <div className="flex min-h-[44px] items-center py-1.5 leading-snug">
            <span dir="auto" className="whitespace-normal" data-testid="change-queue-reason">
              {p.data.reason || t('changeRequest.card.noReason')}
            </span>
          </div>
        ) : null,
    },
    {
      headerName: t('open.changes.columns.decide'),
      colId: 'decide',
      flex: 1.2,
      minWidth: 240,
      autoHeight: true,
      sortable: false,
      filter: false,
      cellRenderer: (p: ICellRendererParams<ChangeQueueRow>) => {
        const row = p.data
        if (!row) return null
        const refusal = refusals.get(row.changeRequestId) ?? null
        return (
          <div className="flex min-h-[44px] flex-col justify-center gap-1 py-1.5">
            <span className="flex items-center gap-1.5">
              <button
                type="button"
                data-row-action="approve"
                data-testid="change-queue-approve"
                aria-disabled={busy || undefined}
                onClick={() => !busy && onApprove(row)}
                className="inline-flex shrink-0 items-center gap-1 rounded-full border border-primary/40 px-2.5 py-1 text-[11px] font-medium text-primary transition-colors hover:bg-primary/10 aria-disabled:opacity-50"
              >
                <Check className="h-3 w-3" aria-hidden />
                {t('changeRequest.card.approve')}
              </button>
              <button
                type="button"
                data-row-action="reject"
                data-testid="change-queue-reject"
                aria-disabled={busy || undefined}
                onClick={() => !busy && onReject(row)}
                className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border/60 px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary aria-disabled:opacity-50"
              >
                <X className="h-3 w-3" aria-hidden />
                {t('changeRequest.card.reject')}
              </button>
            </span>
            {refusal && (
              <span
                role="status"
                data-testid="change-queue-refusal"
                data-code={refusal.code}
                data-step={refusal.step.kind}
                className="whitespace-normal text-[11px] leading-snug text-attention-800"
              >
                {refusalWords(t, refusal, row)}
                {/* 346's way on: the request is still waiting, and Reject is the way. */}
                {refusal.step.kind === 'reject' && <span className="block">{t('changeRequest.step.reject')}</span>}
              </span>
            )}
          </div>
        )
      },
    },
  ]
}

/**
 * **What a queue request asks, one line per field** — the Asked cell and the Reject dialog
 * draw it through this one component: a `DELETE` is said by its kind, a change by
 * `ChangeFromTo` (the waiting card's renderer) at the branch's own scale.
 */
export function AskedLines({ row }: { row: ChangeQueueRow }) {
  const { t } = useTranslation('settlement')
  if (row.kind === 'DELETE') return <span>{t('open.changes.deleteAsk')}</span>
  if (row.changes.length === 0) return <span className="text-muted-foreground">{t('open.changes.nothingDiffers')}</span>
  const money = (v: number | null | undefined) => settlementMoney(v, row.currencyKey)
  return (
    <>
      {row.changes.map((c) => (
        <span key={c.field} className="whitespace-normal" data-field={c.field}>
          <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
            {t(`changeRequest.card.field.${c.field}`)}
          </span>{' '}
          <span className={c.field === 'amount' ? 'tabular-nums' : undefined}>
            <ChangeFromTo change={c} money={money} />
          </span>
        </span>
      ))}
    </>
  )
}

/** The entry number to say in a sentence — a missing entry's is the key's em-dash, never a literal. */
export function entryNumberWords(t: TFunction, row: Pick<ChangeQueueRow, 'entryNumber'>): string | number {
  return row.entryNumber ?? t('open.changes.noNumber')
}

/**
 * 344's sentence for a refused act on a queue row — the map's key, or (only for a code
 * the map does not know) the server's own words; the figures at the branch's scale.
 */
export function refusalWords(t: TFunction, refusal: ChangeRefusal, row: ChangeQueueRow): string {
  if (refusal.words.kind === 'message') return refusal.words.text
  return t(`changeRequest.refusal.${refusal.words.key}`, {
    number: entryNumberWords(t, row),
    spent: settlementMoney(refusal.spent, row.currencyKey),
    code: refusal.code,
  })
}

/** The grid's row identity — the request's ULID, never the row index or the entry. */
export function changeQueueRowId(p: { data: ChangeQueueRow }): string {
  return p.data.changeRequestId
}
