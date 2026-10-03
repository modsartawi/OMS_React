/**
 * Pure builders mapping a loaded document onto the read-only rows of Screen 2 —
 * the light header's sub-ids, the summary rail's five cards, and the header's
 * All-statuses disclosure.
 */
import type {
  SdDocumentAddressModel,
  SdDocumentHeaderModel,
  SdDocumentHeaderStatusModel,
} from '@/core/models/sd-document'
import { deliveryWindow } from '@/core/oms/delivery-window'
import { formatPair } from '@/core/util/bidi'
import { formatLongDate, formatTimeOfDay } from '@/core/util/date-format'
import { formatMoney } from '@/core/util/number-format'

/**
 * One label/value row of the All-statuses disclosure, where a blank `value`
 * renders as an em dash because a disclosure's job is completeness. The summary
 * rail's cards use `CardRow` below, which omits a blank row instead.
 */
export interface FieldRow {
  label: string
  value: string
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

// The header "Document" and "Customer" groups left with ticket 091, and the
// "Status" summary group with 090. Identity — the document number and its
// sub-ids — is the light header's job (spec 380 D2, ticket 402, which dropped the
// identity band's customer block and the pill rail); the money, e-Rx,
// fulfilment, driver and payment fields are the summary rail's cards (092), and
// the thirteen status rows keep their home in the header's All-statuses
// disclosure, which `statusBreakdownRows` below still builds. Overall Status
// keeps binding the RAW `status.overallStatus`: the WPF bound a non-existent
// `overallStatusDescription` and so rendered nothing at all (Appendix B bug 3).

/** One sub-id on the header's second line. */
export interface HeaderSubId {
  /** The payload field this row reports. */
  key: 'orderNo' | 'documentType' | 'deliveryDocumentType' | 'placed' | 'storeCode' | 'refDocumentNo'
  label: string
  value: string
  /** Render `value` in mono: it is an ID or a code, not a word (F24; the D-3 echo test). */
  isCode: boolean
}

/**
 * The header's echo test: whether a `*Description` says nothing its code did not.
 *
 * **Exact**, not case-insensitive, and the corpus is why:
 * `documentTypeDescription: 'Cash'` against `documentType: 'CASH'` is a resolved
 * *word*, and the header prints the word. Only a description that is blank or
 * byte-identical to its code (`'NUPP'`, `'ORRT'` — 2 of 5 captures) falls back to
 * the raw code and renders in mono.
 */
function isHeaderCodeEcho(description: string, code: string | null | undefined): boolean {
  return !description || description === text(code)
}

/**
 * The header's sub-ids (spec 380 D2): order no., type, delivery doc, placed,
 * store and document no., in that order.
 *
 * The order no., the store and the document no. are IDs and always render in
 * mono. A description falls back to its code, and an echo (`isHeaderCodeEcho`)
 * is flagged so it renders in mono too. A row the document does not carry is
 * **omitted** rather than em-dashed (083 D-5): `deliveryDocumentType` is `null`
 * on the e-Rx capture, and an absent sub-id is not a fact worth a dash.
 *
 * "Placed" is one row built from two fields — the calendar date from
 * `documentDate`, the clock time from `entryTime`. The document no. is
 * `refDocumentNo`: on a delivery the big number is the delivery's own
 * `documentNo`, and this is the sales document it delivers (the list's
 * Document No).
 */
export function headerSubIds(doc: SdDocumentHeaderModel, t: TFn): HeaderSubId[] {
  const rows: HeaderSubId[] = []

  const push = (key: HeaderSubId['key'], label: string, value: string, isCode = false): void => {
    if (value) rows.push({ key, label, value, isCode })
  }
  const pushCoded = (
    key: HeaderSubId['key'],
    label: string,
    description: string | null | undefined,
    code: string | null | undefined,
  ): void => {
    const resolved = text(description)
    push(key, label, resolved || text(code), isHeaderCodeEcho(resolved, code))
  }

  push('orderNo', t('header.orderNo'), text(doc.orderNo), true)
  pushCoded('documentType', t('header.documentType'), doc.documentTypeDescription, doc.documentType)
  pushCoded(
    'deliveryDocumentType',
    t('header.deliveryDocumentType'),
    doc.deliveryDocumentTypeDescription,
    doc.deliveryDocumentType,
  )
  push(
    'placed',
    t('header.placed'),
    formatPair(formatLongDate(doc.documentDate), formatTimeOfDay(doc.entryTime)),
  )
  push('storeCode', t('header.store'), text(doc.storeCode), true)
  push('refDocumentNo', t('header.refDocumentNo'), text(doc.refDocumentNo), true)

  return rows
}

/**
 * The header's Overall tag value: the RAW `status.overallStatus`, blank when the
 * document carries none — and blank means **no tag**, on 3 of the 5 captured
 * documents. There is no `overallStatusDescription` on the payload, which is why
 * this one renders as a labelled mono code rather than a word.
 */
export function overallStatusCode(doc: SdDocumentHeaderModel): string {
  return text(doc.status?.overallStatus)
}

/**
 * Whether the document carries an e-Rx: any of the five prescription facts on
 * the payload, the same five that draw the Prescription (e-Rx) card
 * (`railCards`). The card's Files row is deliberately not one of them: an
 * uploaded file is a photo of a prescription, not an e-Rx, so an order whose
 * card holds only Files gets no e-Rx tag.
 */
export function carriesPrescription(doc: SdDocumentHeaderModel): boolean {
  return [doc.approvalNumber, doc.patientId, doc.clinicianName, doc.referenceErx, doc.prescriptionUrl].some(
    (value) => text(value) !== '',
  )
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

// ─── The summary rail's five cards (spec 083 D-5 to D-8, ticket 092) ──────────
//
// The three equal-weight header groups and the standalone address panel are gone;
// what they carried is re-cut here into five cards. `FieldGroup`'s em dash goes
// with them: inside a card that renders, **money and boolean rows always render
// (`0.00` and `No` are answers) and a blank text row is omitted** — one rule for
// the whole rail (D-5), so a card shows what is true rather than a column of
// dashes to read past.

/** One row inside a rail card. Only rows that survive D-5 reach the component. */
export interface CardRow {
  /** The payload field this row reports — and the rendered list's React key. */
  key: string
  label: string
  value: string
  /** Tabular figures: the value is a number or a code, not a word. */
  numeric?: boolean
  /** Quieter ink: free text an operator scans, not a value they quote. */
  soft?: boolean
  /** When set, the value renders as an external link opening in a new tab. A row has this or `action`, never both. */
  href?: string
  /** When set, a button after the value runs it (ticket 328). A row has this or `href`, never both. */
  action?: CardAction
  /** The card's closing line — `netTotal`, the one figure that gets weight. */
  total?: boolean
}

/** A card row's in-page action: the words of its button, and what pressing it does. */
export interface CardAction {
  /** The button's visible word. */
  label: string
  /** What the button does, for a screen reader: the visible word alone says too little. */
  ariaLabel: string
  onSelect: () => void
}

/**
 * The order's files as the page reads them, for the Prescription card's Files row (spec 324,
 * ticket 328). The page computes all three; `railCards` never reads the probe.
 */
export interface RailFiles {
  /** The Attachments tab's number — the badge's `attachmentsBadgeCount`, `null` for none. */
  count: number | null
  /** Would the Attachments tab be drawn (`attachmentsTabGate`)? */
  allowed: boolean
  /** Select the Attachments tab — on a first selection that starts its one read. */
  onShow: () => void
}

/** One card on the summary rail. A collapsed card is absent from the array. */
export interface RailCard {
  key: 'customer' | 'prescription' | 'fulfilment' | 'driver' | 'payment'
  title: string
  rows: CardRow[]
}

/**
 * The delivery-type map — exactly two entries, which the model's own comment
 * verifies (`'D'` Delivery / `'P'` PickInStore). An unrecognised code renders
 * raw rather than vanishing: the 406 precedent is that a client-side map which
 * silently swallows a value is worse than the value.
 */
const DELIVERY_TYPES: Record<string, string> = { D: 'delivery', P: 'pickInStore' }

/**
 * The Customer card's address line: `shortAddress` → `street1`/`street2` →
 * `districtName`. Every step is the only thing present on some captured document,
 * and the whole chain optional-chains a `shippingAddress` that is typed `| null`
 * — so `tsc` is the null-address test.
 *
 * Blank is the answer for a document with no delivery address, and it renders as
 * **no row and no marker** (D-6): the one null-address capture is a pickup, where
 * having no address is correct rather than missing. An address object whose every
 * field is `''` takes this identical path.
 */
export function addressFallback(address: SdDocumentAddressModel | null | undefined): string {
  const short = text(address?.shortAddress)
  if (short) return short
  const street = [text(address?.street1), text(address?.street2)].filter(Boolean).join(', ')
  if (street) return street
  return text(address?.districtName)
}

/**
 * The Payment card's instrument row (D-8). Coded `paymentType` is `'C'` on all
 * five captures — one value, no companion, no map worth writing; the real
 * instrument rides on a header-level condition carrying `cardType: 'Visa'` and
 * `paymentMethod: 'ApplePay'`, already server-resolved and human-readable.
 *
 * The scan is for those **fields**, never for a `condType`: on both captures they
 * ride the `DFEE` (delivery fees) condition, which is plainly incidental and
 * breaks the first time it moves. Falls back to the raw `paymentType`, and blank
 * omits the row.
 */
export function paymentInstrument(doc: SdDocumentHeaderModel): string {
  const carrier = (doc.conditions ?? []).find(
    (condition) => text(condition.cardType) || text(condition.paymentMethod),
  )
  if (carrier) return [text(carrier.paymentMethod), text(carrier.cardType)].filter(Boolean).join(' · ')
  return text(doc.paymentType)
}

/**
 * The summary rail (D-6): the cards that render, in the rail's reading order.
 *
 * Customer, Fulfilment and Payment always render — an empty Customer card is
 * itself the finding, not a reason to hide the identity anchor. Prescription
 * collapses when all five of its fields are blank (an over-the-counter order) and
 * Driver & tracking when the courier, the driver's name and the tracking id are
 * all blank; a collapsed card is **absent**, not an empty frame on the rail.
 *
 * `files` (spec 324, ticket 328) adds the Prescription card's **Files · N · Show** row,
 * last, only when the tab would be drawn AND N > 0 — so an order with files and no
 * other prescription fact still shows the card, on that row alone.
 */
export function railCards(doc: SdDocumentHeaderModel, t: TFn, files?: RailFiles): RailCard[] {
  const cards: RailCard[] = []

  /** Collect the rows that survive D-5: money and booleans always, text if set. */
  const rowsOf = (candidates: (CardRow | null)[]): CardRow[] =>
    candidates.filter((row): row is CardRow => row !== null && row.value !== '')

  const textRow = (key: string, label: string, value: string, extra?: Partial<CardRow>): CardRow =>
    ({ key, label, value, ...extra })
  // A money row always renders — `0.00` is an answer. What it will not do is
  // fabricate one: a non-numeric amount formats blank and the row drops, rather
  // than asserting a zero the server never sent.
  const moneyRow = (key: string, label: string, value: number, extra?: Partial<CardRow>): CardRow =>
    ({ key, label, value: formatMoney(value), numeric: true, ...extra })
  const boolRow = (key: string, label: string, value: boolean): CardRow =>
    ({ key, label, value: value ? t('cards.yes') : t('cards.no') })

  const address = doc.shippingAddress
  cards.push({
    key: 'customer',
    title: t('cards.customer'),
    rows: rowsOf([
      textRow('name', t('cards.name'), text(doc.customer?.customerName)),
      textRow('mobile', t('cards.mobile'), text(doc.customer?.customerPhone), { numeric: true }),
      textRow('loyaltyId', t('cards.loyaltyId'), text(doc.customer?.customerId) || text(doc.customerId), {
        numeric: true,
      }),
      textRow('city', t('cards.city'), text(address?.cityName)),
      textRow('address', t('cards.address'), addressFallback(address), { soft: true }),
    ]),
  })

  const prescription = rowsOf([
    textRow('approvalNumber', t('cards.approvalNumber'), text(doc.approvalNumber), { numeric: true }),
    textRow('patientId', t('cards.patientId'), text(doc.patientId), { numeric: true }),
    textRow('clinicianName', t('cards.clinician'), text(doc.clinicianName)),
    textRow('referenceErx', t('cards.referenceErx'), text(doc.referenceErx), { numeric: true }),
    text(doc.prescriptionUrl)
      ? textRow('prescriptionUrl', t('cards.rxDocument'), t('cards.view'), {
          href: text(doc.prescriptionUrl),
        })
      : null,
    filesRow(files, t),
  ])
  if (prescription.length > 0) {
    cards.push({ key: 'prescription', title: t('cards.prescription'), rows: prescription })
  }

  const deliveryType = text(doc.deliveryType)
  const mapped = DELIVERY_TYPES[deliveryType.toUpperCase()]
  cards.push({
    key: 'fulfilment',
    title: t('cards.fulfilment'),
    rows: rowsOf([
      textRow(
        'deliveryType',
        t('cards.deliveryType'),
        mapped ? t(`cards.deliveryTypes.${mapped}`) : deliveryType,
        { numeric: !mapped },
      ),
      textRow('store', t('cards.store'), text(doc.storeCode), { numeric: true }),
      textRow('window', t('cards.window'), deliveryWindow(doc), { numeric: true }),
      textRow('note', t('cards.note'), text(doc.note), { soft: true }),
    ]),
  })

  // `courierDriverMasterPinCode` is never rendered. It is genuinely populated
  // (`"1234"`) — and a delivery credential does not belong on a back-office
  // screen (D-6).
  const trackingId = text(doc.trackingId)
  const trackingUrl = text(doc.trackingUrl)
  const collapseDriver = !text(doc.courierDriverName) && !text(doc.courierCode) && !trackingId
  if (!collapseDriver) {
    cards.push({
      key: 'driver',
      title: t('cards.driver'),
      rows: rowsOf([
        textRow('courierCode', t('cards.courier'), text(doc.courierCode), { numeric: true }),
        textRow('courierDriverName', t('cards.driverName'), text(doc.courierDriverName)),
        textRow('courierDriverPhone', t('cards.driverPhone'), text(doc.courierDriverPhone), {
          numeric: true,
        }),
        boolRow('courierDriverApproved', t('cards.driverApproved'), doc.courierDriverApproved === true),
        textRow('trackingId', t('cards.tracking'), trackingId, {
          numeric: true,
          // The id is the value with or without a link — a tracking number an
          // operator can quote is worth a row on its own (`9000000003` carries
          // one and no URL).
          ...(trackingUrl ? { href: trackingUrl } : {}),
        }),
      ]),
    })
  }

  cards.push({
    key: 'payment',
    title: t('cards.payment'),
    rows: rowsOf([
      textRow('instrument', t('cards.instrument'), paymentInstrument(doc)),
      moneyRow('deliveryFees', t('cards.deliveryFees'), doc.deliveryFees),
      moneyRow('paidAmount', t('cards.paid'), doc.paidAmount),
      moneyRow('amountDue', t('cards.amountDue'), doc.amountDue),
      moneyRow('netTotal', t('cards.netTotal'), doc.netTotal, { total: true }),
    ]),
  })

  return cards
}

/**
 * The Prescription card's **Files · N · Show** row (spec 324, ticket 328), or `null`.
 *
 * N is the tab's own number, handed in (never a second count). The row needs the tab's
 * gate AND N > 0: an absent count (`null`) or `0` is no row. It carries an `action` —
 * Show selects the tab — and never an `href`: there is no URL for a tab (no deep link).
 */
function filesRow(files: RailFiles | undefined, t: TFn): CardRow | null {
  if (!files?.allowed || files.count === null || files.count <= 0) return null
  return {
    key: 'files',
    label: t('cards.files'),
    value: String(files.count),
    numeric: true,
    action: { label: t('cards.show'), ariaLabel: t('cards.showFiles'), onSelect: files.onShow },
  }
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
export type TFn = (key: string, options?: Record<string, unknown>) => string
