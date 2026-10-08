import type { ColDef, ICellRendererParams, ValueFormatterParams } from 'ag-grid-community'
import type { ComponentType } from 'react'
import type { TFunction } from 'i18next'

import { OMS_GRID_BASE_COL_DEF } from '@/core/theme/grid-base'
import { LOY_INVOICE_EMAIL_STATUSES, type LoyInvoiceRow } from '@/core/models/loy'
import Ltr from '@/core/ui/Ltr'
import { formatDateTime, formatShortDate } from '@/core/util/date-format'

/**
 * The Invoices tab's columns and words (ticket 428, spec 2443) — one row per
 * **receipt**, saying what happened to its invoice email and where it would go now.
 *
 * 🚩 **The client words the server's verdict and derives nothing.** The status comes
 * from the queue row and its latest attempt, and the address, its source and
 * `resendable` from the recipient rule the rail itself runs (BackOffice 2444, 2446).
 * A second, client-side reading of any of them is how the screen and the rail would
 * start to disagree about whether an invoice will be sent.
 *
 * Sort and filter are on, as on Sales: the whole 90-day window is in the browser.
 * 🚩 **No row links**, for Sales' reason (226 §9): no route takes a retail receipt.
 */
export const INVOICES_DEFAULT_COL_DEF: ColDef<LoyInvoiceRow> = {
  ...OMS_GRID_BASE_COL_DEF,
  sortable: true,
  filter: true,
  resizable: true,
  cellDataType: false,
}

/** The statuses the door answers (BackOffice 2446), each with a sentence of its own —
 *  the model's own list, so a status added there cannot miss its sentence here. */
export const INVOICE_STATUSES = LOY_INVOICE_EMAIL_STATUSES

/**
 * The rail's skip reasons (`InvoiceEmailSkipReason`, BackOffice 2444), each worded as
 * the thing to fix. A code outside this list still reads — as itself.
 */
export const INVOICE_SKIP_REASONS = [
  'NO_TRX',
  'NO_LOY_MEMBER',
  'PLACEHOLDER_MEMBER',
  'NO_ORDER',
  'NO_EMAIL',
  'SUPPORT_EMAIL',
  'INVALID_EMAIL',
] as const

const isKnown = <T extends string>(list: readonly T[], value: string): value is T =>
  (list as readonly string[]).includes(value)

/**
 * A receipt's status as a sentence, e.g. *Skipped: no email on the profile*.
 *
 * 🚩 **An unknown code reads as itself** — a status or skip reason the door grows
 * later is shown bare rather than as a raw `tabs.invoices…` key or a blank cell,
 * because a blank says "nothing happened" about an invoice that something happened to.
 */
export function invoiceStatusText(row: LoyInvoiceRow, t: TFunction): string {
  if (row.status === 'Skipped') {
    const code = row.skipReason?.trim()
    if (!code) return t('tabs.invoices.status.Skipped')
    const reason = isKnown(INVOICE_SKIP_REASONS, code) ? t(`tabs.invoices.skip.${code}`) : code
    return t('tabs.invoices.status.skippedBecause', { reason })
  }
  return isKnown(INVOICE_STATUSES, row.status) ? t(`tabs.invoices.status.${row.status}`) : String(row.status)
}

/**
 * The note beside the address: an e-commerce receipt goes to **the online order's
 * email**, not the profile's, so a profile fix does not change where it goes (spec
 * 2443 story 8). A profile address needs no note.
 */
export function recipientSourceKey(row: Pick<LoyInvoiceRow, 'recipientSource'>): string | null {
  return row.recipientSource === 'Order' ? 'tabs.invoices.source.order' : null
}

/**
 * Why a receipt cannot be resent NOW, when that reason is the recipient rule's — e.g.
 * *Would be skipped: no email on the profile* (spec 2443 stories 13–14). The status
 * column says what happened to the LAST attempt; this says what a requeue would hit
 * today, which is what the agent has to fix first.
 *
 * `null` for a resendable receipt and for `QUEUED` / `NOT_QUEUED`, which the status
 * column already says. An unknown code reads as itself.
 */
export function notResendableText(row: LoyInvoiceRow, t: TFunction): string | null {
  if (row.resendable === true) return null
  const code = row.notResendableReason?.trim()
  if (!code || code === 'QUEUED' || code === 'NOT_QUEUED') return null
  const reason = isKnown(INVOICE_SKIP_REASONS, code) ? t(`tabs.invoices.skip.${code}`) : code
  return t('tabs.invoices.wouldSkip', { reason })
}

/**
 * The columns. `actionCell` is the Resend cell, or `null` for a session that may not
 * resend at all — then the column is absent rather than empty on every row.
 */
export function buildInvoiceColumns(
  t: TFunction,
  { actionCell }: { actionCell: ComponentType<ICellRendererParams<LoyInvoiceRow>> | null },
): ColDef<LoyInvoiceRow>[] {
  const columns: ColDef<LoyInvoiceRow>[] = [
    {
      headerName: t('tabs.invoices.columns.store'),
      field: 'storeCode',
      width: 100,
      cellClass: 'font-mono',
    },
    {
      headerName: t('tabs.invoices.columns.receipt'),
      field: 'trxNumber',
      width: 170,
      cellClass: 'font-mono text-[12px]',
    },
    {
      headerName: t('tabs.invoices.columns.date'),
      field: 'trxDate',
      width: 120,
      valueFormatter: (p: ValueFormatterParams<LoyInvoiceRow, string>) => formatShortDate(p.value),
    },
    {
      headerName: t('tabs.invoices.columns.status'),
      colId: 'status',
      // The sentence is the value, so sorting and filtering work on what is read.
      valueGetter: (p) => (p.data ? invoiceStatusText(p.data, t) : ''),
      flex: 1,
      minWidth: 260,
    },
    {
      headerName: t('tabs.invoices.columns.lastAttempt'),
      field: 'lastAttemptAt',
      width: 160,
      valueFormatter: (p: ValueFormatterParams<LoyInvoiceRow, string | null>) =>
        formatDateTime(p.value),
    },
    {
      headerName: t('tabs.invoices.columns.recipient'),
      colId: 'recipient',
      field: 'recipient',
      minWidth: 240,
      flex: 1,
      // Its own renderer, so it isolates its own values (bidi): the address as a
      // machine value, the source note as the screen's words beside it.
      cellRenderer: (p: ICellRendererParams<LoyInvoiceRow, string | null>) => {
        if (!p.data) return null
        const source = recipientSourceKey(p.data)
        const blocked = notResendableText(p.data, t)
        return (
          <span>
            {p.data.recipient ? (
              <Ltr>{p.data.recipient}</Ltr>
            ) : (
              <span className="text-muted-foreground">{t('tabs.invoices.noRecipient')}</span>
            )}
            {source && <span className="ms-1.5 text-xs text-muted-foreground">{t(source)}</span>}
            {blocked && (
              <span className="ms-1.5 text-xs text-muted-foreground" data-invoice-blocked>
                {blocked}
              </span>
            )}
          </span>
        )
      },
    },
  ]

  if (actionCell) {
    columns.push({
      headerName: t('tabs.invoices.columns.resend'),
      colId: 'resend',
      width: 120,
      sortable: false,
      filter: false,
      cellRenderer: actionCell,
    })
  }

  return columns
}
