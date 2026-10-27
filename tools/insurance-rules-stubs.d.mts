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

// --- 614 ---
export declare const GUARD_REASONS: import('../src/features/insurance-rules/review/model').GuardReasons
export declare const REVIEW_ROWS: import('../src/features/insurance-rules/review/model').ReviewRow[]
export declare const EXCEPTIONS: import('../src/features/insurance-rules/review/model').GuardException[]
export declare const EXCEPTION_LOGS: Record<string, import('../src/features/insurance-rules/review/model').ExceptionLogEntry[]>
export declare function createReviewStubs(opts?: {
  deny?: string[]
  writes?: { method: string; path: string; body: unknown }[]
  refuse?: Record<string, { status?: number; message: string; errorCode?: string }>
  reads?: Record<string, number>
}): (method: string, path: string, body: unknown, params?: URLSearchParams) => FulfillArg | null

// --- 615 ---
import type { FlagRow, FlagSettings, MetricsBy, MetricsRow, RejectionRow } from '../src/features/insurance-rules/metrics/model'
export declare const METRICS: Record<MetricsBy, MetricsRow[]>
export declare const FLAGS: FlagRow[]
export declare const FLAG_SETTINGS: FlagSettings
export declare const REJECTIONS: RejectionRow[]
export declare function insuranceMetricsStub(
  method: string,
  path: string,
  query: URLSearchParams,
  opts?: { deny?: string[]; asked?: { door: string; params: Record<string, string> }[] },
): FulfillArg | null
