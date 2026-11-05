/**
 * Document Details' **Insurance section** (ticket 787, BackOffice spec 3389, door 3390): the pure
 * model its parts draw. Verdict first — Money, then Lines with "How it was priced". Tickets 788
 * (Plan / Changes / Received) add their own pure modules beside this one; 789's delivery money strip
 * reads the same money words.
 *
 * Pure: no React, no network, no i18n. Figures come out already formatted in the order's currency
 * (`formatMoneyIn`), and every absence comes out as its own kind — never a blank, never `0.00`:
 * - `unpriced`: the engine could not price it (3390: "unpriced, never 0");
 * - `none`: the channel sent no money at all.
 */
import { formatMoneyIn } from '@/core/money'
import type { OmsAccessResult } from '@/core/models/oms-access'
import type { Severity } from '@/core/ui/severity'
import { canViewInsurance } from '@/core/oms/insurance-grant'
import { describeConditionType } from '@/core/constants/oms-codes'
import { isDeliveryCategory, type OpenedAs } from './actions'
import type { InsuranceCondition, InsuranceLine, InsuranceMoney, OrderInsuranceRead } from '@/core/models/order-insurance'

/** The Insurance section's anchor on the order's page — the `id` it draws and the `#hash` a link lands on. */
export const INSURANCE_SECTION_ID = 'insurance'

/** One money cell: a figure in the order's decimals, or the reason there is none. */
export type MoneyCell = { kind: 'amount'; text: string } | { kind: 'unpriced' } | { kind: 'none' }

/** The figures of the Money section, top to bottom (spec 3389 user story 37). */
export const MONEY_FIGURES = ['patient', 'deductible', 'deductibleVat', 'uncovered', 'insurer', 'amountDue'] as const
export type MoneyFigure = (typeof MONEY_FIGURES)[number]

export interface MoneyRow {
  figure: MoneyFigure
  channel: MoneyCell
  current: MoneyCell
  engine: MoneyCell
  /** The current figure and the engine's differ (both priced, compared at the currency's shown decimals). */
  gap: boolean
}

export interface MoneyTable {
  rows: MoneyRow[]
  /** Any figure has a gap — the verdict's ⚠. */
  hasGap: boolean
}

/** A figure, formatted; a missing figure is `missing`, never `0.00`. */
export function moneyCell(value: number | null | undefined, currency: string | null, missing: MoneyCell): MoneyCell {
  return typeof value === 'number' && Number.isFinite(value) ? { kind: 'amount', text: formatMoneyIn(value, currency) } : missing
}

/**
 * Two figures differ once both are known and they disagree **as drawn** — at the order currency's
 * decimals, the same `formatMoneyIn` the cells use. Deciding at the held scale (3 dp) instead would
 * put a ⚠ beside two SAR figures that both read `13.26`. Comparing the drawn text also absorbs a
 * float tail (`0.1 + 0.2` reads `0.30`).
 */
function differs(current: number | null, engine: number | null, currency: string | null): boolean {
  if (current === null || engine === null) return false
  return formatMoneyIn(current, currency) !== formatMoneyIn(engine, currency)
}

/**
 * The Money section's table: channel / current / engine side by side per figure, with each gap
 * between current and engine money flagged. Unpriced engine money is never a gap — it is unpriced.
 */
export function moneyTable(read: Pick<OrderInsuranceRead, 'money' | 'currency'>): MoneyTable {
  const { channel, current, engine } = read.money
  const rows = MONEY_FIGURES.map((figure): MoneyRow => {
    const engineValue = engine.priced ? (engine[figure] as number | null) : null
    return {
      figure,
      channel: channel ? moneyCell(channel[figure as keyof InsuranceMoney], read.currency, { kind: 'none' }) : { kind: 'none' },
      current: moneyCell(current[figure], read.currency, { kind: 'none' }),
      engine: moneyCell(engineValue, read.currency, engine.priced ? { kind: 'none' } : { kind: 'unpriced' }),
      gap: engine.priced && differs(current[figure], engineValue, read.currency),
    }
  })
  return { rows, hasGap: rows.some((r) => r.gap) }
}

/** The channel's own per-line figures, in the order the Lines part draws them (ticket 787). */
export const RECEIVED_LINE_FIGURES = ['deductible', 'deductibleVat', 'patient', 'insurer'] as const
export type ReceivedLineFigure = (typeof RECEIVED_LINE_FIGURES)[number]

/** A received figure's short label, under `document:`. */
export const receivedLineKey = (figure: ReceivedLineFigure) => `insurance.lines.${figure}Short`

/** One line of the Lines part, its money already formatted (spec 3389 user stories 43–53). */
export interface LineView {
  /** Our engine's deductible; `unpriced` when the line cannot be priced, never `0.00`. */
  engineDeductible: MoneyCell
  appliedDeductible: MoneyCell
  /** The engine's deductible and the one applied differ (the per-line spread of the channel's). */
  deductibleGap: boolean
  vat: MoneyCell
  patient: MoneyCell
  insurer: MoneyCell
  /** The channel's own per-line split, or `null` when it sent none for this line. */
  received: Record<ReceivedLineFigure, MoneyCell> | null
  /** Why the engine could not price the line, when it says. */
  unpricedReason: string | null
  /** A ceiling of 0 means no ceiling, never "not covered" (glossary "Coverage ceiling"). */
  ceiling: MoneyCell
}

