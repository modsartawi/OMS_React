/**
 * Delivery details' light header (spec 380 D2, ticket 402; rulings 371 §1 and 369 §1): what its
 * two lines show for one loaded document.
 *
 * The now-step is the shared `@/core` Delivery timeline (D1) fed from the document header, the
 * same derivation the list's Status column reads, so the badge and the list agree on the same
 * delivery. Payment is not a step: it is the due/paid tag. Pure, and `t` is passed in for the
 * same reason `fields.ts` does it.
 */
import type { SdDocumentHeaderModel } from '@/core/models/sd-document'
import { dueTag, headerTimelineNow, type TimelineStepKey } from '@/core/oms/timeline'
import { carriesPrescription, headerSubIds, overallStatusCode, type HeaderSubId, type TFn } from './fields'

export interface DocumentHeaderView {
  /** Where the delivery stands now: the now-step badge's word. */
  now: TimelineStepKey
  /** `Due 72.50` while something is left to pay, `Paid` otherwise. */
  due: ReturnType<typeof dueTag>
  tags: {
    /** Dawaa Now: an attribute of the order, never a step. */
    dawaaNow: boolean
    /** The document carries a prescription (the Prescription card's own rule). */
    eRx: boolean
    /** The raw Overall code, `''` for no tag. */
    overall: string
  }
  /** Line two. */
  subIds: HeaderSubId[]
}

export function documentHeaderView(doc: SdDocumentHeaderModel, t: TFn): DocumentHeaderView {
  return {
    now: headerTimelineNow(doc),
    due: dueTag(doc.amountDue),
    tags: {
      dawaaNow: doc.isExpressDelivery === true,
      eRx: carriesPrescription(doc),
      overall: overallStatusCode(doc),
    },
    subIds: headerSubIds(doc, t),
  }
}
