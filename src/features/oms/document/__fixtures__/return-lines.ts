/**
 * The two deliveries the return projection is proved against (ticket 290).
 *
 * ⚠ **Their SHAPES are contractual; their VALUES are not.** `canReturn` and
 * `returnedQuantity` are BackOffice spec 1283 §2b additions — spellings
 * confirmed 2026-08-24 against the owning `SdDocumentLineModel` /
 * `SdDocumentHeaderModel`, but carried by no *captured* payload here, so these
 * are the only place in this repo where they are populated,
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
import type {
  SdDocumentAddressModel,
  SdDocumentHeaderModel,
  SdDocumentLineModel,
  TransactionConditionModel,
} from '@/core/models/sd-document'
import { PAYLOADS } from './payloads'

const DELIVERY = PAYLOADS['8000000253']
const BASE_LINE = DELIVERY.lines[0]
const BASE_CONDITION = DELIVERY.conditions[0]

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
 * One condition of the real shape (ticket 293).
 *
 * ⚠ **`condValue` is left at the capture's structural `0` on every header
 * row, and the money rides on `condAmount`.** That is not a convenience of this
 * fixture — it is what the wire does: on the live captures `8000000174` and
 * `8000000121` the header `DFEE` row reads `condAmount: 12, condValue: 0`. A
 * fixture that filled `condValue` in would make the silent-zero regression
 * untestable.
 */
function condition(
  condDocumentLine: number,
  condType: string,
  conditionDescription: string,
  condCategory: string,
  condAmount: number,
  originOfCond: string,
): TransactionConditionModel {
  return {
    ...BASE_CONDITION,
    condDocumentLine,
    condType,
    conditionDescription,
    condCategory,
    condAmount,
    condValue: 0,
    originOfCond,
  }
}

/**
 * A delivery with something left: one line untouched, one partly returned
 * (twice over, so its remainder is neither the delivered quantity, nor zero,
 * nor the last return's own quantity), one fully returned.
 *
 * Its conditions carry **two header delivery fees** — plus one distributed
 * `'H'` copy of each, and a header row of another category, so the fee grid is
 * fed exactly the rows the projection has to sort out.
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
  conditions: [
    condition(0, 'DFEE', 'Delivery Fees', 'F', 12, 'M'),
    condition(0, 'FBBD', 'Beyond Border Delivery Fee', 'F', 25, 'M'),
    // Not a fee: a header row of another category, which the projection drops.
    condition(0, 'PTPA', 'PostToAccount', 'P', 0, 'M'),
    // The distributed copies. Included so a projection that summed them would
    // read 24 and 50 rather than 12 and 25.
    condition(10, 'DFEE', 'Delivery Fees', 'F', 12, 'H'),
    condition(10, 'FBBD', 'Beyond Border Delivery Fee', 'F', 25, 'H'),
  ],
}

/** A delivery with nothing left: every line already fully returned. */
export const FULLY_RETURNED_LINES: SdDocumentHeaderModel = {
  ...DELIVERY,
  canReturn: false,
  lines: [line(10, '208713', 4, 4), line(20, '208714', 9, 9)],
}

/**
 * A shipping address with something in every field the carrier reads
 * (ticket 292).
 *
 * ⚠ **Only the VALUES are invented.** The shape is `SdDocumentAddressModel`'s
 * own, spread from the capture's real (and, on this delivery, entirely blank)
 * shipping address — a bonded delivery whose address is empty is a live fact,
 * but it proves nothing about carrying an address across, so this one is
 * populated.
 */
export const PICKUP_ADDRESS: SdDocumentAddressModel = {
  ...(DELIVERY.shippingAddress as SdDocumentAddressModel),
  cityCode: 'C01',
  cityName: 'Riyadh',
  districtCode: 'D12',
  districtName: 'Al-Olaya',
  street1: 'King Abdulaziz Rd',
  street2: '',
  buildingNumber: '7420',
  postalCode: '12381',
  shortAddress: 'RIYD2938',
  gpsLat: 24.7136,
  gpsLon: 46.6753,
}

/** The same returnable delivery, with an address the pickup panel can pre-fill from. */
export const DELIVERY_WITH_ADDRESS: SdDocumentHeaderModel = {
  ...DELIVERY_WITH_REMAINING,
  shippingAddress: PICKUP_ADDRESS,
}
