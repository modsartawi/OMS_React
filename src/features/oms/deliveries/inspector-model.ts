/**
 * What the Delivery inspector shows for one list row (ticket 397, spec 380 L13; ruling 367 §1–§2).
 *
 * 🚩 **The row, and nothing else.** No request, ever, so stepping through rows with J/K is free.
 * Items, the activity feed and job details are Delivery details'; the failed-jobs banner says
 * how many jobs failed and never which.
 *
 * 🚩 **`customerOtp` is never read here.** It is a handover secret, and the inspector is the
 * always-on panel that would show it for every row stepped through.
 *
 * Values are formatted here and isolated by the pane: a slot, a courier line and a reschedule
 * line are each ONE string (`formatPair`), so the pane isolates each once (378 §3).
 */
import type { DeliveryDocumentModel } from '@/core/models/delivery-document'
import { hasScheduledWindow, slotDayAndWindow } from '@/core/oms/delivery-window'
import { dueTag, timeline, timelineInputFromRow, timelineNow, type TimelineStep, type TimelineStepKey } from '@/core/oms/timeline'
import { formatPair } from '@/core/util/bidi'
import { formatDateTime } from '@/core/util/date-format'
import { formatMoney } from '@/core/util/number-format'

/**
 * One value and its kind, for the pane to isolate once (bidi rule): `machine` — led by a
 * machine value, one `Ltr`; otherwise free text, one `<bdi>`.
 */
export interface IsolatedValue {
  text: string
  machine: boolean
}

export interface InspectorView {
  header: {
    deliveryNo: string
    orderNo: string
    documentNo: string
    /** Where it stands now: the Status column's word. */
    status: TimelineStepKey
    /** Descriptions, as the list sends them. */
    documentType: string
    deliveryType: string
    /** Dawaa Now — express delivery. */
    dawaaNow: boolean
    due: ReturnType<typeof dueTag>
  }
  /** The inspector variant of the shared timeline (D1). */
  steps: TimelineStep[]
  /** How many jobs failed, when any did — the banner's only content. */
  failedJobs: number | null
  customer: { name: string; mobile: string; address: string }
  fulfilment: {
    storeCode: string
    notActiveInStore: boolean
    /**
     * `02 Oct 2026 · 10:00–12:00` from the schedule (machine), else the slot's own day and text
     * (free text). The next step's expectation reads the same source, so it takes this kind.
     */
    slot: IsolatedValue
    /** The reason (free text), and when and who as one value led by the time. */
    rescheduled: { reason: string; by: string } | null
    source: string
    /** `JAH · Khalid N.`, led by the code (machine); a driver with no code is free text. */
    courier: IsolatedValue
  }
  money: { net: string; paid: string; fees: string; due: string; owing: boolean }
  note: string
  /** Delivery details for this row, or `null` when the row has no delivery no. */
  openTo: string | null
}

const text = (value: string | null | undefined) => (value ?? '').trim()

/** Delivery details for a row (Enter, a double-click, Open full record), or `null` without a delivery no. */
export function detailsPathOf(row: DeliveryDocumentModel): string | null {
  const deliveryNo = text(row.deliveryNo)
  return deliveryNo ? `/oms/delivery/${deliveryNo}` : null
}

export function inspectorView(row: DeliveryDocumentModel): InspectorView {
  const steps = timeline(timelineInputFromRow(row))
  const due = dueTag(row.amountDue)
  return {
    header: {
      deliveryNo: text(row.deliveryNo),
      orderNo: text(row.orderNo),
      documentNo: text(row.documentNo),
      status: timelineNow(steps).key,
      documentType: text(row.documentType),
      deliveryType: text(row.deliveryType),
      dawaaNow: row.isExpressDelivery === true,
      due,
    },
    steps,
    failedJobs: typeof row.failedJobsCount === 'number' && row.failedJobsCount > 0 ? row.failedJobsCount : null,
    customer: {
      name: text(row.customerName),
      mobile: text(row.customerPhone),
      // Free text in either script, isolated once as a whole by the pane.
      address: [row.street1, row.districtName, row.cityName].map(text).filter(Boolean).join(', '),
    },
    fulfilment: {
      storeCode: text(row.storeCode),
      notActiveInStore: row.isActiveInStore === false,
      slot: { text: slotDayAndWindow(row), machine: hasScheduledWindow(row) },
      rescheduled: row.rescheduled
        ? { reason: text(row.rescheduledReason), by: formatPair(formatDateTime(row.rescheduledTime), text(row.rescheduledUser)) }
        : null,
      source: text(row.documentSource),
      courier: {
        text: formatPair(text(row.courierCode), text(row.courierDriverName)),
        machine: text(row.courierCode) !== '',
      },
    },
    money: {
      net: formatMoney(row.netTotal),
      paid: formatMoney(row.paidAmount),
      fees: formatMoney(row.deliveryFees),
      due: formatMoney(row.amountDue),
      owing: !due.paid,
    },
    note: text(row.note),
    openTo: detailsPathOf(row),
  }
}
