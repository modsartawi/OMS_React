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

// --- 608 ---
import type { GuardIssue } from '../src/core/insurance-rules/checks'
export interface GuardStore {
  draft: GuardRuleset
  puts: unknown[]
  validates: unknown[]
}
export declare function newGuardStore(): GuardStore
export declare function validateGuards(doc: GuardRuleset): GuardIssue[]
export declare function guardEditorStub(
  method: string,
  path: string,
  body: unknown,
  opts?: { store?: GuardStore; deny?: string[]; reads?: Record<string, number> },
): FulfillArg | null
