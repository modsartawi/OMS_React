import type { ColDef, ValueFormatterParams } from 'ag-grid-community'
import type { TFunction } from 'i18next'

import type { SettlementEntry } from '@/core/models/settlement'
import { formatDateTime, formatDay } from '@/core/util/date-format'
import { remainingIsAClaim } from './account-projection'
import { isStamped, type DayVariance } from './approval'
import { settlementMoney } from './money-display'

/**
 * The cells a settlement entry draws the same way **wherever it is drawn** — the
 * branch account's grid (269) and the cross-estate ledger's (270).
 *
 * Extracted at `/standards-review`'s third duplication: seven of the ledger's nine
 * columns were the account's, including both `valueFormatter`/`filterValueGetter`
 * pairs and the cancelled-remaining refusal. Two grids agreeing about an entry by
 * coincidence is exactly the shape that drifts — and the thing they would drift on
 * is what a status *means*, which is the one thing a branch will ask about.
 *
 * 🔑 Three rules ride in here, and each is a rule the pair must not disagree on:
 *
 * 1. **The kind and the status carry their Arabic beside the English** (D9) — عجز and
 *    فائض are domain vocabulary, not a translation, and they are what the branch's
 *    own till screen says.
 * 2. **The floating filter matches what is on screen, not the wire's enum.** A reader
 *    typing *Cancelled* into the filter row is typing what the cell says.
 * 3. 🚩 **A `CANCELLED` entry draws no Remaining**, though the wire still carries its
 *    full figure (269's finding, 0688/147). Drawing it would claim a branch owes
 *    money the headline has already refused to count. ⚠️ Ticket 309 adds the two
 *    approval states to the rule: a `PENDING_APPROVAL` surplus is not live yet and a
 *    `REJECTED` one never will be, so neither remaining is a claim on anybody. ⚠️ And
 *    ticket 339 adds a **theft in any status** — nothing consumes one.
 *
 * 🚩 Pure: the words come in as `t`, the row goes in as data. No React, no network.
 */

/** What a kind reads as — *"Shortage · عجز"*. Rule 1. */
export const entryKindLabel = (t: TFunction, kind: string | null | undefined): string =>
  kind ? t(`account.kind.${kind}`) : ''

/** What a status reads as. `CLOSED_OUT` says **written off** rather than consumed —
 *  a different fact about where the money went, and the one the branch will ask
 *  about. */
export const entryStatusLabel = (t: TFunction, status: string | null | undefined): string =>
  status ? t(`account.status.${status}`) : ''

/**
 * What the **Remaining** column draws — rule 3, in the one place both grids read it.
 *
 * The em dash rather than a blank: a cell with nothing in it reads as *not loaded*,
 * and this one is a deliberate refusal to state a figure.
 */
export function remainingCell(
  entry: Pick<SettlementEntry, 'status' | 'entryKind'> | null | undefined,
  value: number | null | undefined,
  currencyKey: string | null | undefined,
): string {
  if (!entry || !remainingIsAClaim(entry.status, entry.entryKind)) return '—'
  return value === null || value === undefined ? '—' : settlementMoney(value, currencyKey)
}

/**
 * The **business day a theft names** (ticket 339, BackOffice 2150) — and nothing for
 * the other kinds.
 *
 * ⚠️ `''` rather than a date for a shortage or a surplus: the wire carries
 * `0001-01-01T00:00:00` on them (the column is `NOT NULL`), and drawing that would put
 * *1 January 0001* beside every entry that names no day. `isStamped` is the one reading
 * of that default on this screen.
 */
export function businessDayCell(
  entry: Pick<SettlementEntry, 'entryKind' | 'businessDay'> | null | undefined,
): string {
  return entry?.entryKind === 'THEFT' && isStamped(entry.businessDay) ? formatDay(entry.businessDay) : ''
}

/**
 * **Whether a change request waits on this entry** — the *change waiting* mark (ticket
 * 351, spec 342 W10), drawn by the Ledger grid and the open-settlement lanes alike.
 *
 * 🔑 The wire's own answer and nothing else: `openChangeRequestId` names the waiting
 * request, `''` says none (BackOffice 2191). No status, figure or History read stands in
 * for it — the mark says only that one is waiting; the panel says what.
 *
 * ⚠️ Absent reads as `''`: an SIS.Api older than the wave does not send the field, and
 * must mark nothing rather than fail.
 */
