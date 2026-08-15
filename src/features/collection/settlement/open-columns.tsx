import type { ColDef, ICellRendererParams, ValueFormatterParams } from 'ag-grid-community'
import type { TFunction } from 'i18next'

import type { SettlementOpenLaneRow } from '@/core/models/settlement'
import { formatDay } from '@/core/util/date-format'
import { settlementMoney } from './money-display'

/**
 * The open settlements lane's columns (ticket 285) — **a row you can say out loud**.
 *
 * > entry 1611 · Riyadh 0611 · open 159 days, posted 9 March · 3,061.232 still open ·
 * > served by Ayed
 *
 * 🚩 **The order is the sentence's**, and it is the whole answer to the concern that a
 * chase list is read one row at a time while talking (spec 282 D11). What was
 * considered and refused was a bespoke list component in a feature that has five AG
 * Grid surfaces already; what it costs instead is a taller row and this column order.
 *
 * 🚩 **NOTHING COLOURS THE AGE.** No red, no badge, no *overdue* — the domain has not
 * ruled when an entry is late, and a colour is a ruling. The age is drawn in the same
 * ink as the entry number beside it, and `npm run lint`'s colour-literal gate is
 * load-bearing on this file for exactly that reason.
 *
 * ⚠️ **Two columns are drawn only when the wire earns them.** `ageDays` absent means
 * the Age cell says the posted date and nothing else, and `servedBy` absent removes
 * the column outright (`named`) — server dependency §6 is not built, and the
 * alternative to silence is 1,394 rows confidently reading *nobody assigned*.
 *
 * 🚩 Pure-ish: the words come in as `t`, the rows go in as data. No network, no
 * clock, and nothing here re-decides anything `open-lane.ts` decided.
 */
export function buildOpenColumns(
  t: TFunction,
  /** Did the answer carry `servedBy`? See the module docblock. */
  named: boolean,
): ColDef<SettlementOpenLaneRow>[] {
  return [
    {
      // The handle finance and the branch settle by on the phone — so it leads, and
      // it is monospaced so a column of them scans while dialling.
      headerName: t('open.columns.entryNumber'),
      field: 'entryNumber',
      colId: 'entryNumber',
      width: 96,
      filter: 'agNumberColumnFilter',
      cellClass: 'font-mono text-[12px]',
    },
    {
      // 🔑 Name AND code in one cell, as the prototype has it: the name is what an
      // accountant recognises and the code is what they quote. Two columns would put
      // a sortable boundary through the middle of one spoken phrase.
      headerName: t('open.columns.branch'),
      colId: 'branch',
      field: 'storeName',
      flex: 1,
      minWidth: 220,
      // The floating filter and the sort match what is ON SCREEN — the name, with the
      // code searchable after it.
      filterValueGetter: (p) => `${p.data?.storeName ?? ''} ${p.data?.storeId ?? ''}`,
      cellRenderer: (p: ICellRendererParams<SettlementOpenLaneRow>) =>
        p.data ? (
          <span className="flex items-baseline gap-1.5">
            <span className="font-medium">{p.data.storeName}</span>
            <span className="font-mono text-[11px] text-muted-foreground">{p.data.storeId}</span>
          </span>
        ) : null,
    },
    {
      /**
       * The age as a **fact**, with the date it is counted from underneath.
       *
       * 🔑 Sorted and filtered on `ageDays` — the SERVER's subtraction — while the
       * date beneath is the row's own `postedAt`, so the number and the date can
       * never tell an accountant two different stories on the phone (story 5).
       *
       * ⚠️ `0` reads *today* rather than *0 days*, because the newest rows have to
       * read like speech.
       */
      headerName: t('open.columns.age'),
      field: 'ageDays',
      colId: 'ageDays',
      width: 150,
      filter: 'agNumberColumnFilter',
      cellClass: 'tabular-nums',
      cellRenderer: (p: ICellRendererParams<SettlementOpenLaneRow, number>) =>
        p.data ? (
          <span className="flex flex-col justify-center leading-tight">
            {/* ⚠️ Absent is silent, never a guessed number — the clock is the
                server's (spec 282 D5) and this file owns none. */}
            {p.data.ageDays !== undefined && <span>{ageWords(t, p.data.ageDays)}</span>}
            <span className="text-[11px] text-muted-foreground">
              {t('open.age.posted', { date: formatDay(p.data.postedAt) })}
            </span>
          </span>
        ) : null,
    },
    {
      /**
       * What is **still open** — the figure the accountant is ringing about, not the
       * one that was posted.
       *
       * 🔑 The original rides beside it **only when the branch has part-paid**. The
       * prototype found that printing *"of 3,061.232"* next to `3,061.232` repeated
       * the same number on two rows in three — and the point of showing it at all is
       * that partial payment tells a branch that is engaging from one that is
       * ignoring you, which is a fact that must not be smuggled into the age.
       *
       * ⚠️ Minimum-2 / maximum-3 decimals through `settlementMoney`, and no column is
       * totalled anywhere on this screen: `currencyKey` is absent from these reads
       * (spec 282 D12), so a Σ would add riyals to dinars.
       */
      headerName: t('open.columns.remaining'),
      field: 'remainingAmount',
      colId: 'remainingAmount',
      width: 210,
      type: 'numericColumn',
      filter: 'agNumberColumnFilter',
      cellClass: 'text-end tabular-nums',
      valueFormatter: (p: ValueFormatterParams<SettlementOpenLaneRow, number>) =>
        settlementMoney(p.value, p.data?.currencyKey),
      cellRenderer: (p: ICellRendererParams<SettlementOpenLaneRow, number>) =>
        p.data ? (
          <span className="flex items-baseline justify-end gap-2">
            <span>{settlementMoney(p.data.remainingAmount, p.data.currencyKey)}</span>
            {p.data.remainingAmount < p.data.amount && (
              <span className="text-[11px] text-muted-foreground">
                {t('open.row.ofAmount', {
                  amount: settlementMoney(p.data.amount, p.data.currencyKey),
                })}
              </span>
            )}
          </span>
        ) : null,
    },
    {
      /**
       * Who to ring, on the row — so the row tells the accountant that without a
       * second lookup.
       *
       * 🚩 **A branch nobody serves says so in words.** 1,255 of 1,394 branches are
       * paired to nobody, and an empty cell there reads as missing data about the
       * branch rather than as a true fact about the estate.
       */
      headerName: t('open.columns.servedBy'),
      field: 'servedBy',
      colId: 'servedBy',
      width: 180,
      hide: !named,
      filterValueGetter: (p) => p.data?.servedBy || t('open.row.nobodyAssigned'),
      cellRenderer: (p: ICellRendererParams<SettlementOpenLaneRow, string>) =>
        p.data?.servedBy ? (
          <span>{p.data.servedBy}</span>
        ) : (
          <span className="italic text-muted-foreground">{t('open.row.nobodyAssigned')}</span>
        ),
    },
  ]
}

/**
 * The age, as speech.
 *
 * ⚠️ `0` is *today* and not *0 days* (story 6). The plural is i18next's, so the
 * Arabic retrofit — which has six plural forms and not two — stays a data change.
 */
export function ageWords(t: TFunction, ageDays: number): string {
  return ageDays === 0 ? t('open.age.today') : t('open.age.days', { count: ageDays })
}

/** The grid's row identity — the entry's own id, never the row index. */
export function openRowId(p: { data: SettlementOpenLaneRow }): string {
  return p.data.settlementEntryId
}
