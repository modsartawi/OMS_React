/**
 * Pure builders mapping a loaded document onto the read-only label/value rows of
 * the Screen 2 header groups and the Status tab.
 */
import type {
  SdDocumentAddressModel,
  SdDocumentHeaderModel,
  SdDocumentHeaderStatusModel,
} from '@/core/models/sd-document'
import { formatLongDate, formatTimeOfDay } from '@/core/util/date-format'

/** One label/value row. A blank `value` renders as an em dash. */
export interface FieldRow {
  label: string
  value: string
  /** When set, the value renders as an external link opening in a new tab. */
  href?: string
}

function text(value: string | null | undefined): string {
  return (value ?? '').trim()
}

/**
 * A coded status for display: the human-readable `*Description`, falling back to
 * the raw code when the API leaves it blank — so a value is never hidden.
 */
function describedStatus(
  description: string | null | undefined,
  code: string | null | undefined,
): string {
  return text(description) || text(code)
}

/** A GPS coordinate for display — blank when unset (missing or exactly `0`). */
function gpsText(value: number | null | undefined): string {
  return typeof value === 'number' && Number.isFinite(value) && value !== 0 ? String(value) : ''
}

/** A Google Maps link for a coordinate pair, or `null` when unusable. */
function mapsLink(lat: number | null | undefined, lon: number | null | undefined): string | null {
  if (typeof lat !== 'number' || typeof lon !== 'number') return null
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || (lat === 0 && lon === 0)) return null
  return `https://www.google.com/maps?q=${lat},${lon}`
}

// The header "Document" and "Customer" groups left with ticket 091, and the
// "Status" summary group with 090. Identity — the document number, its sub-ids
// and the customer block — is the identity band's job now; the money, e-Rx,
// fulfilment, driver and payment fields become the summary rail's cards (092),
// and the thirteen status rows keep their home in the rail's All-statuses
// disclosure, which `statusBreakdownRows` below still builds. Overall Status
// keeps binding the RAW `status.overallStatus`: the WPF bound a non-existent
// `overallStatusDescription` and so rendered nothing at all (Appendix B bug 3).

/** One sub-id under the identity band's big line. */
export interface BandSubId {
  /** The payload field this row reports. */
  key: 'orderNo' | 'documentType' | 'deliveryDocumentType' | 'placed' | 'storeCode'
  label: string
  value: string
  /** Render `value` in monospace: it is a code, not a word (the D-3 echo test). */
  isCode: boolean
}

/**
 * The band's echo test: whether a `*Description` says nothing its code did not.
 *
 * **Exact**, where the rail's `isCodeEcho` is case-insensitive, and the corpus is
 * why: `documentTypeDescription: 'Cash'` against `documentType: 'CASH'` is a
 * resolved *word*, and the band prints the word. Only a description that is
 * blank or byte-identical to its code (`'NUPP'`, `'ORRT'` — 2 of 5 captures)
 * falls back to the raw code and renders in monospace.
 */
function isBandCodeEcho(description: string, code: string | null | undefined): boolean {
  return !description || description === text(code)
}

/**
 * The identity band's sub-ids (spec 083 D-2): the five rows under the big line,
 * in band order.
 *
 * A description falls back to its code, and an echo (`isBandCodeEcho`) is
 * flagged so the band renders it in monospace — the same signal the pill rail
 * uses for the same reason. A row the document does not carry is
 * **omitted** rather than em-dashed (D-5): `deliveryDocumentType` is `null` on
 * the e-Rx capture, and an absent sub-id is not a fact worth a dash.
 *
 * "Placed" is one row built from two fields — the calendar date from
 * `documentDate`, the clock time from `entryTime`.
 */
export function bandSubIds(doc: SdDocumentHeaderModel, t: TFn): BandSubId[] {
  const rows: BandSubId[] = []

  const push = (key: BandSubId['key'], label: string, value: string, isCode = false): void => {
    if (value) rows.push({ key, label, value, isCode })
  }
  const pushCoded = (
    key: BandSubId['key'],
    label: string,
    description: string | null | undefined,
    code: string | null | undefined,
  ): void => {
    const resolved = text(description)
    push(key, label, resolved || text(code), isBandCodeEcho(resolved, code))
  }

  push('orderNo', t('band.orderNo'), text(doc.orderNo))
  pushCoded('documentType', t('band.documentType'), doc.documentTypeDescription, doc.documentType)
  pushCoded(
    'deliveryDocumentType',
    t('band.deliveryDocumentType'),
    doc.deliveryDocumentTypeDescription,
    doc.deliveryDocumentType,
  )
  push(
    'placed',
    t('band.placed'),
    [formatLongDate(doc.documentDate), formatTimeOfDay(doc.entryTime)].filter(Boolean).join(' · '),
  )
  push('storeCode', t('band.store'), text(doc.storeCode))

  return rows
}

/**
 * The band's overall-status lozenge value: the RAW `status.overallStatus`, blank
 * when the document carries none — and blank means **no lozenge**, on 3 of the
 * 5 captured documents. There is no `overallStatusDescription` on the payload,
 * which is why this one renders as a labelled monospace code rather than a word.
 */
