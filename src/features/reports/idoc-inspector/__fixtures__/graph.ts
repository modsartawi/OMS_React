/**
 * Builders for an `IDocInspector/Transaction` payload (ticket 297's tests).
 *
 * ⚠️ **Shaped by hand, not captured.** BackOffice 1388 — the route that serves
 * this graph — is open, so there is no real response to record. These builders
 * are therefore the client's reading of the spec's shape and nothing more; what
 * they cannot prove is that the server sends it. That proof lives in 1388's own
 * `Data.Tests` fixtures, and the day the door is built the first drive against
 * it is what reconciles the two.
 *
 * Every field is defaulted so a test names only what it is about.
 */
import type {
  IDocInspectorCondition,
  IDocInspectorDocument,
  IDocInspectorLine,
  IDocInspectorTransaction,
} from '@/core/models/idoc-inspector'

export function aCondition(over: Partial<IDocInspectorCondition> = {}): IDocInspectorCondition {
  return {
    seq: 1,
    conditionType: 'ZPR0',
    conditionTypeDescription: 'Base price',
    conditionRate: 11.5,
    conditionValue: 23,
    conditionClass: 'B',
    conditionControl: 'A',
    discTypeCode: '',
    sourceTag: 'pos',
    conditionSource: 'B',
    ...over,
  }
}

export function aLine(over: Partial<IDocInspectorLine> = {}): IDocInspectorLine {
  return {
    itemNumber: 1,
    itemTypeCode: 'ZTAN',
    materialNumber: '1000174',
    quantity: 2,
    salesUom: 'EA',
    salesAmount: 23,
    promotionId: '',
    batch: 'B24A917',
    isReturn: false,
    sourceTag: 'pos',
    conditions: [aCondition()],
    itemDetails: [{ seq: 1, attributeName: 'BATCH', attributeValue: 'B24A917' }],
    ...over,
  }
}

export function aDocument(over: Partial<IDocInspectorDocument> = {}): IDocInspectorDocument {
  return {
    idocType: 'AGG',
    receiptNumber: '4211900771',
    pharmacyId: '0421',
    billingType: 'ZAGG',
    paymentGroupId: '01',
    splitAmount: 95.4,
    splitRatio: 1,
    exportState: 'exported',
    batch: { id: 'K7QF2M8ZR41X9S042S_AGG', exportedAt: '2026-08-27T03:10:00' },
    lines: [aLine()],
    payments: [
      {
        seq: 1,
        conditionType: 'CASH',
        typeCode: '3301',
        cardType: '',
        authorizationNo: '',
        amount: 95.4,
      },
    ],
    fiItems: [],
    ...over,
  }
}

export function anFiDocument(over: Partial<IDocInspectorDocument> = {}): IDocInspectorDocument {
  return aDocument({
    idocType: 'FI',
    billingType: 'ZFI',
    lines: [],
    payments: [],
    fiItems: [
      {
        fiTypeNumber: '1',
        glAccount: '410010',
        profitCenter: 'PC0421',
        fiTypeCode: '1302',
        assignment: 'TRX99881',
        amount: 82.96,
      },
    ],
    ...over,
  })
}

export function aTransaction(
  over: Partial<IDocInspectorTransaction> = {},
): IDocInspectorTransaction {
  return { verdict: 'Processed', attention: null, documents: [aDocument()], ...over }
}
