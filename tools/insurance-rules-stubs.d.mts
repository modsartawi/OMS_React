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

// --- 613 --- reference editions
export declare const EDITIONS: import('../src/features/insurance-rules/editions/editions').Edition[]
export declare const EDITION_DIFFS: Record<string, import('../src/features/insurance-rules/editions/editions').EditionDiff>
export declare const EDITION_GAPS: Record<string, import('../src/features/insurance-rules/editions/editions').GapRow[]>
export declare const UPLOADED_EDITION_ID: string
export declare const UPLOADED_FILE_NAME: string
export interface EditionsState {
  editions: import('../src/features/insurance-rules/editions/editions').Edition[]
}
export declare function editionsState(): EditionsState
export declare function editionsStub(
  method: string,
  path: string,
  opts?: {
    deny?: string[]
    reads?: Record<string, number>
    user?: string
    now?: string
    editions?: EditionsState
    upload?: { list: string; fileName: string } | null
    refusePublish?: { status: number; message: string; errorCode: string } | null
  },
): (FulfillArg & { headers?: Record<string, string> }) | null
