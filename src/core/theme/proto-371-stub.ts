/* PROTOTYPE 371 — throwaway (branch prototype/371-delivery-details).
 *
 * Stub envelopes for the Delivery details record-page prototype. The headers are
 * the ticket-078 LIVE captures (redacted), overridden only where a case needs a
 * state no capture holds; Log and Outbox rows are synthesized from the action
 * codes in 369's evidence (no capture of either exists). All fictional.
 *
 * Lives in core/theme beside proto-362 because the fetch shim there consults it —
 * a prototype-only boundary bend; nothing in production imports this.
 */
import driverAssigned from '../../../.issues/assets/078-document-payloads/8000000121-driver-assigned.json'
import cancellationRequested from '../../../.issues/assets/078-document-payloads/8000000174-cancellation-requested.json'
import pickInStore from '../../../.issues/assets/078-document-payloads/8000000253-delivery.json'
import erx from '../../../.issues/assets/078-document-payloads/2000000551-erx.json'

type Doc = Record<string, unknown> & { status: Record<string, unknown>; lines: Record<string, unknown>[] }
type Log = {
  logNo: string
  documentNo: string
  entryTime: string
  entryUser: string
  actionType: string
  actionTypeDescription: string
  actionData: string
  actionOldData: string
  note: string
  staffId: string
  storeCode: string
}
type Job = {
  outboxId: string
  actionType: string
  actionTypeDescription: string
  documentNo: string
  documentCategory: string
  userId: string
  entryTime: string
  attemptCount: number
  lastAttemptTime: string
  nextAttemptTime: string
  outboxStatus: string
  errorMessage: string
}

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T
const data = (capture: { data: unknown }) => clone(capture.data) as Doc

function logs(documentNo: string, rows: [string, string, string, string, string?, string?][]): Log[] {
  return rows.map(([time, code, desc, user, note = '', actionData = ''], i) => ({
    logNo: String(i + 1),
    documentNo,
    entryTime: time,
    entryUser: user,
    actionType: code,
    actionTypeDescription: desc,
    actionData,
    actionOldData: '',
    note,
    staffId: '',
    storeCode: '',
  }))
}

function jobs(
  documentNo: string,
  rows: [string, string, string, number, string, string?, string?][],
): Job[] {
  return rows.map(([time, code, desc, attempts, status, error = '', next = ''], i) => ({
    outboxId: String(9100 + i),
    actionType: code,
    actionTypeDescription: desc,
    documentNo,
    documentCategory: 'D',
    userId: 'system',
    entryTime: time,
    attemptCount: attempts,
    lastAttemptTime: time,
    nextAttemptTime: next,
    outboxStatus: status,
    errorMessage: error,
  }))
}

const line = (n: number, item: string, desc: string, qty: number, unit: number, extra: Record<string, unknown> = {}) => {
  const net = Math.round(qty * unit * 100) / 100
  const vat = Math.round((net - net / 1.15) * 100) / 100
  return {
    lineNumber: n,
    itemNumber: item,
    itemDescription: desc,
    quantity: qty,
    uom: 'EA',
    unitPrice: unit,
    discount: 0,
    grossAmount: Math.round((net - vat) * 100) / 100,
    vatPercent: 15,
    vatAmount: vat,
    netAmount: net,
    confirmedQuantity: qty,
    deleted: false,
    needTransaction: false,
    needTransactionQty: 0,
    ...extra,
  }
}

const D = '2026-10-02T'

