/**
 * The two deliveries the return projection is proved against (ticket 290).
 *
 * ⚠ **Their SHAPES are contractual; their VALUES are not.** `canReturn` and
 * `returnedQuantity` are BackOffice spec 1283 §2b additions that no live payload
 * carries yet — these are the only place in this repo where they are populated,
 * and the numbers on them are illustrative. The five captured payloads in
 * `payloads.ts` are deliberately left alone: carrying neither field, they are
 * the fail-closed proof.
 *
 * Both are built by spreading a REAL capture (`8000000253`, a `DL` delivery) so
 * every other field on the header and on the lines is the wire's own shape, not
 * a hand-written approximation of it.
 *
 * Test-only, like `payloads.ts`. Nothing in the app imports this module.
 */
import type { SdDocumentHeaderModel, SdDocumentLineModel } from '@/core/models/sd-document'
import { PAYLOADS } from './payloads'

const DELIVERY = PAYLOADS['8000000253']
const BASE_LINE = DELIVERY.lines[0]

/** One line of the real shape, with only the return arithmetic overridden. */
function line(
  lineNumber: number,
  itemNumber: string,
  quantity: number,
  returnedQuantity?: number,
): SdDocumentLineModel {
  const projected: SdDocumentLineModel = {
    ...BASE_LINE,
    lineNumber,
    itemNumber,
    itemDescription: `${BASE_LINE.itemDescription} ${lineNumber}`,
    quantity,
  }
  // Omitted, not set to `undefined`: the untouched line must be the same
  // *absent-field* shape the live wire sends today.
  if (returnedQuantity !== undefined) projected.returnedQuantity = returnedQuantity
  return projected
}

/**
 * A delivery with something left: one line untouched, one partly returned
 * (twice over, so its remainder is neither the delivered quantity, nor zero,
 * nor the last return's own quantity), one fully returned.
 */
export const DELIVERY_WITH_REMAINING: SdDocumentHeaderModel = {
  ...DELIVERY,
  canReturn: true,
  lines: [
    line(10, '208713', 4),
    // Delivered 9; two earlier returns of 2 then 3 have taken 5 back.
    line(20, '208714', 9, 5),
    line(30, '208715', 6, 6),
  ],
}

/** A delivery with nothing left: every line already fully returned. */
export const FULLY_RETURNED_LINES: SdDocumentHeaderModel = {
  ...DELIVERY,
  canReturn: false,
  lines: [line(10, '208713', 4, 4), line(20, '208714', 9, 9)],
}
