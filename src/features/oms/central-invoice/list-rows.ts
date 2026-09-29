/**
 * Reading a central-invoice list row (ticket 333, BackOffice 2100). Pure: no React, no i18n.
 */
import type { CentralInvoiceListRow } from '@/core/models/central-invoice'
import type { Severity } from '@/core/ui/severity'
import { CENTRAL_INVOICE_STATUSES, type CentralInvoiceStatus } from './list-criteria'

export type ListStatus = CentralInvoiceStatus | 'unknown'
export type PickOutcome = 'CONSUMED' | 'VOIDED' | 'NONE' | 'pending' | 'unknown'

const OUTCOMES: readonly string[] = ['CONSUMED', 'VOIDED', 'NONE']

/**
 * The status a wire spelling names. Exact match, as `verdictOf`: the server writes its own
 * constants, so a drift is `unknown` and shown as sent — never relabelled as one of the three.
 */
export function statusOf(wire: string): ListStatus {
  return (CENTRAL_INVOICE_STATUSES as readonly string[]).includes(wire) ? (wire as ListStatus) : 'unknown'
}

/** Billed is done; queued is in motion; stranded needs a person. */
export const STATUS_SEVERITY: Record<ListStatus, Severity> = {
  QUEUED: 'go',
  BILLED: 'ok',
  STRANDED: 'bad',
  unknown: 'mute',
}

/**
 * The picking outcome a wire spelling names. Blank is `pending`: the outcome is written when
 * the invoice is billed, so a queued or stranded row has none yet — that is not a `NONE`.
 */
export function pickOutcomeOf(wire: string): PickOutcome {
  if (wire === '') return 'pending'
  return OUTCOMES.includes(wire) ? (wire as PickOutcome) : 'unknown'
}

/**
 * Whether a row has a serial detail to open (ticket 333): it carries serials, or it is the
 * case regulatory must see even when it carries none — flagged GS1 with a consumed picking
 * document. The second half is what makes "no serialised units" an answer rather than a
 * missing button.
 */
export function hasSerialDetail(row: CentralInvoiceListRow): boolean {
  return row.serials.length > 0 || (row.serialisedInGs1Market && pickOutcomeOf(row.pickOutcome) === 'CONSUMED')
}

/**
 * The serials of the given rows, one line per pack, in the order given (the export's second
 * sheet). Each line names its delivery, invoice and store so the sheet stands on its own, and
 * ends with the row's GS1 flag (`gs1Label` words it): the server gives the packs of every
 * CONSUMED invoice, a Bahraini one too, and regulatory reports only the GS1 ones. Flagged,
 * not dropped — a misread flag should ask regulatory to look, never hide a pack.
 */
export function serialLines(
  rows: readonly CentralInvoiceListRow[],
  gs1Label: (flagged: boolean) => string,
): string[][] {
  return rows.flatMap((row) =>
    row.serials.map((s) => [
      row.deliveryNo,
      row.trxNumber,
      row.storeCode,
      row.country,
      s.pickDocumentNo,
      s.gtin,
      s.serialNumber,
      s.batchLot,
      s.expiryDate,
      gs1Label(row.serialisedInGs1Market),
    ]),
  )
}