const UNPRICED: MoneyCell = { kind: 'unpriced' }
const NONE: MoneyCell = { kind: 'none' }

/** The Lines part's view of one line. */
export function lineView(line: InsuranceLine, currency: string | null): LineView {
  const amount = (v: number | null | undefined, missing: MoneyCell = NONE) => moneyCell(v, currency, missing)
  const engineDeductible = line.engine.priced ? line.engineDeductible : null
  return {
    engineDeductible: amount(engineDeductible, UNPRICED),
    appliedDeductible: amount(line.appliedDeductible),
    deductibleGap: differs(line.appliedDeductible, engineDeductible, currency),
    vat: amount(line.vat),
    patient: amount(line.patientAmount),
    insurer: amount(line.insurerAmount),
    received: line.received
      ? {
          deductible: amount(line.received.deductible),
          deductibleVat: amount(line.received.deductibleVat),
          patient: amount(line.received.patient),
          insurer: amount(line.received.insurer),
        }
      : null,
    unpricedReason: line.engine.priced ? null : line.engine.unpricedReason,
    ceiling: line.coverageCeiling > 0 ? amount(line.coverageCeiling) : NONE,
  }
}

/** One step of "How it was priced". */
export interface PricingStep {
  key: string
  stepNumber: number
  counter: number
  condType: string
  /** The server's words for the condition, else the code's known words, else the bare code. */
  description: string
  base: MoneyCell
  /** The rate as stored — a percent or an amount, by the condition's calculation type. A machine value. */
  rate: string
  /** The condition's money. 🚩 An item-0 (header) condition's money is its `rate` (header-condition-money rule). */
  money: MoneyCell
  header: boolean
}

/** A plain number, as stored, for a rate: grouped, no forced decimals. */
const plain = (value: number) => value.toLocaleString('en-US', { maximumFractionDigits: 6 })

/** The conditions of a line (or the header's), in step order, each with its money. */
export function pricingSteps(conditions: readonly InsuranceCondition[], currency: string | null): PricingStep[] {
  return [...conditions]
    .sort((a, b) => a.stepNumber - b.stepNumber || a.counter - b.counter)
    .map((c) => {
      const header = c.lineNumber === 0
      return {
        key: `${c.lineNumber}-${c.stepNumber}-${c.counter}`,
        stepNumber: c.stepNumber,
        counter: c.counter,
        condType: c.condType,
        description: describeConditionType(c.condType, c.description),
        base: moneyCell(c.base, currency, NONE),
        rate: plain(c.rate),
        money: moneyCell(header ? c.rate : c.value, currency, NONE),
        header,
      }
    })
}

/** What decides whether the section is asked for and drawn. */
export interface InsuranceSectionContext {
  openedAs: OpenedAs
  documentCategory: string | null | undefined
  access: Partial<OmsAccessResult> | null | undefined
}

/**
 * Is the insurance read asked at all? Only on Document Details (the order's page — a delivery has
 * 789's money strip instead), only for a record that is not a delivery, and only with the
 * insurance-view grant, which fails closed. The header payload says nothing about insurance, so
 * whether it IS an insurance order is the read's own answer (`insuranceSectionGate`).
 */
export function asksInsurance(ctx: InsuranceSectionContext): boolean {
  return ctx.openedAs === 'document' && !isDeliveryCategory(ctx.documentCategory) && canViewInsurance(ctx.access)
}

/**
 * Is the section drawn? Asked, and answered with an insurance read. `null` is the door's "not an
 * insurance order" (`NOT_AN_INSURANCE_ORDER_CODE`, read by `documentApi.getInsurance`); `undefined`
 * is a read not landed yet. Neither draws anything.
 */
export function insuranceSectionGate(ctx: InsuranceSectionContext, read: OrderInsuranceRead | null | undefined): boolean {
  return asksInsurance(ctx) && read != null
}

/**
 * The money-source badge and its one line of meaning (spec 3389 user story 36). `CHANNEL` = the
 * patient pays what the insurer sent; `ENGINE` = what our rules charge. An unlisted source shows its
 * raw code on a neutral badge rather than being guessed at. Keys under `document:insurance.source.*`.
 */
export function moneySourceBadge(source: string | null | undefined): {
  code: 'CHANNEL' | 'ENGINE' | 'unknown'
  sev: Severity
  labelKey: string
  meaningKey: string
} {
  const code = (source ?? '').trim().toUpperCase()
  if (code === 'CHANNEL' || code === 'ENGINE')
    return { code, sev: code === 'CHANNEL' ? 'warn' : 'go', labelKey: `insurance.source.${code}`, meaningKey: `insurance.meaning.${code}` }
  return { code: 'unknown', sev: 'mute', labelKey: 'insurance.source.unknown', meaningKey: 'insurance.meaning.unknown' }
}
