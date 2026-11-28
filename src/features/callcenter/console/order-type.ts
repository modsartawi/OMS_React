/**
 * The order type (ticket 1007, spec 1006 D1, D10, default A): which types the picker offers, and
 * the one line that says what a switch took off.
 *
 * - **The offering is the server's.** `capabilities.orderTypes` is the set this order may take
 *   (default A; BackOffice `CallCenterOrderTypes.ForOrder`, which always keeps `Ordinary` and the
 *   current type, and drops the prescription types on a Tamara-linked order); the console never
 *   decides it. A pre-1.15 server sends no set, and the picker is
 *   then hidden: the order is the phone order it always was.
 * - **The notice is drawn from `removed`, never from a diff.** `setOrderType` answers with what it
 *   took off (spec 1006 v1.15). Comparing the coupon chip before and after would be the console
 *   re-deriving an engine outcome.
 */
import type { TFunction } from 'i18next'
import type { OrderType, OrderTypeRemoved, SessionCapabilities, SessionHeader } from '@/core/models/callcenter'
import { fsi } from '@/core/util/bidi'

/** The types this console can word, in the picker's order: the phone order first. */
export const KNOWN_ORDER_TYPES = ['Ordinary', 'Wasfaty', 'Nphies'] as const
export type KnownOrderType = (typeof KNOWN_ORDER_TYPES)[number]

const isKnown = (type: string): type is KnownOrderType => (KNOWN_ORDER_TYPES as readonly string[]).includes(type)

/** The order's type. Absent (a pre-1.15 server) is the phone order. */
export function orderTypeOf(header: SessionHeader): OrderType {
  return header.orderType ?? 'Ordinary'
}

/** A Wasfaty or Nphies order: no promotions, no coupons (D2). */
export function isPrescriptionOrder(header: SessionHeader): boolean {
  const type = orderTypeOf(header)
  return type === 'Wasfaty' || type === 'Nphies'
}

/**
 * The picker's options, phone order first. Empty means the picker is hidden: fewer than two
 * choices is no choice, so an offering of `Ordinary` alone (or none) draws nothing.
 *
 * The server always lists the order's own type (BO 4485 review), so the console adds nothing. A
 * type this console cannot word is dropped.
 */
export function offeredOrderTypes(capabilities: SessionCapabilities): KnownOrderType[] {
  const offered = new Set<string>(capabilities.orderTypes ?? [])
  const options = KNOWN_ORDER_TYPES.filter((type) => offered.has(type))
  return options.length < 2 ? [] : options
}

/** Where on which order a `setOrderType` call was made: the order and its version. */
export interface OrderPoint {
  transactionId: string
  version: number
}

/**
 * Whether a `setOrderType` refusal is still about the order on screen. 🚩 It is about the order
 * and the version it was raised on: a fresh order, or any change that moves the version (an
 * address that now has an insurance store), retires it.
 */
export function orderTypeErrorStands(raisedOn: OrderPoint | null, now: OrderPoint | null): boolean {
  return !!raisedOn && !!now && raisedOn.transactionId === now.transactionId && raisedOn.version === now.version
}

/** The type's word in the picker and on the badge. */
export function orderTypeLabelKey(type: OrderType): string {
  return isKnown(type) ? `orderType.option.${type}` : 'orderType.option.other'
}

/**
 * The switch notice, or `null` when nothing came off. *"Wasfaty order: 2 promotions and coupon
 * SAVE10 were removed."*
 *
 * Every count and code is a machine value interpolated into a sentence, so each is isolated whole
 * (`fsi`, bidi rule). The coupon codes are a list, not a pair: each is isolated and the locale's own
 * list separator joins them, so under Arabic they read in the sentence's direction.
 */
export function orderTypeNotice(t: TFunction, type: OrderType, removed: OrderTypeRemoved | null | undefined): string | null {
  const coupons = removed?.coupons ?? []
  const promotions = removed?.promotions ?? 0
  if (coupons.length === 0 && promotions <= 0) return null
  const parts: string[] = []
  if (promotions > 0) parts.push(t('orderType.removed.promotions', { count: promotions, n: fsi(promotions) }))
  if (coupons.length > 0)
    parts.push(
      t('orderType.removed.coupons', {
        count: coupons.length,
        codes: coupons.map((code) => fsi(code)).join(t('orderType.removed.listSeparator')),
      }),
    )
  const what = parts.length === 2 ? t('orderType.removed.and', { a: parts[0], b: parts[1] }) : parts[0]
  return t('orderType.removed.sentence', {
    count: promotions + coupons.length,
    order: t(isKnown(type) ? `orderType.order.${type}` : 'orderType.order.other'),
    what,
  })
}
