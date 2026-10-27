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

// --- 610 ---
import type { FieldValue, KeyedList, KeyedListEntry, KeyedListLogRow, RegistryField } from '../src/core/insurance-rules/registry'
export declare const FIELDS: RegistryField[]
export declare const FIELD_VALUES: Record<string, FieldValue[]>
export declare const PREVIEW_ITEMS: { article: string; name: string; [field: string]: string }[]
export declare const PATIENT_LISTS: KeyedList[]
export declare const POLICY_LISTS: KeyedList[]
export interface ListsState {
  fields: RegistryField[]
  ruleset: GuardRuleset
  entries: Record<string, KeyedListEntry[]>
  log: Record<string, KeyedListLogRow[]>
  lists: { patient: KeyedList[]; policy: KeyedList[] }
  writes: { door: string; body: unknown }[]
}
export declare function newListsState(): ListsState
export declare function matchItems(list: GuardList, lists: GuardList[], items?: { article: string; name: string }[]): { article: string; name: string }[]
export declare function insuranceListsStub(
  method: string,
  path: string,
  body: unknown,
  opts?: { deny?: string[]; reads?: Record<string, number>; state?: ListsState; query?: URLSearchParams; pageSize?: number },
): FulfillArg | null
