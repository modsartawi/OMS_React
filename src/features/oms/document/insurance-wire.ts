/**
 * The insurance read at the api boundary (3389 hotfix): BackOffice's `SdInsuranceReadModel` (branch
 * pricing2) mapped to the client model the Insurance section draws (`OrderInsuranceRead`). Mapped
 * here once, rather than reshaping every part, because the server's shape is the engine's
 * (`received` / `current` / `engine` money as `InsuranceSummary`, a line's `current` / `engine` money
 * as its own columns) while the parts compare figure by figure.
 *
 * Pure: no React, no network, no i18n. Nothing is invented: what the server does not send reads
 * empty / `null`, and every absence keeps its own kind —
 * - the channel sends four header figures only, so its uncovered and amount due are `null` ("not sent");
 * - engine money is `priced` only when the engine priced EVERY live line (`isPriced && isComplete`): a
 *   partial total is not the order's money, so it reads unpriced with the unpriced lines named;
 * - an act accepted before money was recorded (`moneyRecorded: false`) has `null` money ("not recorded");
 * - an intake body not kept reads not kept, with the day keeping began.
 */
import type {
  EngineLineMoney,
  EngineMoney,
  InsuranceCondition,
  InsuranceConditionWire,
  InsuranceLine,
  InsuranceLineWire,
  InsuranceMoney,
  InsuranceMoneyWire,
  InsurancePlan,
  InsurancePlanWire,
  InsuranceTimelineEntry,
  InsuranceTimelineEntryWire,
  IntakeBody,
  OrderInsuranceRead,
  OrderInsuranceReadWire,
} from '@/core/models/order-insurance'
import type { LocalDate, MoneySource } from '@/core/models/order-document'

const str = (v: string | null | undefined) => (v ?? '').trim()
const orNull = (v: string | null | undefined) => (str(v) === '' ? null : str(v))
const num = (v: number | null | undefined) => (typeof v === 'number' && Number.isFinite(v) ? v : null)

/** A server money in the section's five figures (+ the amount due it is asked to collect, when known). */
function moneyOf(wire: InsuranceMoneyWire | null | undefined, amountDue: number | null): InsuranceMoney {
  return {
    patient: num(wire?.patientTotal),
    deductible: num(wire?.deductibleTotal),
    deductibleVat: num(wire?.deductibleVatTotal),
    uncovered: num(wire?.uncoveredTotal),
    insurer: num(wire?.insurerTotal),
    amountDue,
  }
}

const UNPRICED_ENGINE = {
  priced: false,
  patient: null,
  deductible: null,
  deductibleVat: null,
  uncovered: null,
  insurer: null,
  amountDue: null,
} as const

function engineOf(wire: OrderInsuranceReadWire): EngineMoney {
  const engine = wire.engine
  const unpricedLines = (wire.lines ?? [])
    .filter((l) => !l.voided && l.engineState !== 'PRICED')
    .map((l) => l.lineNumber)
  if (!engine?.isPriced || !engine.isComplete) return { ...UNPRICED_ENGINE, unpricedLines }
  return { priced: true, unpricedLines: [], ...moneyOf(engine.money, num(engine.amountDue)) }
}

function planOf(wire: InsurancePlanWire | null | undefined): InsurancePlan {
  // The server sends the insurer customer and payer as codes only (no names): each is a code alone.
  const party = (code: string | null | undefined) => (str(code) ? { code: str(code), name: '' } : null)
  return {
    policyNumber: str(wire?.policyNumber),
    policyHolder: str(wire?.policyHolder),
    contractNumber: str(wire?.contractNumber),
    className: str(wire?.className),
    memberId: str(wire?.memberId),
    identityNumber: str(wire?.identityNumber),
    eligibilityReference: str(wire?.eligibilityId),
    authorizationId: str(wire?.authorizationId),
    diagnosis: str(wire?.diagnosis),
    visitReason: str(wire?.visitReason),
    chiefComplaint: str(wire?.chiefComplaintDescription) || str(wire?.chiefComplaintCode),
    // An int on the server, 0 when not sent: 0 days is no supply, so it reads "not sent".
    daysSupply: wire?.daysSupply ? wire.daysSupply : null,
    insurerCustomer: party(wire?.insurerCustomerId),
    payer: party(wire?.payerCode),
    deductibleGroups: (wire?.deductibleGroups ?? []).map((g) => ({
      group: str(g.groupName),
      percentage: g.percentage,
      cap: g.maxAmount > 0 ? g.maxAmount : null,
    })),
  }
}

function conditionOf(c: InsuranceConditionWire, lineNumber: number): InsuranceCondition {
  return {
    lineNumber,
    stepNumber: c.stepNumber,
    counter: c.conditionCounter,
    condType: str(c.conditionType),
    description: str(c.description),
    calculationType: str(c.calculationType),
    base: c.conditionBaseValue,
    rate: c.conditionRate,
    value: c.conditionValue,
  }
}

function lineEngineOf(line: InsuranceLineWire, refusal: string | null): EngineLineMoney {
  if (line.engineState === 'PRICED' && line.engine)
    return {
      priced: true,
      unpricedReason: null,
      deductible: line.engine.deductibleAmount,
      deductibleVat: line.engine.deductibleVat,
      patient: line.engine.patientAmount,
      insurer: line.engine.insurerAmount,
    }
  return {
    priced: false,
    // A voided line carries no money by design; an unpriced one says why when the server does.
    unpricedReason: line.voided || line.engineState === 'VOIDED' ? null : orNull(line.unresolvedReason) ?? refusal,
    deductible: null,
    deductibleVat: null,
    patient: null,
    insurer: null,
  }
}

