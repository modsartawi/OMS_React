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
  IDocInspectorMetadata,
  IDocInspectorDocument,
  IDocInspectorLine,
  IDocInspectorTransaction,
} from '@/core/models/idoc-inspector'

export function aCondition(over: Partial<IDocInspectorCondition> = {}): IDocInspectorCondition {
  return {
    seq: 1,
    conditionType: 'ZPR0',
    conditionTypeDescription: 'Base price',
    // 🔑 Arithmetic that actually holds: 200.00 × 11.5% = 23.00. A fixture whose
    // base, rate and value disagree would make a real projection bug look normal.
    conditionBaseValue: 200,
    conditionRate: 11.5,
    conditionRateUnit: '%',
    conditionValue: 23,
    conditionClass: 'B',
    conditionControl: 'A',
    // ⚠️ `false` by default and asked for explicitly: a post condition is a
    // real, ordinary thing, but it is the tinted one — so it must never arrive on
    // a fixture by accident and make the highlight look broken.
    isPostCondition: false,
    // ⚠️ A REAL mapping. An empty `discTypeCode` means *no SAP mapping was found*
    // and is a defect (ticket 300), so it must be asked for explicitly rather
    // than arriving by default on every fixture condition.
    discTypeCode: '3301',
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
    batchNumber: 'B24A917',
    isReturn: false,
    isPostItem: false,
    sourceTag: 'pos',
    conditions: [aCondition()],
    itemDetails: [{ seq: 1, attributeName: 'BATCH', attributeValue: 'B24A917' }],
    ...over,
  }
}

export function aDocument(over: Partial<IDocInspectorDocument> = {}): IDocInspectorDocument {
  return {
    iDocType: 'AGG',
    // ⚠️ A real member of `BillingTypeConstants` — the values are words, not the
    // four-letter SAP codes the rest of this screen carries (`STANDARD_POS`,
    // `Insurance`, `Wasfaty`, …). Same rule as `discTypeCode`: the interesting
    // cases get asked for by name rather than invented in a fixture.
    billingType: 'STANDARD_POS',
    receiptNumber: '4211900771',
    pharmacyId: '0421',
    exportState: 'exported',
    // ⚠️ `false` by default and asked for explicitly: a held document is a
    // FINDING (ticket 298), so it must never arrive on a fixture by accident.
    isHeld: false,
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
    iDocType: 'FI',
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

/**
 * `GET IDocInspector/Metadata` (ticket 300, BackOffice 1392).
 *
 * ⚠️ **A SAMPLE of what the route reflects, not a copy of the vocabularies.**
 * The nine are generated server-side off the pipeline's own C# constants and this
 * repo must never carry a copy of them — so these are a handful of real values,
 * spelled here only so the tests have something to look up. Adding a constant in
 * BackOffice does not oblige anyone to touch this file, which is exactly the
 * property the route exists to give us.
 *
 * The three vocabularies that persist `""` carry it FIRST, with the server's own
 * name for it (`SourceUnknown` / `OriginNotSet` / `NoError`) — the only entries in
 * the whole legend not reflected off a constant, because the blank is a *value* in
 * those vocabularies and not a member of them.
 */
export function aMetadata(over: Partial<IDocInspectorMetadata> = {}): IDocInspectorMetadata {
  return {
    legend: {
      sourceTag: [
        { code: '', name: 'SourceUnknown' },
        { code: 'pos', name: 'Pos' },
        { code: 'hungerstn-load', name: 'HungerStationLoad' },
      ],
      conditionSource: [
        { code: '', name: 'OriginNotSet' },
        { code: 'M', name: 'Manual' },
        { code: 'B', name: 'BonusBuy' },
      ],
      conditionClass: [
        { code: 'B', name: 'Prices' },
        { code: 'D', name: 'DiscountOrSurcharge' },
      ],
      conditionControl: [
        { code: 'A', name: 'Adjust' },
        { code: 'F', name: 'Fixed' },
      ],
      iDocType: [
        { code: 'AGG', name: 'Aggregation' },
        { code: 'SAPR', name: 'SalesAsPerReceipt' },
        { code: 'FI', name: 'FinancialDocument' },
      ],
      // ⚠️ Reflected off `BillingTypeConstants`, whose members are WORDS — not the
      // four-letter codes the rest of this screen carries. `aDocument` carries the
      // first of these, so its label resolves.
      billingType: [
        { code: 'STANDARD_POS', name: 'StandardPOS' },
        { code: 'Insurance', name: 'Insurance' },
      ],
      workflowType: [{ code: 'ZAGG', name: 'Aggregated' }],
      paymentGroup: [{ code: '01', name: 'Cash' }],
      errorType: [
        { code: '', name: 'NoError' },
        { code: 'PRICING', name: 'PricingFailure' },
      ],
    },
    registeredWorkflowTypes: ['ZAGG'],
    ...over,
  }
}
