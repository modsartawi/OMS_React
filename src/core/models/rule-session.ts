// Customer sessions, for support (ticket 527, BackOffice 2760): the REAL reply shapes of
// `Rules/Support/Sessions`, `Rules/Support/Session` and `Rules/Support/Cancel`, named as the brief's
// "HQ contract: support sessions (2760)" names them, and as SIS.Api answers them (camelCase of
// `RuleSupportService`'s classes and SIS.Rules' session contracts).
//
// A rule store's sale is a customer session at HQ (spec 2737), identified by the channel's own sale
// id (a till's TransactionId, an Sd DocumentNo). Not the auth cookie's session, nor the till's engine
// session (CONTEXT.md). Every time is LOCAL wall clock (`yyyy-MM-ddTHH:mm:ss`, never a `Z`); a stamp
// the session never reached is `null`.

import type { Says } from './rule-campaign'

/** Where a customer session is (`RuleSessionStates`). */
export const RULE_SESSION_STATES = ['open', 'paying', 'closed', 'partiallyReturned', 'returned', 'cancelled'] as const
export type RuleSessionState = (typeof RULE_SESSION_STATES)[number]

/** What `GET Rules/Support/Sessions` is asked: a store (required), local days, a state, a cap. */
export interface RuleSessionListQuery {
  storeCode: string
  /** A local day `yyyy-MM-dd`; HQ answers today when neither end is sent, one day when one is. */
  from?: string
  to?: string
  state?: RuleSessionState
  /** 1–500; HQ's default is 100. */
  take?: number
}

/** One session as the list shows it (`RuleSessionSummary`); also the lookup's `session`. */
export interface RuleSessionSummary {
  sessionId: string
  storeCode: string
  channel: string
  state: RuleSessionState
  rulesetVersion: number
  cartVersion: number
  currency: string
  decimals: number
  couponCode: string | null
  openedAt: string
  paidAt: string | null
  closedAt: string | null
  cancelledAt: string | null
  returnedAt: string | null
  updatedAt: string
}

/** A calling verb of the request ring (`RuleSessionVerbs`); an `evaluate` writes none. */
export const RULE_SESSION_VERBS = ['pay', 'close', 'cancel', 'returns', 'late-close', 'support-cancel'] as const
export type RuleSessionVerb = (typeof RULE_SESSION_VERBS)[number]

/** A discount on one unit of one cart line (SIS.Rules `UnitEffect`). */
export interface RuleUnitEffect {
  campaign: string
  rule: string
  effect: string
  /** The cart line number. */
  line: number
  /** The unit's 0-based index within the line. */
  unit: number
  amount: number
  label: Says | null
  freeGoods: boolean
}

/** Points awarded or burned (SIS.Rules `PointsEffect`). */
export interface RulePointsEffect {
  campaign: string
  rule: string
  effect: 'awardPoints' | 'burnPoints' | string
  amount: number
  desired: number
  tierAmount: number
  unit: 'SAR' | 'PTS' | string
  activity: string
  activates: string | null
  expires: string | null
  tender: boolean
  value: number
}

/** A refusal an engine call answered (SIS.Rules `Refusal`): the "why not". It carries no time. */
export interface RuleSessionRefusal {
  code: string
  campaign: string | null
  rule: string | null
  budget: string | null
  reason: Says | null
}

/** A code a campaign creates at close (2755): `code` is null until close mints it. */
export interface RuleCreatedCoupon {
  campaign: string
  rule: string
  template: string
  validDays: number
  validFrom: string | null
  validTo: string | null
  label: Says | null
  code: string | null
  /** `created`, `disabled`, `usedBeforeReturn` … HQ's word. */
  state: string | null
}

/** A unit and what it paid (SIS.Rules `AllocatedUnit`): what a return reads. */
export interface RuleAllocatedUnit {
  line: number
  unit: number
  net: number
  discount: number
  paid: number
}

/** The reply a session call got (SIS.Rules `SessionReply`). */
export interface RuleSessionReply {
  sessionId: string
  state: string
  rulesetVersion: number
  cartVersion: number
  currency: string
  decimals: number
  effects: RuleUnitEffect[]
  points: RulePointsEffect[]
  refusals: RuleSessionRefusal[]
  prompts: { campaign: string; rule: string; articles: string[]; count: number; text: Says | null }[]
  messages: { campaign: string; rule: string; text: Says | null }[]
  offers: { campaign: string; rule: string; flag: string; text: Says | null }[]
  allocation: RuleAllocatedUnit[]
  createdCoupons: RuleCreatedCoupon[]
}

/** One writing call of the session's request ring (`RuleSessionCall`), oldest first. */
export interface RuleSessionCall {
  /** One of `RULE_SESSION_VERBS`, or a word this client lacks. */
  verb: string
  requestId: string
  at: string
  cartVersion: number
  state: string
  /** The person of a support cancel; null otherwise. */
  by: string | null
  /** The reason of a support cancel; null otherwise. */
  note: string | null
  reply: RuleSessionReply
}

