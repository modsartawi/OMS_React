/**
 * Delivery Details' **money strip** (ticket 789, BackOffice spec 3389 user stories 67–70): on a
 * delivery of an insurance order, whose money stands (`CHANNEL` / `ENGINE`), the ORDER's patient and
 * insurer totals, and beside them the DELIVERY's own amount due — the figure a driver collects — so
 * the two can be checked against each other. With the insurance-view grant it links to the order's
 * Insurance section; without it, the money shows and the link does not (story 70).
 *
 * Where the money comes from: the order's search row (`GET SdDocumentWeb/OrderDocumentList`,
 * BackOffice 3391), found by the delivery's `refDocumentNo` — an identifier search, so the date is
 * ignored. That door runs under the OMS LIST grant, not the insurance-view grant the insurance read
 * (3390) needs, which is what lets the money show without the insurance grant. The price: a session
 * with the detail grant but not the list grant gets no strip (owner question in ticket 789).
 *
 * Pure: no React, no network, no i18n.
 */
import type { OmsAccessResult } from '@/core/models/oms-access'
import type { OrderDocumentRow } from '@/core/models/order-document'
import { canViewInsurance } from '@/core/oms/insurance-grant'
import type { OpenedAs } from './actions'
import { INSURANCE_SECTION_ID, moneyCell, moneySourceBadge, type MoneyCell } from './insurance-section'

const NONE: MoneyCell = { kind: 'none' }

/** What decides whether the order's row is asked for. */
export interface DeliveryMoneyStripContext {
  openedAs: OpenedAs
  /** The order the delivery delivers (the sales document) — never `orderNo`, the channel's number. */
  refDocumentNo: string | null | undefined
  access: Partial<OmsAccessResult> | null | undefined
}

/**
 * Is the order's search row asked at all? Only on Delivery Details, only for a delivery that names
 * its order, and only under the list grant the search door needs (explicit `true`; pending or
 * failed probe reads as no).
 */
export function asksDeliveryMoneyStrip(ctx: DeliveryMoneyStripContext): boolean {
  return ctx.openedAs === 'delivery' && (ctx.refDocumentNo ?? '').trim() !== '' && ctx.access?.canOpenList === true
}

/** The query key of a delivery's order search row (ticket 789), by the order's document number. */
export const orderRowKey = (documentNo: string) => ['document', 'order-row', documentNo] as const

/**
 * The key the page's Refresh invalidates for the strip, or `null` when no strip is asked (an
 * unasked read has nothing to re-read). Same trimmed number the strip reads with.
 */
export function stripRefreshKey(ctx: DeliveryMoneyStripContext): ReturnType<typeof orderRowKey> | null {
  return asksDeliveryMoneyStrip(ctx) ? orderRowKey((ctx.refDocumentNo ?? '').trim()) : null
}

/** The strip, drawn. */
export interface DeliveryMoneyStripView {
  source: ReturnType<typeof moneySourceBadge>
  /** The raw source code, for the badge of an unlisted one. */
  sourceCode: string | null
  /** The order's patient total on the current money. */
  patient: MoneyCell
  /** The order's insurer total on the current money. */
  insurer: MoneyCell
  /** The delivery's own amount due — what the driver collects. */
  amountDue: MoneyCell
  /** The order's Insurance section, or `null` without the insurance-view grant. */
  link: string | null
}

/**
 * The strip of a delivery, from its order's search row. `null` — no strip — when there is no row or
 * the order is not an insurance order. Every figure is in the order's currency decimals (the
 * delivery is the same store's, so the same currency); an unknown total is `none`, never `0.00`.
 */
export function deliveryMoneyStrip(
  row: OrderDocumentRow | null | undefined,
  delivery: { refDocumentNo: string; amountDue: number | null | undefined },
  access: Partial<OmsAccessResult> | null | undefined,
): DeliveryMoneyStripView | null {
  if (!row || row.isInsuranceOrder !== true) return null
  const currency = row.currency ?? null
  return {
    source: moneySourceBadge(row.moneySource),
    sourceCode: row.moneySource,
    patient: moneyCell(row.patientTotal, currency, NONE),
    insurer: moneyCell(row.insurerTotal, currency, NONE),
    amountDue: moneyCell(delivery.amountDue, currency, NONE),
    link: canViewInsurance(access)
      ? `/oms/document/${encodeURIComponent(delivery.refDocumentNo.trim())}#${INSURANCE_SECTION_ID}`
      : null,
  }
}

/**
 * The order's row out of an identifier search's answer: the one whose document number IS the
 * delivery's order (the search matches by identifier, so a near match is never taken).
 */
export function orderRowOf(rows: readonly OrderDocumentRow[] | null | undefined, documentNo: string): OrderDocumentRow | null {
  const no = documentNo.trim()
  if (!Array.isArray(rows)) return null // a malformed answer is no row, never a crash
  return rows.find((r) => (r?.documentNo ?? '').trim() === no) ?? null
}
