/**
 * The sourcing advisor's explain view model (ticket 738, spec 734 D15–D21). Pure, pinned by
 * `explain-model.test.ts`: it turns the D20 `SourcingAdvisor/Explain` reply into what the page draws.
 *
 * 🚩 The door scores the order (D19); nothing here picks a store or re-ranks one. What lives here:
 * - every figure formatted once (km to one decimal, SAR to the halala), `null` when absent;
 * - a candidate's cost as shown is the sum of its parts as shown, so a row always adds up on screen;
 * - an on-time state is `yes`, `no` or `unknown`, and only a `yes` best ever shows a saving (D18);
 * - each reason code is an i18n key, an unknown one falls back (D21: never server free text);
 * - an absent list reads as empty, so a bare reply draws an empty page, not a crash.
 */
import type {
  SourcingCandidate,
  SourcingExplainReply,
  SourcingOnTimeWire,
  SourcingStoreEstimate,
} from '@/core/models/sourcing-advisor'
import { formatPair } from '@/core/util/bidi'

export type OnTimeState = 'yes' | 'no' | 'unknown'
export type StockState = 'recorded' | 'estimated'

export interface StoreSide {
  /** `code · name`, one string, isolated once by the page. */
  store: string
  km: string | null
  cost: string | null
  readyMins: string | null
  travelMins: string | null
  onTime: OnTimeState
}

export interface CandidateRow {
  store: string
  km: string | null
  courier: string | null
  pick: string | null
  split: string | null
  express: string | null
  cost: string | null
  onTime: OnTimeState
  stock: StockState
  isActual: boolean
  isBest: boolean
}

export interface ReasonLine {
  code: string
  key: string
}

export interface ExplainModel {
  order: { orderNo: string; deliveryType: string; city: string; promisedBy: string }
  actual: StoreSide | null
  best: StoreSide | null
  saving: { shown: true; amount: string } | { shown: false }
  reasons: ReasonLine[]
  candidates: CandidateRow[]
  rateVersion: string
  placeholderRates: boolean
}

/** D20: up to 15 candidate rows. */
export const MAX_CANDIDATES = 15

/** The reason codes the screen has a sentence for (`reasons.*` in the `sourcing-advisor` namespace). */
export const REASON_KEYS: Readonly<Record<string, string>> = {
  NEARER_STORE_STOCKED: 'reasons.nearerStoreStocked',
  ACTUAL_LATE: 'reasons.actualLate',
  AVOIDABLE_SPLIT: 'reasons.avoidableSplit',
  EXPRESS_PREMIUM: 'reasons.expressPremium',
  CHEAPER_FLEET: 'reasons.cheaperFleet',
  ACTUAL_WAS_BEST: 'reasons.actualWasBest',
  STOCK_ESTIMATED: 'reasons.stockEstimated',
}
export const UNKNOWN_REASON_KEY = 'reasons.unknown'

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const cents = (v: number): number => Math.round(v * 100)
const sar = (v: number | null | undefined): string | null => (isNum(v) ? (cents(v) / 100).toFixed(2) : null)
const km = (v: number | null | undefined): string | null => (isNum(v) ? v.toFixed(1) : null)
const mins = (v: number | null | undefined): string | null => (isNum(v) ? String(Math.round(v)) : null)

/** Only `true` and `false` are answers; anything else (null, absent, malformed) is unknown. */
export function onTimeState(v: SourcingOnTimeWire | undefined): OnTimeState {
  return v === true ? 'yes' : v === false ? 'no' : 'unknown'
}

const storePair = (code: string | null | undefined, name: string | null | undefined): string =>
  formatPair((code ?? '').trim(), (name ?? '').trim())

function side(e: SourcingStoreEstimate | null | undefined): StoreSide | null {
  if (!e) return null
  return {
    store: storePair(e.store, e.storeName),
    km: km(e.km),
    cost: sar(e.cost),
    readyMins: mins(e.readyMins),
    travelMins: mins(e.travelMins),
    onTime: onTimeState(e.onTime),
  }
}

function row(c: SourcingCandidate, actualCode: string, bestCode: string): CandidateRow {
  const parts = c.costParts ?? null
  const values = parts ? [parts.courier, parts.pick, parts.split, parts.express] : []
  const anyPart = values.some(isNum)
  // The shown total is the sum of the shown parts, in halalas, so the row adds up as read.
  const total = anyPart ? values.reduce<number>((s, v) => s + (isNum(v) ? cents(v) : 0), 0) / 100 : c.cost
  const code = (c.store ?? '').trim()
  return {
    store: storePair(c.store, c.storeName),
    km: km(c.km),
    courier: anyPart ? sar(parts?.courier) : null,
    pick: anyPart ? sar(parts?.pick) : null,
    split: anyPart ? sar(parts?.split) : null,
    express: anyPart ? sar(parts?.express) : null,
    cost: sar(total),
    onTime: onTimeState(c.onTime),
    // Only an explicit "recorded" is claimed as recorded evidence.
    stock: c.stockEvidence === 'recorded' ? 'recorded' : 'estimated',
    isActual: code !== '' && code === actualCode,
    isBest: code !== '' && code === bestCode,
  }
}

export function reasonKey(code: string): string {
  return REASON_KEYS[code] ?? UNKNOWN_REASON_KEY
}

export function explainModel(reply: Partial<SourcingExplainReply> | null | undefined): ExplainModel {
  const r = reply ?? {}
  const actual = side(r.actual)
  const best = side(r.best)
  const actualCode = (r.actual?.store ?? '').trim()
  const bestCode = (r.best?.store ?? '').trim()
  const saving =
    best && best.onTime === 'yes' && isNum(r.saving) && cents(r.saving) > 0
      ? ({ shown: true, amount: sar(r.saving)! } as const)
      : ({ shown: false } as const)
  return {
    order: {
      orderNo: r.orderNo ?? '',
      deliveryType: r.deliveryType ?? '',
      city: r.city ?? '',
      promisedBy: r.promisedBy ?? '',
    },
    actual,
    best,
    saving,
    reasons: (r.reasons ?? []).map((code) => ({ code, key: reasonKey(code) })),
    candidates: (r.candidates ?? []).slice(0, MAX_CANDIDATES).map((c) => row(c, actualCode, bestCode)),
    rateVersion: r.rateVersion ?? '',
    placeholderRates: r.placeholderRates === true,
  }
}
