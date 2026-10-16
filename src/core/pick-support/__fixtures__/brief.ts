// The Pick support fixtures, copied from BackOffice brief 2691's JSON examples (the brief's
// "…" placeholders filled with plain sentences). The drive (`tools/pick-support-drive.mjs`)
// stubs the same shapes.

import type {
  PickDocumentModel,
  PickSupportDiagnosis,
  PickSupportDonorRequest,
  PickSupportResolution,
  PickSupportTimelineEntry,
} from '@/core/models/pick-support'

export const FLOOR = '0001-01-01T00:00:00'

export function timelineEntry(over: Partial<PickSupportTimelineEntry> = {}): PickSupportTimelineEntry {
  return {
    at: '2026-10-01T10:12:40',
    source: 'DONOR_REQUEST',
    key: 'DR0000123',
    seq: 0,
    eventType: 'RAISE',
    actor: '1112-ph01',
    approvedBy: '',
    reason: '',
    complaintRef: '',
    detail: '',
    reconstructed: false,
    ...over,
  }
}

export function donorRequest(over: Partial<PickSupportDonorRequest> = {}): PickSupportDonorRequest {
  return {
    requestNo: 'DR0000123',
    deliveryNo: '8006777365',
    orderStore: '1112',
    donorStore: '1207',
    state: 'TRANSFERRED',
    outcome: '',
    outcomeReason: '',
    outcomeBy: '',
    outcomeAt: FLOOR,
    raisedBy: '1112-ph01',
    raisedAt: '2026-10-01T10:12:40',
    changedBy: '',
    changedAt: FLOOR,
    fulfilledAt: '2026-10-01T10:40:00',
    lockedBy: '',
    lockedAt: FLOOR,
    transferStoNo: '4500001234',
    transferSapDocumentNo: '4900000077',
    transferredAt: '2026-10-01T11:00:00',
    picked: 2,
    required: 2,
    documentNo: 'PD0000999',
    documentState: 'COMPLETE',
    documentRevision: 1,
    documentVoidReason: '',
    unitsPicked: 2,
    reference: 'DNR:DR0000123',
    lines: [],
    ...over,
  }
}

export function pickDocument(over: Partial<PickDocumentModel> = {}): PickDocumentModel {
  return {
    documentNo: 'PD0001234',
    sourceType: 'OMS',
    sourceKey: '8006777365',
    storeCode: '1112',
    state: 'VOIDED',
    revision: 2,
    voidReason: 'STORE_CHANGE',
    createdAt: '2026-10-01T09:00:00',
    createdBy: '1112-ph01',
    lastPickAt: '2026-10-01T09:30:00',
    lastPickBy: '1112-ph01',
    confirmedAt: FLOOR,
    confirmedBy: '',
    consumedByStore: '',
    consumedByTrx: '',
    confirmMode: '',
    picked: 1,
    required: 3,
    lines: [],
    ...over,
  }
}

/** The brief's diagnosis example: STUCK in DONOR_AT_OLD_ORDER_STORE. */
export function stuckDiagnosis(): PickSupportDiagnosis {
  return {
    deliveryNo: '8006777365',
    orderNo: '1000456789',
    currentStore: '1139',
    readyStatus: '',
    closeStatus: '',
    verdict: 'STUCK',
    refusalText: 'Picking document PD0000999 belongs to store 1112.',
    storeHistory: [
      {
        at: '2026-10-02T14:03:11',
        by: 'agent01',
        documentNo: '8006777365',
        actionType: 'DCST',
        fromStore: '1112',
        toStore: '1139',
      },
    ],
    documents: [pickDocument()],
    donorRequests: [donorRequest()],
    shapes: [
      {
        shape: 'DONOR_AT_OLD_ORDER_STORE',
        explanationEn: 'Delivery 8006777365 was moved to store 1139, but the picking document of donor request DR0000123 is still tied to its old order store.',
        explanationAr: 'نُقل التوصيل 8006777365 إلى الفرع 1139.',
        fixEn: 'End the donor document as the store change would have.',
        fixAr: 'أنهِ مستند المتبرع.',
        tellTheStoreEn:
          'Store 1139: void the open invoice of delivery 8006777365, re-open the order from the worklist, and pick every line from your own shelf.',
        tellTheStoreAr: 'الفرع 1139: ألغِ الفاتورة المفتوحة للتوصيل 8006777365',
        requests: [
          {
            requestNo: 'DR0000123',
            documentNo: 'PD0000999',
            orderStore: '1112',
            donorStore: '1207',
            state: 'TRANSFERRED',
            action: 'CLOSE_TRANSFERRED_OUT',
          },
        ],
        documents: [],
      },
    ],
    timeline: [timelineEntry({ reconstructed: true })],
    copy: { text: 'Pick support - delivery 8006777365\nVerdict: STUCK\n', json: '{\n  "deliveryNo": "8006777365"\n}' },
  }
}

/** The brief's Resolve example: one delivery, no serials. */
export function oneDeliveryResolution(): PickSupportResolution {
  return {
    key: '8006777365',
    matched: true,
    messageEn: null,
    messageAr: null,
    deliveries: [
      {
        deliveryNo: '8006777365',
        orderNo: '1000456789',
        currentStore: '1139',
        closeStatus: '',
        matchedBy: ['DELIVERY'],
        shapes: ['DONOR_AT_OLD_ORDER_STORE'],
      },
    ],
    serials: [],
  }
}