function lineOf(line: InsuranceLineWire, refusal: string | null): InsuranceLine {
  const current = line.current
  return {
    lineNumber: line.lineNumber,
    voided: line.voided,
    sent: line.sent
      ? { sfdaCode: str(line.sent.sfdaCode), text: line.sent.text ?? '', itemNumber: str(line.sent.itemNumber), quantity: line.sent.quantity, unit: str(line.sent.uom) }
      : null,
    dispensedItemNumber: str(line.itemNumber),
    dispensedItemDescription: line.itemDescription ?? '',
    dispensedQuantity: line.salesQuantity,
    dispensedUnit: str(line.salesUom),
    originalItemNumber: orNull(line.originalMaterialNumber),
    pharmacistReason: orNull(line.pharmacistSelectionReason),
    insuranceCategory: str(line.insuranceItemCategory),
    deductibleGroup: str(line.deductibleGroup),
    coverageCeiling: line.maxPayerShare ?? 0,
    // The engine's deductible as it prices the line now; none when it could not price it.
    engineDeductible: line.engineState === 'PRICED' && line.engine ? line.engine.calculatedDeductible : null,
    appliedDeductible: current?.deductibleAmount ?? 0,
    vat: current?.deductibleVat ?? 0,
    patientAmount: current?.patientAmount ?? 0,
    insurerAmount: current?.insurerAmount ?? 0,
    received: line.received
      ? {
          deductible: line.received.deductibleAmount,
          deductibleVat: line.received.deductibleVat,
          patient: line.received.patientAmount,
          insurer: line.received.insurerAmount,
        }
      : null,
    engine: lineEngineOf(line, refusal),
    unresolvedReason: orNull(line.unresolvedReason),
    guardDecision: orNull(line.guardOutcome),
    conditions: (line.conditions ?? []).map((c) => conditionOf(c, line.lineNumber)),
  }
}

function entryOf(e: InsuranceTimelineEntryWire): InsuranceTimelineEntry {
  if (str(e.kind).toUpperCase() === 'LOG')
    // The server sends the log's action code and its text, not the action's description.
    return { kind: 'log', at: e.entryTime, by: str(e.entryUser), action: str(e.action), actionDescription: '', note: e.text ?? '' }
  const side = (source: string | null, patient: number | null, insurer: number | null) =>
    e.moneyRecorded ? { moneySource: str(source), patientTotal: num(patient), insurerTotal: num(insurer) } : null
  return {
    kind: 'change',
    at: e.entryTime,
    by: str(e.entryUser),
    act: str(e.action),
    lineNumber: e.lineNumber ?? null,
    itemBefore: orNull(e.itemNumberBefore),
    itemAfter: orNull(e.itemNumberAfter),
    quantityBefore: num(e.quantityBefore),
    quantityAfter: num(e.quantityAfter),
    unitBefore: orNull(e.uomBefore),
    unitAfter: orNull(e.uomAfter),
    reason: orNull(e.reason),
    moneyBefore: side(e.moneySourceBefore, e.patientTotalBefore, e.insurerTotalBefore),
    moneyAfter: side(e.moneySourceAfter, e.patientTotalAfter, e.insurerTotalAfter),
  }
}

function intakeOf(wire: OrderInsuranceReadWire['intake'] | null | undefined): IntakeBody {
  if (wire?.isKept)
    return {
      kept: true,
      body: wire.body ?? '',
      contentType: str(wire.contentType),
      receivedAt: str(wire.receivedTime),
      receivedBy: str(wire.receivedBy),
    }
  // `keptSince` is a DateTime (the earliest kept body's time): its local day is the sentence's date.
  const since = str(wire?.keptSince).slice(0, 10)
  return { kept: false, keptSince: /^\d{4}-\d{2}-\d{2}$/.test(since) ? (since as LocalDate) : null }
}

/** The server's insurance read as the section's model. */
export function insuranceReadOf(wire: OrderInsuranceReadWire): OrderInsuranceRead {
  const received = moneyOf(wire.received, null)
  const sentAny = [received.patient, received.deductible, received.deductibleVat, received.uncovered, received.insurer].some((v) => v !== null)
  const refusal = orNull(wire.engine?.refusal?.english)
  return {
    documentNo: str(wire.documentNo),
    orderNo: str(wire.orderNo),
    currency: null,
    moneySource: str(wire.moneySource).toUpperCase() as MoneySource,
    money: {
      channel: sentAny ? received : null,
      current: moneyOf(wire.current, num(wire.amounts?.amountDue)),
      engine: engineOf(wire),
    },
    amountDue: wire.amounts?.amountDue ?? 0,
    onAccountAmount: wire.amounts?.onAccountAmount ?? 0,
    paidAmount: wire.amounts?.paidAmount ?? 0,
    plan: planOf(wire.plan),
    lines: (wire.lines ?? []).map((l) => lineOf(l, refusal)),
    headerConditions: (wire.headerConditions ?? []).map((c) => conditionOf(c, 0)),
    timeline: (wire.timeline?.entries ?? []).map(entryOf),
    intake: intakeOf(wire.intake),
  }
}
