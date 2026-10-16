// Wire shapes for the Pick support console's doors (BackOffice brief 2691, spec 2685, ADR 0085;
// doors 2687–2690). Field for field from the brief, which was written from the SHIPPED server
// code (`PickSupportWebEndpoints.cs`, `PickSupportModels.cs`); casing is the camelCase ASP.NET
// Core emits.
//
// ⚠️ Every time is LOCAL wall clock, shown as sent and never converted. A stamp that was never
// written arrives as the column's floor (`0001-01-01T00:00:00`, or any year ≤ 1900) and reads
// as the dash (`readStamp`, `@/core/pick-support/diagnosis`).
//
// The closed lists are string unions PLUS `string`, so a value the server learns later still
// parses. An unlisted verdict or hold reads as UNKNOWN (escalate), never as an error.

import type { DonorRequestModel } from '@/core/models/sd-document'

/** Keeps a union's literals in the editor's completion while accepting any string. */
type Open<T extends string> = T | (string & {})

/** Brief 2691 "Closed lists": the three stuck shapes. */
export const PICK_SUPPORT_SHAPES = ['DONOR_AT_OLD_ORDER_STORE', 'STORE_CHANGE_NOT_FOLLOWED', 'ENDED_STILL_HOLDS'] as const
export type PickSupportShape = Open<(typeof PICK_SUPPORT_SHAPES)[number]>

export const PICK_SUPPORT_VERDICTS = ['HEALTHY', 'STUCK', 'UNKNOWN'] as const
export type PickSupportVerdict = Open<(typeof PICK_SUPPORT_VERDICTS)[number]>

/** What a shape's fix does to each request or document it names. */
export const PICK_SUPPORT_ACTIONS = ['CLOSE_TRANSFERRED_OUT', 'CANCEL', 'PUT_BACK_OR_VOID'] as const
export type PickSupportAction = Open<(typeof PICK_SUPPORT_ACTIONS)[number]>

/** The kinds of number a lookup key matched (`matchedBy`). */
export const PICK_SUPPORT_KEY_KINDS = [
  'ORDER',
  'DELIVERY',
  'TILL_TRANSACTION',
  'PICKING_DOCUMENT',
  'DONOR_REQUEST',
  'SERIAL',
] as const
export type PickSupportKeyKind = Open<(typeof PICK_SUPPORT_KEY_KINDS)[number]>

export const PICK_SUPPORT_HOLDS = ['LIVE_PICK', 'PUT_BACK_BASKET', 'CENTRAL_INVOICED', 'STUCK', 'UNKNOWN'] as const
export type PickSupportHold = Open<(typeof PICK_SUPPORT_HOLDS)[number]>

export const PICK_SUPPORT_TIMELINE_SOURCES = ['PICK_DOCUMENT', 'DONOR_REQUEST', 'DELIVERY_LOG'] as const
export type PickSupportTimelineSource = Open<(typeof PICK_SUPPORT_TIMELINE_SOURCES)[number]>

/** The refusal codes of the Pick support doors (brief 2691 "The envelope"). */
export const PICK_SUPPORT_CODES = {
  /** The delivery does not exist (Delivery, Fix). */
  notFound: 'PICK-00002',
  /** A blank key or delivery number; a shape that is not one of the three (all doors). */
  badInput: 'PICK-00003',
  /** The delivery is not, or no longer, in that shape — nothing was changed (Fix). */
  notInShape: 'PICK-00224',
  /** The fix has no reason or no complaint reference — nothing was changed (Fix). */
  blankReason: 'PICK-00225',
} as const

// ---------------------------------------------------------------------------
// GET PickSupport/Resolve?key= — any number to its deliveries
// ---------------------------------------------------------------------------

/** One delivery a lookup key resolved to, and why. */
export interface PickSupportResolvedDelivery {
  deliveryNo: string
  orderNo: string
  currentStore: string
  closeStatus: string
  matchedBy: PickSupportKeyKind[]
  /** The stuck shapes it is in now; empty when in none. Non-empty is the row's stuck marker. */
  shapes: PickSupportShape[]
}