// ---- 1 · Out for delivery, two failed jobs, one retrying -------------------------
function outCase(): { doc: Doc; logs: Log[]; jobs: Job[] } {
  const no = '8000000300'
  const doc = data(driverAssigned)
  const rx = data(erx)
  const base = doc.lines[0]
  Object.assign(doc, {
    documentNo: no,
    orderNo: '1000000300',
    entryTime: `${D}09:15:00`,
    documentDate: `${D}09:15:00`,
    isExpressDelivery: true,
    approvalNumber: rx.approvalNumber,
    patientId: rx.patientId,
    approvalId: rx.approvalId,
    clinicianName: 'Dr. Demo Clinician',
    referenceErx: 'ERX-778104',
    courierCode: 'STARLINKS',
    courierDriverName: 'Demo driver 1',
    courierDriverPhone: '0590000011',
    courierDriverApproved: true,
    trackingUrl: 'https://example.invalid/track/8000000300',
    deliveryScheduleFromTime: `${D}10:00:00`,
    deliveryScheduleToTime: `${D}12:00:00`,
    timeSlotDescription: '10:00 - 12:00',
    note: 'Customer asked to call before arrival.',
    netTotal: 150.48,
    paidAmount: 20,
    amountDue: 130.48,
    deliveryFees: 0,
  })
  doc.lines = [
    { ...base, lineNumber: 1 },
    line(2, '200707', 'Travel care kit — demo', 1, 27.5),
    line(3, '200708', 'Cotton pads — demo', 2, 10),
    line(4, '300114', 'Prescription syrup 100 ml — demo', 1, 14.72, { deleted: true, needTransaction: true, referenceErxLine: 'ERX-778104/1' }),
  ]
  Object.assign(doc.status, {
    overallStatus: 'A',
    readyStatus: 'R',
    readyStatusDescription: 'Ready',
    deliveryStatus: 'O',
    deliveryStatusDescription: 'Out for delivery',
    closeStatus: '',
    closeStatusDescription: '',
    lastAction: 'DOFD',
    lastActionDescription: 'Out for delivery',
  })
  return {
    doc,
    logs: logs(no, [
      [`${D}09:15:12`, 'DCRT', 'Delivery created', 'call.center.07'],
      [`${D}09:16:40`, 'DADN', 'Note added', 'call.center.07', 'Customer asked to call before arrival.'],
      [`${D}09:30:05`, 'DRDY', 'Ready for delivery', 'store.p019', 'Items checked and packed'],
      [`${D}09:41:22`, 'DOFD', 'Out for delivery', 'system', '', 'Demo driver 1'],
    ]),
    jobs: jobs(no, [
      [`${D}09:15:13`, 'LMCO', 'LastMile — create order', 1, 'C'],
      [`${D}09:30:06`, 'SMSN', 'Notify customer (SMS)', 5, 'F', 'SMS gateway timeout after 30s'],
      [`${D}09:30:07`, 'SGHP', 'SGH — push order', 5, 'F', 'Customer not found in SGH (404)'],
      [`${D}09:41:23`, 'MGST', 'Magento — status push', 2, 'P', 'HTTP 503 Service Unavailable', `${D}09:47:23`],
    ]),
  }
}

// ---- 2 · Returned by driver, then rescheduled (the rewind) — capture as is ------
function rescheduledCase() {
  const doc = data(driverAssigned)
  const no = String(doc.documentNo)
  const t = String(doc.entryTime).slice(0, 11)
  return {
    doc,
    logs: logs(no, [
      [`${t}02:46:26`, 'DCRT', 'Delivery created', 'web'],
      [`${t}03:10:02`, 'DRDY', 'Ready for delivery', 'store.p019'],
      [`${t}03:40:51`, 'DOFD', 'Out for delivery', 'system', '', 'mohammed sartawi'],
      [`${t}05:12:09`, 'DRBK', 'Returned by driver', 'driver.app', 'Customer not answering'],
      [`${t}05:30:44`, 'DRSC', 'Rescheduled', 'call.center.02', 'Customer asked for evening', '8pm - 10 pm'],
    ]),
    jobs: jobs(no, [
      [`${t}02:46:27`, 'LMCO', 'LastMile — create order', 1, 'C'],
      [`${t}05:30:45`, 'LMCO', 'LastMile — create order', 1, 'C'],
    ]),
  }
}

// ---- 3 · Cancellation requested — capture as is --------------------------------
function cancelRequestedCase() {
  const doc = data(cancellationRequested)
  const no = String(doc.documentNo)
  const t = String(doc.entryTime).slice(0, 11)
  return {
    doc,
    logs: logs(no, [
      [`${t}10:02:00`, 'DCRT', 'Delivery created', 'web'],
      [`${t}10:20:31`, 'DRDY', 'Ready for delivery', 'store.p004'],
      [`${t}11:05:12`, 'DRCL', 'Cancellation requested', 'call.center.11', 'Customer changed their mind'],
    ]),
    jobs: jobs(no, [
      [`${t}10:02:01`, 'LMCO', 'LastMile — create order', 1, 'C'],
      [`${t}11:05:13`, 'LMCN', 'LastMile — cancel order', 3, 'P', 'Courier API rate limited (429)', `${t}11:12:00`],
    ]),
  }
}

