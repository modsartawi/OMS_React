// Types for `insurance-rules-stubs.mjs`, so a vitest proof reads the SAME stub data the drive serves.
import type { GuardList, GuardRule, GuardRuleRow, GuardRuleset } from '../src/core/insurance-rules/model'

export declare const LISTS: GuardList[]
export declare const RULES: GuardRule[]
export declare const RULESET: GuardRuleset
export declare const GUARD_ROWS: GuardRuleRow[]
export declare const PATIENT_LIST_VIP: string
export declare const POLICY_LIST_EXTENDED: string

export interface FulfillArg {
  status: number
  contentType?: string
  body: string
}
export declare function envelope(
  data: unknown,
  o?: { status?: number; success?: boolean; message?: string; errorCode?: string },
): FulfillArg
export declare function insuranceRulesStub(
  method: string,
  path: string,
  body: unknown,
  opts?: { deny?: string[]; reads?: Record<string, number> },
): FulfillArg | null

// --- 616 ---
import type { GuardReasons, OrderGuards, OrderGuardState } from '../src/core/insurance-rules/guard-check'
export declare const GUARD_REASONS: GuardReasons
export declare const ORDER_GUARDS_HELD: OrderGuards
export declare const ORDER_GUARDS_RECHECKED: OrderGuards
export declare const ORDER_GUARD_LINES: Array<{ lineNumber: number; itemNumber: string; itemDescription: string }>
export declare function orderGuardsStub(
  method: string,
  path: string,
  body: unknown,
  order: { guardState: OrderGuardState; guards: OrderGuards | null },
  opts?: { writes?: unknown[]; answerRefusal?: { status?: number; message: string; errorCode?: string } | null },
): FulfillArg | null