/** One picking document (and GTIN) holding a unit of the serial looked up. */
export interface PickSupportSerialHold {
  serialNumber: string
  gtin: string
  documentNo: string
  sourceType: string
  sourceKey: string
  /** The store holding the unit: the one that picked it. */
  storeCode: string
  documentState: string
  /** The central invoice that consumed the document; empty unless the hold is CENTRAL_INVOICED. */
  consumedByTrx: string
  /** Empty for a document that belongs to no delivery. */
  deliveryNo: string
  hold: PickSupportHold
  /** The delivery's stuck shapes whose fix ends this document; empty unless STUCK. */
  shapes: PickSupportShape[]
  explanationEn: string
  explanationAr: string
}

/**
 * What a lookup key resolved to. `matched: false` is a 200 with the server's sentence in
 * `messageEn` / `messageAr` (and both lists empty) — an answer, not an error.
 */
export interface PickSupportResolution {
  key: string
  matched: boolean
  messageEn: string | null
  messageAr: string | null
  deliveries: PickSupportResolvedDelivery[]
  /** Only when the key was a serial: one entry per picking document and GTIN holding a unit. */
  serials: PickSupportSerialHold[]
}

// ---------------------------------------------------------------------------
// GET PickSupport/StuckNow?store=&shape= — the census (ticket 498 draws it)
// ---------------------------------------------------------------------------

/** One delivery in one stuck shape: a delivery in two shapes is two rows. */
export interface PickSupportCensusRow {
  deliveryNo: string
  orderNo: string
  /** The store the delivery sits at now. */
  currentStore: string
  shape: PickSupportShape
  /** Local wall clock; `null` when not even the delivery's entry time is recorded. */
  since: string | null
}

/** The census door's query: a blank filter is never sent (blank = all). */
export type PickSupportCensusParams = {
  /** The store the delivery sits at now. */
  store?: string
  /** One of the three shape codes; anything else is refused `PICK-00003`. */
  shape?: string
}

export interface PickSupportCensus {
  /** Distinct deliveries in `rows` after the filters — the count badge, shown as sent. */
  total: number
  /** Oldest `since` first, then by delivery, then by shape. */
  rows: PickSupportCensusRow[]
}

// ---------------------------------------------------------------------------
// GET PickSupport/Delivery/{deliveryNo} — the diagnosis
// ---------------------------------------------------------------------------

/** One store move of the delivery (`DCST` / `DPOL`) or of its order (`OCST` / `OPOL`). */
export interface PickSupportStoreMove {
  at: string
  by: string
  /** Which of the two moved: the delivery's number or the order's. */
  documentNo: string
  actionType: string
  fromStore: string
  toStore: string
}

/** A picked unit on a picking document line. */
export interface PickDocumentUnitModel {
  pickIndex: number
  pickType: string
  channel: string
  scannedText: string
  barcode: string
  gtin: string
  serialNumber: string
  batchLot: string
  expiryDate: string
  overrideReason: string
  pickedBy: string
  approvedBy: string
  pickedAt: string
  device: string
}

/** A picking document line. */
export interface PickDocumentLineModel {
  lineNumber: number
  sourceLine: number
  itemNumber: string
  description: string
  quantity: number
  uom: string
  shortQuantity: number
  shortReason: string
  isPickable: boolean
  coveredQuantity: number
  owedUnits: number
  coveredUnits: number
  required: number
  picked: number
  state: string
  units: PickDocumentUnitModel[]
}

/**
 * A picking document — the same model the picking doors return (BackOffice spec 1711). oms-react
 * had none until this console, so it is declared here rather than in a shared module.
 */
export interface PickDocumentModel {
  documentNo: string
  /** `OMS` (the delivery's own) or `DNR` (a donor request's). */
  sourceType: string
  sourceKey: string
  storeCode: string
  /** `OPEN`, `COMPLETE`, `CONSUMED`, `VOIDED`, `PUTBACK`. */
  state: string
  revision: number
  /** For example `STORE_CHANGE`, `SOURCE_CANCELLED`, `TRANSFERRED_OUT`; blank unless voided. */
  voidReason: string
  createdAt: string
  createdBy: string
  lastPickAt: string
  lastPickBy: string
  confirmedAt: string
  confirmedBy: string
  consumedByStore: string
  consumedByTrx: string
  confirmMode: string
  picked: number
  required: number
  lines: PickDocumentLineModel[]
}

