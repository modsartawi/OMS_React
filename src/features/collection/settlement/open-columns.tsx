import type { ColDef, ICellRendererParams, ValueFormatterParams } from 'ag-grid-community'
import type { TFunction } from 'i18next'

import type {
  SettlementLastChase,
  SettlementOpenLaneRow,
  SettlementUncollectedRow,
} from '@/core/models/settlement'
import { formatDay } from '@/core/util/date-format'
import { settlementMoney } from './money-display'
import {
  chaseCell,
  chaseTargetForEntry,
  chaseTargetForReceipt,
  type ChaseCell,
  type ChaseTarget,
} from './open-lane'

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
  {
    named,
    chased,
    onChase,
  }: {
    /** Did the answer carry `servedBy`? See the module docblock. */
    named: boolean
    /** Did the answer carry a `lastChase` at all (ticket 287)? Absent means the column
     *  is not drawn — see `chaseColumn`. */
    chased: boolean
    onChase: (target: ChaseTarget) => void
  },
): ColDef<SettlementOpenLaneRow>[] {
  return [
    {
      // The handle finance and the branch settle by on the phone — so it leads, and
      // it is monospaced so a column of them scans while dialling.
      headerName: t('open.columns.entryNumber'),
      ...ENTRY_NUMBER_SHAPE,
    },
    {
      // 🔑 Name AND code in one cell, as the prototype has it: the name is what an
      // accountant recognises and the code is what they quote. Two columns would put
      // a sortable boundary through the middle of one spoken phrase.
      headerName: t('open.columns.branch'),
      ...BRANCH_SHAPE,
      // The floating filter and the sort match what is ON SCREEN — the name, with the
      // code searchable after it.
      filterValueGetter: (p) => `${p.data?.storeName ?? ''} ${p.data?.storeId ?? ''}`,
      cellRenderer: branchCell,
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
      ...AGE_SHAPE,
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
    // Last, because it is what the accountant writes rather than what they read out —
    // the spoken sentence ends at *served by Ayed*, and this is the note beside the
    // phone.
    ...chaseColumn<SettlementOpenLaneRow>(t, chased, (row) => onChase(chaseTargetForEntry(row))),
  ]
}

/* ── cash waiting ─────────────────────────────────────────────────────────────── */

/**
 * The **cash waiting** tab's columns (ticket 286) — a prepared special receipt nobody
 * has collected.
 *
 * 🔑 **Three substitutions and nothing else**, which is why this reads as a variation
 * on the columns above rather than a second grid:
 *
 * | | the entry tabs | here |
 * |---|---|---|
 * | the age is counted from | the entry was **posted** | the receipt was **prepared** |
 * | the money | what is **still open**, with *of X* when part-paid | the receipt's **whole amount**, and no *of* |
 * | the name | who **serves the branch** | the **collector** |
 *
 * 🚩 **The money substitution is a fact about receipts, not a formatting choice.** A
 * receipt is collected or it is not — there is no partial state, so there is nothing
 * for a *still open* figure to mean and no second number to put beside it. The wire
 * agrees: `SettlementUncollectedRow` carries no `remainingAmount` at all.
 *
 * 🚩 **And the name substitution is why this is a tab rather than a filter.** A
 * waiting receipt is a **visit that did not happen**, so the call goes to the
 * collector — a different person from the branch manager an unpaid shortage sends you
 * to, which is the whole reason the two lists are not one.
 *
 * ⚠️ No `named` flag, unlike the entry tabs: §2 is a whole door and either answers
 * with its fields or does not answer at all (spec 282, ticket 286's boundary).
 */
export function buildCashColumns(
  t: TFunction,
  {
    chased,
    onChase,
  }: { chased: boolean; onChase: (target: ChaseTarget) => void },
): ColDef<SettlementUncollectedRow>[] {
  return [
    {
      // 🔑 **The same handle the other two tabs quote** — the receipt is identified on
      // the phone the way everything else on this screen is, which is the whole reason
      // the door joins the entry to get it.
      headerName: t('open.columns.entryNumber'),
      ...ENTRY_NUMBER_SHAPE,
    },
    {
      headerName: t('open.columns.branch'),
      ...BRANCH_SHAPE,
      filterValueGetter: (p) => `${p.data?.storeName ?? ''} ${p.data?.storeId ?? ''}`,
      cellRenderer: branchCell,
    },
    {
      /**
       * ⚠️ **Counted from when the receipt was PREPARED**, and the line beneath says
       * so in that word. The consume happens at prepare, so that stamp is the moment
       * the money started waiting on a shelf — *"how long has this been waiting"* has
       * to mean what it says, and *posted* here would answer about the entry instead.
       */
      headerName: t('open.columns.age'),
      ...AGE_SHAPE,
      cellRenderer: (p: ICellRendererParams<SettlementUncollectedRow, number>) =>
        p.data ? (
          <span className="flex flex-col justify-center leading-tight">
            <span>{ageWords(t, p.data.ageDays)}</span>
            <span className="text-[11px] text-muted-foreground">
              {t('open.age.prepared', { date: formatDay(p.data.preparedAt) })}
            </span>
          </span>
        ) : null,
    },
    {
      /**
       * The receipt's **whole amount** — no *still open*, no *of X*.
       *
       * 🚩 Rendered by the formatter alone rather than by a cell of its own, because
       * there is genuinely one number here. The entry tabs' second figure exists to
       * tell a branch that is engaging from one that is ignoring you; a receipt cannot
       * be half-collected, so there is no such fact to show.
       */
      headerName: t('open.columns.amount'),
      field: 'amount',
      colId: 'amount',
      width: 210,
      type: 'numericColumn',
      filter: 'agNumberColumnFilter',
      cellClass: 'text-end tabular-nums',
      valueFormatter: (p: ValueFormatterParams<SettlementUncollectedRow, number>) =>
        settlementMoney(p.value, p.data?.currencyKey),
    },
    {
      /**
       * 🔑 **The collector — the person whose visit did not happen.** Not the branch
       * manager and not the accountant who posted the entry: ringing the branch about
       * a receipt they have already prepared is ringing the wrong person about the
       * wrong failure.
       *
       * 🚩 A receipt with nobody named says so **in words**, the same rule the entry
       * tabs' *nobody assigned* follows and for the same reason — an empty cell reads
       * as missing data rather than as a true fact.
       */
      headerName: t('open.columns.collector'),
      field: 'servedBy',
      colId: 'servedBy',
      width: 180,
      filterValueGetter: (p) => p.data?.servedBy || t('open.row.nobodyAssigned'),
      cellRenderer: (p: ICellRendererParams<SettlementUncollectedRow, string>) =>
        p.data?.servedBy ? (
          <span>{p.data.servedBy}</span>
        ) : (
          <span className="italic text-muted-foreground">{t('open.row.nobodyAssigned')}</span>
        ),
    },
    // 🔑 **A fourth substitution would have been wrong here.** The chase column is
    // byte-for-byte the entry tabs' — same table, same act, and the only thing that
    // differs is who was on the other end of the phone, which the column beside it
    // already says (contract 278 §1).
    ...chaseColumn<SettlementUncollectedRow>(t, chased, (row) =>
      onChase(chaseTargetForReceipt(row)),
    ),
  ]
}

/* ── the chase note's column (ticket 287) ─────────────────────────────────────── */

/**
 * ***Last chased*, and the button that adds to it** — one column, both lanes.
 *
 * 🚩 **An empty array when the answer never mentioned a chase, and that is the
 * ticket.** Not a hidden column, not a blank cell: the field is absent because server
 * dependency §7 is unbuilt, and a column drawn over it could only ever say *never
 * chased* — 1,394 times, confidently, and wrongly. Drawing nothing is silence; drawing
 * *never chased* is a false statement about the estate.
 *
 * 🔑 **The cell takes a `ChaseCell` and cannot produce a blank** — `unavailable` never
 * reaches it (the column is not built), `never` is a named state in words, and a note
 * renders over the name of whoever left it. That is 269's rule 1 one layer up.
 *
 * ⚠️ **The button stops the click from reaching the row.** Every row on this lane is a
 * way into the branch's account; *record a chase* is the one thing on it that is not,
 * because the point of the dialog is that a session of twenty calls does not become
 * twenty navigations.
 */
function chaseColumn<Row extends { lastChase?: SettlementLastChase | null }>(
  t: TFunction,
  chased: boolean,
  onChase: (row: Row) => void,
): ColDef<Row>[] {
  if (!chased) return []

  return [
    {
      headerName: t('open.columns.lastChase'),
      // ⚠️ No `field`: the cell is a CASE rather than a value, so the getter below is
      // the only honest reading of it.
      colId: 'lastChase',
      width: 240,
      // Sorted and filtered on what is READ — the note itself, with *never chased* as
      // its own sortable text rather than as a hole the sort drops to the bottom.
      filterValueGetter: (p) => chaseWords(t, chaseCell(p.data ?? {})),
      valueGetter: (p) => chaseWords(t, chaseCell(p.data ?? {})),
      cellRenderer: (p: ICellRendererParams<Row>) => {
        if (!p.data) return null
        const cell = chaseCell(p.data)
        return (
          <span className="flex items-center justify-between gap-2">
            {cell.kind === 'chased' ? (
              <span className="flex flex-col justify-center leading-tight">
                <span>{t('open.chase.line', { date: formatDay(cell.at), note: cell.note })}</span>
                <span className="text-[11px] text-muted-foreground">{cell.by}</span>
              </span>
            ) : (
              // 🚩 A named state, in words — never an empty cell, which reads as
              // missing data about the branch rather than as a true fact about it.
              <span className="italic text-muted-foreground">{t('open.row.neverChased')}</span>
            )}
            <button
              type="button"
              /**
               * 🚩 **The marker the row's own click handler looks for, and it is load-
               * bearing.** `stopPropagation` in here does NOT stop the navigation: AG
               * Grid listens on the row element, which is closer to the target than
               * React's delegated root listener, so the grid has already navigated by
               * the time this handler runs. Driven, not reasoned about — the first
               * drive of this button landed on the branch account.
               */
              data-row-action="chase"
              data-testid="open-chase-button"
              onClick={() => onChase(p.data!)}
              className="shrink-0 rounded-full border border-border/60 px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
            >
              {t('open.row.recordChase')}
            </button>
          </span>
        )
      },
    },
  ]
}

/**
 * The cell as text — what the sort, the filter and any export read.
 *
 * ⚠️ **Interpolated, not concatenated**, because a reader sees this: it is what the
 * column's filter matches against and what a copied cell yields, so `note + ' ' + by`
 * would be a user-visible sentence assembled in code (`i18n-zero-literal`).
 * `unavailable` cannot occur in a drawn column and answers the empty string rather than
 * inventing a sentence about a door that is not there.
 */
function chaseWords(t: TFunction, cell: ChaseCell): string {
  if (cell.kind === 'chased') return t('open.chase.cell', { note: cell.note, by: cell.by })
  return cell.kind === 'never' ? t('open.row.neverChased') : ''
}

/* ── what the two tabs share, spelled once ────────────────────────────────────── */

/**
 * 🚩 **Shared as SHAPES rather than as whole columns**, because the headers are the
 * one thing that must be re-decided per tab: *Still open* and *Amount* are two claims
 * about money, and a column builder that shared them would be the place the third tab
 * quietly started saying the second one about the first thing.
 *
 * The entry number and the branch are byte-for-byte the same on all three tabs — the
 * handle and the branch behind it do not change with what is being chased.
 */
const ENTRY_NUMBER_SHAPE = {
  field: 'entryNumber',
  colId: 'entryNumber',
  width: 96,
  filter: 'agNumberColumnFilter',
  cellClass: 'font-mono text-[12px]',
} as const

const BRANCH_SHAPE = {
  colId: 'branch',
  field: 'storeName',
  flex: 1,
  minWidth: 220,
} as const

/** Sorted and filtered on `ageDays` — the SERVER's subtraction — whatever the date
 *  beneath it is counted from. */
const AGE_SHAPE = {
  field: 'ageDays',
  colId: 'ageDays',
  width: 150,
  filter: 'agNumberColumnFilter',
  cellClass: 'tabular-nums',
} as const

/** Name AND code in one cell. Shared by every tab: it is the same branch. */
function branchCell(p: ICellRendererParams<{ storeName: string; storeId: string }>) {
  return p.data ? (
    <span className="flex items-baseline gap-1.5">
      <span className="font-medium">{p.data.storeName}</span>
      <span className="font-mono text-[11px] text-muted-foreground">{p.data.storeId}</span>
    </span>
  ) : null
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

/**
 * The cash tab's row identity — the **consumption**'s id.
 *
 * ⚠️ Not the entry number, which is what the row *quotes*: one entry can have more
 * than one receipt prepared against it, and two rows sharing a `getRowId` is how a
 * grid starts drawing one of them twice.
 */
export function cashRowId(p: { data: SettlementUncollectedRow }): string {
  return p.data.settlementConsumptionId
}