/** A line of the cart as the channel sent it (SIS.Rules `CartLine`). */
export interface RuleCartLine {
  lineNumber: number
  article: string
  quantity: number
  unit: string
  baseUnitQuantity: number
  gross: number
  netBeforePromotion: number
  vatRate: number
  category: string | null
  fee: boolean
  attributes: Record<string, string> | null
}

/** The session's cart (SIS.Rules `Cart`). */
export interface RuleSessionCart {
  storeCode: string
  country: string
  channel: string
  currency: string
  decimals: number
  lines: RuleCartLine[]
  coupons: string[]
  flags: string[]
  requestedPoints: number
  pointValue: number
  burnNotAuthorized: boolean
}

/** A unit already returned. */
export interface RuleReturnedUnit {
  line: number
  unit: number
}

/** A budget the session holds now (`RuleBudgetHold`) — its position, not its history. */
export interface RuleSessionHold {
  counterId: string
  campaign: string
  budget: string
  scopeKey: string
  periodKey: string
  declared: number
  amount: number
  /** Released by the sweeper after it expired: close still commits it. */
  released: boolean
}

/** The journal's movement kinds (`RuleBudgetMovementKinds`). */
export const RULE_BUDGET_MOVEMENT_KINDS = ['hold', 'commit', 'release', 'return'] as const

/** Why a counter passed its limit (`RuleBudgetEventReasons`). */
export const RULE_BUDGET_EVENT_REASONS = ['expiredHold', 'loweredLimit', 'confirmedResult', 'lateEarnRefused', 'createdCouponUsed'] as const

/** A line of the budget journal (`RuleSessionMovement`, ADR 0091). */
export interface RuleSessionMovement {
  movementId: string
  counterId: string
  campaign: string
  budget: string
  /** One of `RULE_BUDGET_MOVEMENT_KINDS`, or a word this client lacks. */
  kind: string
  amount: number
  /** A hold's expiry; null otherwise, and on a call-center order's hold. */
  expiresAt: string | null
  at: string
}

/** A counter passing its limit, or an award it cut (`RuleSessionBudgetEvent`). */
export interface RuleSessionBudgetEvent {
  eventId: string
  campaign: string
  budget: string
  /** One of `RULE_BUDGET_EVENT_REASONS`, or a word this client lacks. */
  reason: string
  desired: number
  awarded: number
  used: number
  limit: number
  at: string
}

export interface RuleSessionCouponRefund {
  transactionId: string
  requestId: string
  at: string
}

/** The campaign coupon the sale redeemed, and its refunds. */
export interface RuleSessionCoupon {
  code: string
  redeemTransactionId: string
  refunds: RuleSessionCouponRefund[]
}

/** A points activity Loy posted for the session (an earn, a burn, a give-back). */
export interface RuleSessionPointsActivity {
  activityId: string
  requestId: string
  refRequestId: string
  loyId: string
  activityType: string
  status: string
  points: number
  at: string
}

/** `GET Rules/Support/Session?sessionId=` — everything HQ holds of one sale. */
export interface RuleSessionLookup {
  session: RuleSessionSummary
  calls: RuleSessionCall[]
  /** Null when HQ holds no readable cart. */
  cart: RuleSessionCart | null
  effects: RuleUnitEffect[]
  points: RulePointsEffect[]
  returned: RuleReturnedUnit[]
  holds: RuleSessionHold[]
  movements: RuleSessionMovement[]
  budgetEvents: RuleSessionBudgetEvent[]
  /** Every refusal any call answered, each once, in call order. */
  refusals: RuleSessionRefusal[]
  /** Null without a campaign coupon. */
  coupon: RuleSessionCoupon | null
  createdCoupons: RuleCreatedCoupon[]
  pointsActivities: RuleSessionPointsActivity[]
}

/** `POST Rules/Support/Cancel`'s body: `requestId` new per press, `reason` required (≤ 500). */
export interface RuleSupportCancelRequest {
  sessionId: string
  requestId: string
  reason: string
}

/** What this cancel moved; empty on a repeat. */
export interface RuleSessionRollback {
  movements: RuleSessionMovement[]
  budgetEvents: RuleSessionBudgetEvent[]
  couponRefund: RuleSessionCouponRefund | null
  createdCoupons: RuleCreatedCoupon[]
  pointsActivities: RuleSessionPointsActivity[]
}

/** `POST Rules/Support/Cancel`'s answer: the reply, the rollback, whether it was a repeat, the session after. */
export interface RuleSupportCancelReply {
  reply: RuleSessionReply
  rollback: RuleSessionRollback
  /** True when the same `requestId` came again: the stored reply, nothing moved. */
  repeated: boolean
  session: RuleSessionLookup
}