export function hasChangeWaiting(
  row: { openChangeRequestId?: string } | null | undefined,
): boolean {
  return !!row?.openChangeRequestId
}

/**
 * **What a theft's day came to, as a sentence** — *"3,000.00 short — 500.00 counted
 * against 3,500.00 of system cash"* (ticket 339).
 *
 * 🔑 One spelling, read by the approval dialog and the Theft tab, so the two cannot
 * describe one day two ways. `null` when the figures were not stated — what to say
 * about THAT differs by where it is asked (still reading, could not read, not sent), so
 * it is the caller's sentence.
 */
export function dayVarianceWords(
  t: TFunction,
  day: DayVariance,
  currencyKey: string | null | undefined,
): string | null {
  if (day.kind !== 'stated') return null
  return t(`approval.theft.${day.direction}`, {
    amount: settlementMoney(day.magnitude, currencyKey),
    counted: settlementMoney(day.countedCash, currencyKey),
    system: settlementMoney(day.systemCash, currencyKey),
  })
}

/**
 * **Approved by** (spec 2423, ticket 426) — who let the entry go live: the name the
 * server stamped at the decision, falling back to the **staff id** when the name is
 * blank (an entry approved before BackOffice 2430, which back-fills nothing) or absent
 * (an older SIS.Api).
 *
 * ⚠️ **Blank, not a dash, on an entry nobody approved** — most entries never waited,
 * and a column of dashes would read as *something is missing*. A supervisor's own
 * large surplus names its poster, as the server stamped it.
 */
export function approvedByCell(
  entry: Pick<SettlementEntry, 'approvedByStaffId' | 'approvedByName' | 'approvedAt'> | null | undefined,
): string {
  // ⚠️ Gated on the STAMP, as Approved at and the audit pane's fact are — the three
  // must never disagree about whether an entry was approved.
  if (!entry || !isStamped(entry.approvedAt)) return ''
  return approverName(entry) || (entry.approvedByStaffId ?? '').trim()
}

/** The approver's stamped name, trimmed — `''` when none was stamped. The ONE reading
 *  of it: the grids (`approvedByCell`) and the audit pane both take it from here. */
export const approverName = (entry: Pick<SettlementEntry, 'approvedByName'>): string =>
  (entry.approvedByName ?? '').trim()

/**
 * **Approved at** — the decision's local wall clock, formatted like *Posted at*. Blank
 * when the server did not stamp it: an unapproved entry carries `0001-01-01T00:00:00`
 * (a `NOT NULL` column's default), which would otherwise draw as a date in year 1.
 */
export function approvedAtCell(
  entry: Pick<SettlementEntry, 'approvedAt'> | null | undefined,
): string {
  return entry && isStamped(entry.approvedAt) ? formatDateTime(entry.approvedAt) : ''
}

/**
 * **Approved by → Approved at** (spec 2423, ticket 426) — the two columns both grids
 * draw after Posted at, defined once so their width, id, filter and cells cannot drift
 * between the Ledger and the Account.
 */
export function approverColumns<T extends SettlementEntry>(t: TFunction): ColDef<T>[] {
  return [
    {
      // The name the server stamped, else the staff id; blank when nobody had to.
      headerName: t('account.columns.approvedBy'),
      colId: 'approvedBy',
      width: 180,
      valueGetter: (p) => approvedByCell(p.data),
    },
    {
      headerName: t('account.columns.approvedAt'),
      field: 'approvedAt' as ColDef<T>['field'],
      colId: 'approvedAt',
      width: 160,
      // ⚠️ Blank on an unstamped `0001-01-01` — see `approvedAtCell`. Sorting still uses
      // the raw value, which puts the unapproved together at one end.
      valueFormatter: (p: ValueFormatterParams<T, string>) => approvedAtCell(p.data),
      filterValueGetter: (p) => approvedAtCell(p.data),
    },
  ]
}