export function overallStatusCode(doc: SdDocumentHeaderModel): string {
  return text(doc.status?.overallStatus)
}

/** The identity band's customer block — blank parts are dropped, not dashed. */
export interface BandCustomer {
  name: string
  /** Phone and city, joined — either may be absent (`cityName` is on 3/5). */
  contact: string
}

/**
 * The band's customer block (spec 083 D-2), at the end of the band and
 * **duplicated with the Customer rail card by design**: the band answers "whose
 * is this" without a read of the rail.
 */
export function bandCustomer(doc: SdDocumentHeaderModel): BandCustomer {
  return {
    name: text(doc.customer?.customerName),
    contact: [text(doc.customer?.customerPhone), text(doc.shippingAddress?.cityName)]
      .filter(Boolean)
      .join(' · '),
  }
}

/**
 * The document's provenance — `refDocumentNo`, the source and the entry user.
 *
 * D-2 sends these three "to the All-statuses disclosure's neighbourhood rather
 * than into the band": they are how the document got here, not what it is, and
 * they are the wrong weight for the one line an operator reads first. They keep
 * `describedStatus`'s fallback and the disclosure's em dash, because a
 * disclosure's job is completeness.
 */
export function documentProvenanceRows(doc: SdDocumentHeaderModel, t: TFn): FieldRow[] {
  return [
    { label: t('fields.refDocumentNo'), value: text(doc.refDocumentNo) },
    {
      label: t('fields.documentSource'),
      value: describedStatus(doc.documentSourceDescription, doc.documentSource),
    },
    { label: t('fields.entryUser'), value: text(doc.entryUser) },
  ]
}

/**
 * The "Shipping Address" group; an "open in maps" row is appended when the GPS
 * pair is usable. Returns `[]` when the document carries no shipping address.
 */
export function shippingAddressRows(
  address: SdDocumentAddressModel | null | undefined,
  t: TFn,
): FieldRow[] {
  if (!address) return []

  const rows: FieldRow[] = [
    { label: t('fields.cityCode'), value: text(address.cityCode) },
    { label: t('fields.cityName'), value: text(address.cityName) },
    { label: t('fields.districtCode'), value: text(address.districtCode) },
    { label: t('fields.districtName'), value: text(address.districtName) },
    { label: t('fields.street1'), value: text(address.street1) },
    { label: t('fields.street2'), value: text(address.street2) },
    { label: t('fields.gpsLat'), value: gpsText(address.gpsLat) },
    { label: t('fields.gpsLon'), value: gpsText(address.gpsLon) },
  ]

  const link = mapsLink(address.gpsLat, address.gpsLon)
  if (link) rows.push({ label: t('fields.map'), value: t('fields.openInMaps'), href: link })

  return rows
}

/**
 * The full Status-tab breakdown. `consignmentStatus`, `controlStatus` and
 * `notificationStatus` have no `*Description` companion, so they show raw codes.
 */
export function statusBreakdownRows(status: SdDocumentHeaderStatusModel, t: TFn): FieldRow[] {
  return [
    { label: t('fields.overallStatus'), value: text(status.overallStatus) },
    {
      label: t('fields.lastAction'),
      value: describedStatus(status.lastActionDescription, status.lastAction),
    },
    {
      label: t('fields.readyStatus'),
      value: describedStatus(status.readyStatusDescription, status.readyStatus),
    },
    {
      label: t('fields.closeStatus'),
      value: describedStatus(status.closeStatusDescription, status.closeStatus),
    },
    {
      label: t('fields.clearStatus'),
      value: describedStatus(status.clearStatusDescription, status.clearStatus),
    },
    {
      label: t('fields.paymentStatus'),
      value: describedStatus(status.paymentStatusDescription, status.paymentStatus),
    },
    {
      label: t('fields.deliveryStatus'),
      value: describedStatus(status.deliveryStatusDescription, status.deliveryStatus),
    },
    {
      label: t('fields.availabilityStatus'),
      value: describedStatus(status.availabilityStatusDescription, status.availabilityStatus),
    },
    {
      label: t('fields.acceptanceStatus'),
      value: describedStatus(status.acceptanceStatusDescription, status.acceptanceStatus),
    },
    {
      label: t('fields.approvalStatus'),
      value: describedStatus(status.approvalStatusDescription, status.approvalStatus),
    },
    { label: t('fields.consignmentStatus'), value: text(status.consignmentStatus) },
    { label: t('fields.controlStatus'), value: text(status.controlStatus) },
    { label: t('fields.notificationStatus'), value: text(status.notificationStatus) },
  ]
}

/**
 * The translator, passed in rather than imported.
 *
 * These builders stay pure functions of (document, t) — the zero-literal rule
 * means the labels must come from i18n, but reaching for the global `i18n.t`
 * here would bind them to module state and make them untestable in isolation.
 */
type TFn = (key: string, options?: Record<string, unknown>) => string