// ---- 4 · Cancelled after Out for delivery (synthesized from #3) ------------------
function cancelledCase() {
  const doc = data(cancellationRequested)
  const no = '8000000301'
  Object.assign(doc, { documentNo: no, orderNo: '1000000301', entryTime: `${D}08:02:00` })
  Object.assign(doc.status, {
    overallStatus: 'C',
    readyStatus: 'R',
    deliveryStatus: 'O',
    deliveryStatusDescription: 'Out for delivery',
    closeStatus: 'C',
    closeStatusDescription: 'Closed',
    lastAction: 'DCLS',
    lastActionDescription: 'Closed',
  })
  return {
    doc,
    logs: logs(no, [
      [`${D}08:02:00`, 'DCRT', 'Delivery created', 'web'],
      [`${D}08:15:11`, 'DRDY', 'Ready for delivery', 'store.p004'],
      [`${D}08:40:03`, 'DOFD', 'Out for delivery', 'system'],
      [`${D}09:10:45`, 'DRCL', 'Cancellation requested', 'call.center.11', 'Wrong address, customer will reorder'],
      [`${D}09:15:02`, 'DCLS', 'Closed', 'AutoClose'],
    ]),
    jobs: jobs(no, [[`${D}08:02:01`, 'LMCO', 'LastMile — create order', 1, 'C']]),
  }
}

// ---- 5 · Pick-in-store, delivered — capture as is ------------------------------
function pickInStoreCase() {
  const doc = data(pickInStore)
  const no = String(doc.documentNo)
  const t = String(doc.entryTime).slice(0, 11)
  return {
    doc,
    logs: logs(no, [
      [`${t}13:00:10`, 'DCRT', 'Delivery created', 'app'],
      [`${t}13:00:11`, 'DRDY', 'Ready for delivery', 'system'],
      [`${t}17:42:30`, 'DDLR', 'Delivered', 'store.p012', 'Collected by customer'],
    ]),
    jobs: jobs(no, [[`${t}17:42:31`, 'SMSN', 'Notify customer (SMS)', 1, 'C']]),
  }
}

export const CASES = [
  { key: 'out', label: 'Out for delivery · 2 failed jobs', proves: 'per-job banners, a retrying P row, e-Rx, deleted line, due tag', make: outCase },
  { key: 'resched', label: 'Returned → rescheduled (capture)', proves: 'rewind marker: current position + marker, path in the feed', make: rescheduledCase },
  { key: 'cancelreq', label: 'Cancellation requested (capture)', proves: 'amber final step; C is refused with its reason', make: cancelRequestedCase },
  { key: 'cancelled', label: 'Cancelled after out', proves: 'red step replaces Delivered, later steps dropped', make: cancelledCase },
  { key: 'pis', label: 'Pick-in-store delivered (capture)', proves: 'no Out step; completed timeline', make: pickInStoreCase },
] as const

const BUILT = CASES.map((c) => ({ key: c.key, ...c.make() }))

/** The delivery number each case is served under — what the route carries. */
export const CASE_NUMBERS: Record<string, string> = Object.fromEntries(
  BUILT.map((c) => [c.key, String(c.doc.documentNo)]),
)

/** The stub answer for a path, or `undefined` to let proto-362's generic stub run. */
export function stub371(path: string): unknown {
  const doc = /^SdDocumentWeb\/(?:Delivery|Document)\/([^/]+)$/.exec(path)
  if (doc) return BUILT.find((c) => String(c.doc.documentNo) === doc[1])?.doc
  const sub = /^SdDocumentWeb\/Document\/([^/]+)\/(Logs|Outbox)$/.exec(path)
  if (sub) {
    const c = BUILT.find((x) => String(x.doc.documentNo) === sub[1])
    return c ? (sub[2] === 'Logs' ? c.logs : c.jobs) : undefined
  }
  if (path === 'Slots/RescheduleReasons')
    return [
      { reasonCode: '01', reasonCategory: 'C', reasonDescription: 'Customer request' },
      { reasonCode: '02', reasonCategory: 'S', reasonDescription: 'Store delay' },
    ]
  if (path.startsWith('Slots/AvailableSlots/')) return { slots: [] }
  if (/^SdDocument\/(StoreDetails|AddressLabels|Districts)$/.test(path)) return []
  return undefined
}
