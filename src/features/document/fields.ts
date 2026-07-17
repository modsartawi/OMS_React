/**
 * Pure builders mapping a loaded document onto the read-only label/value rows of
 * the Screen 2 header groups and the Status tab.
 */
import type {
  SdDocumentAddressModel,
  SdDocumentHeaderModel,
  SdDocumentHeaderStatusModel,
} from '@/core/models/sd-document'
import { formatLongDate } from '@/core/util/date-format'
import { formatMoney } from '@/core/util/number-format'

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

/**
 * The header "Document" group. Approval Number and Prescription are appended
 * only when non-empty; Prescription renders as an external link.
 */
export function documentGroupRows(doc: SdDocumentHeaderModel, t: TFn): FieldRow[] {
  const rows: FieldRow[] = [
    { label: t('fields.documentNo'), value: text(doc.documentNo) },
    { label: t('fields.refDocumentNo'), value: text(doc.refDocumentNo) },
    { label: t('fields.orderNo'), value: text(doc.orderNo) },
    { label: t('fields.date'), value: formatLongDate(doc.documentDate) },
    { label: t('fields.pharmacy'), value: text(doc.storeCode) },
    { label: t('fields.slotDay'), value: text(doc.timeSlotDay) },
    { label: t('fields.slotTime'), value: text(doc.timeSlotDescription) },
    { label: t('fields.netTotal'), value: formatMoney(doc.netTotal) },
    { label: t('fields.deliveryFees'), value: formatMoney(doc.deliveryFees) },
    { label: t('fields.paidAmount'), value: formatMoney(doc.paidAmount) },
    { label: t('fields.amountDue'), value: formatMoney(doc.amountDue) },
    { label: t('fields.deliveryDocType'), value: text(doc.deliveryDocumentTypeDescription) },
    { label: t('fields.dawaaNow'), value: doc.isExpressDelivery ? t('common:yes') : t('common:no') },
    { label: t('fields.lastNote'), value: text(doc.note) },
  ]

  const approvalNumber = text(doc.approvalNumber)
  if (approvalNumber) rows.push({ label: t('fields.approvalNumber'), value: approvalNumber })

  const prescriptionUrl = text(doc.prescriptionUrl)
  if (prescriptionUrl)
    rows.push({
      label: t('fields.prescription'),
      value: t('fields.viewPrescription'),
      href: prescriptionUrl,
    })

  return rows
}

/**
 * The header "Status" summary group. Overall Status binds the RAW
 * `status.overallStatus` — the WPF bound a non-existent
 * `overallStatusDescription` and so rendered nothing at all (Appendix B bug 3).
 */
export function statusSummaryRows(doc: SdDocumentHeaderModel, t: TFn): FieldRow[] {
  const status = doc.status
  return [
    { label: t('fields.overallStatus'), value: text(status?.overallStatus) },
    {
      label: t('fields.lastAction'),
      value: describedStatus(status?.lastActionDescription, status?.lastAction),
    },
    {
      label: t('fields.readyStatus'),
      value: describedStatus(status?.readyStatusDescription, status?.readyStatus),
    },
    {
      label: t('fields.deliveryStatus'),
      value: describedStatus(status?.deliveryStatusDescription, status?.deliveryStatus),
    },
  ]
}

/** The header "Customer" group. */
export function customerRows(doc: SdDocumentHeaderModel, t: TFn): FieldRow[] {
  const customer = doc.customer
  return [
    { label: t('fields.loyaltyId'), value: text(customer?.customerId) },
    { label: t('fields.loyaltyMobile'), value: text(customer?.customerPhone) },
    { label: t('fields.loyaltyName'), value: text(customer?.customerName) },
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