/** A donor request line, as the order store's read returns it (donor-store-only fields left out). */
export interface PickSupportDonorRequestLine {
  deliveryLine: number
  itemNumber: string
  description: string
  uom: string
  requestedQuantity: number
  requestedUnits: number
  picked: number
  covered: number
  coveredUnits: number
  canGiveStated: boolean
  canGiveQuantity: number
  refusedUncovered: number
}

/**
 * A donor request as the diagnosis carries it: the shared `DonorRequestModel` (which other
 * screens read and which is NOT widened here) plus its document, unit count, reference and lines.
 * The donor-store-only fields and the action flags also come over the wire; the console takes no
 * request action, so they are not modelled.
 */
export interface PickSupportDonorRequest extends Omit<DonorRequestModel, 'state'> {
  /** `OPEN`, `FULFILLED`, `TRANSFERRED`, `CANCELLED` — open here, so a later state still parses. */
  state: Open<DonorRequestModel['state']>
  documentNo: string
  documentState: string
  documentRevision: number
  documentVoidReason: string
  unitsPicked: number
  /** `DNR:{requestNo}`. */
  reference: string
  lines: PickSupportDonorRequestLine[]
}

/** A donor request a shape is about, and what its fix does to it. */
export interface PickSupportShapeRequest {
  requestNo: string
  documentNo: string
  orderStore: string
  donorStore: string
  state: string
  action: PickSupportAction
}

/** One of the delivery's own (OMS) documents a shape is about, and what its fix does to it. */
export interface PickSupportShapeDocument {
  documentNo: string
  storeCode: string
  state: string
  action: PickSupportAction
}

/** One stuck shape the delivery is in: what is wrong, its one fix, and the words to say. */
export interface PickSupportShapeMatch {
  shape: PickSupportShape
  explanationEn: string
  explanationAr: string
  fixEn: string
  fixAr: string
  tellTheStoreEn: string
  tellTheStoreAr: string
  requests: PickSupportShapeRequest[]
  documents: PickSupportShapeDocument[]
}

/** One step of the merged timeline, oldest first. */
export interface PickSupportTimelineEntry {
  at: string
  source: PickSupportTimelineSource
  /** The picking document, the donor request or the Sd document the step belongs to. */
  key: string
  /** 0 for a log line or a reconstructed step. */
  seq: number
  eventType: string
  actor: string
  approvedBy: string
  reason: string
  complaintRef: string
  detail: string
  /** Read off a pre-trail request's stamp columns: its time is the column's, not the act's. */
  reconstructed: boolean
}

/** The copy-diagnosis bundle, copied VERBATIM — never assembled on the client. */
export interface PickSupportCopyBundle {
  text: string
  json: string
}

export interface PickSupportDiagnosis {
  deliveryNo: string
  orderNo: string
  currentStore: string
  /** The delivery's Sd status letters, raw. Empty = not set. */
  readyStatus: string
  closeStatus: string
  verdict: PickSupportVerdict
  /** The PICK-00004 / PICK-00210 sentences the invoice would be refused with, or null. English only. */
  refusalText: string | null
  storeHistory: PickSupportStoreMove[]
  /** The delivery's own (OMS) and its requests' (DNR) documents, oldest first. */
  documents: PickDocumentModel[]
  donorRequests: PickSupportDonorRequest[]
  /** Every stuck shape; empty when HEALTHY or UNKNOWN. */
  shapes: PickSupportShapeMatch[]
  timeline: PickSupportTimelineEntry[]
  copy: PickSupportCopyBundle
}

// ---------------------------------------------------------------------------
// POST PickSupport/Delivery/{deliveryNo}/Fix — the one fix (ticket 497 draws it)
// ---------------------------------------------------------------------------

/** No actor field: the server takes the signed-in user from the cookie session. */
export interface PickSupportFixRequest {
  shape: PickSupportShape
  reason: string
  complaintRef: string
}

export interface PickSupportFixResult {
  shape: PickSupportShape
  tellTheStoreEn: string
  tellTheStoreAr: string
  /** The delivery re-read after the fix. `null` when that re-read failed — the fix STILL stands. */
  diagnosis: PickSupportDiagnosis | null
}
