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
  opts?: { deny?: string[]; asked?: { door: string; params: Record<string, string> }[]; writes?: { door: string; body: unknown }[]; body?: unknown; settings?: FlagSettings },
): FulfillArg | null

// --- 616 ---
import type { GuardReasons, OrderGuards, OrderGuardState } from '../src/core/insurance-rules/guard-check'
export declare const ORDER_GUARD_REASONS: GuardReasons
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

// --- 611 ---
export interface GuardVersionRow {
  version: number
  by: string
  at: string
  note: string | null
}
export declare const GUARD_VERSIONS: GuardVersionRow[]
export declare const BACKTEST_DONE_ID: string
export declare const BACKTEST_DONE: import('../src/core/insurance-rules/backtest').GuardBacktest
export interface ApprovalStore {
  draft: GuardRuleset
  approval: {
    state: 'draft' | 'waiting'
    submittedBy: string | null
    submittedAt: string | null
    note: string | null
    sentBack: { by: string; at: string; note: string } | null
    backtestId: string | null
  }
  backtests: Record<string, import('../src/core/insurance-rules/backtest').GuardBacktest>
  versions: GuardVersionRow[]
  versionDocs: Record<number, GuardRuleset>
  writes: { method: string; path: string; body: unknown; user: string }[]
}
export declare function newApprovalStore(o?: { backtest?: import('../src/core/insurance-rules/backtest').GuardBacktest | null }): ApprovalStore
export declare function approvalStub(
  method: string,
  path: string,
  body: unknown,
  opts?: { store?: ApprovalStore; user?: string; viewer?: { author: boolean; approver: boolean }; now?: string; deny?: string[] },
): FulfillArg | null

// --- 609 ---
import type { GuardTemplate } from '../src/core/insurance-rules/templates'
export declare const TEMPLATES: GuardTemplate[]
export declare const EMPTY_FOLDERS: string[]
export interface TemplatesState {
  store: GuardStore
  templates: GuardTemplate[]
  folders: string[]
  writes: { door: string; body: unknown }[]
}
export declare function newTemplatesState(): TemplatesState
export declare function templatesStub(
  method: string,
  path: string,
  body: unknown,
  opts?: { state?: TemplatesState; deny?: string[]; reads?: Record<string, number>; user?: string; now?: string },
): FulfillArg | null

// --- 617 ---
import type { CategoryRule, CategoryRuleset, CoverageRule, CoverageRuleset } from '../src/core/insurance-rules/coverage-model'
import type { InsurerRow, InsurerSettings, SettingsLogRow } from '../src/features/insurance-rules/coverage/settings'
export declare const COVERAGE_FIELDS: RegistryField[]
export declare const POLICY_LIST_SASREF: string
export declare const INSURERS: InsurerRow[]
export declare const INSURER_SETTINGS: Record<string, InsurerSettings>
export declare const SETTINGS_LOG: Record<string, SettingsLogRow[]>
export declare const CATEGORY_RULESET: CategoryRuleset
export declare const COVERAGE_RULESET: CoverageRuleset
export declare const K_001: Pick<CategoryRule, 'name' | 'folder' | 'when' | 'then'>
export declare const NO_DEDUCTIBLE: Pick<CoverageRule, 'name' | 'folder' | 'when' | 'then'>
export interface CoverageState {
  lists: ListsState
  insurers: InsurerRow[]
  settings: Record<string, InsurerSettings>
  log: Record<string, SettingsLogRow[]>
  categories: CategoryRuleset
  coverage: CoverageRuleset
  writes: { door: string; method: string; path: string; body: unknown }[]
}
export declare function newCoverageState(): CoverageState
export declare function validateRuleset(doc: CategoryRuleset | CoverageRuleset): GuardIssue[]
export declare function coverageStub(
  method: string,
  path: string,
  body: unknown,
  opts?: { state?: CoverageState; deny?: string[]; reads?: Record<string, number>; query?: URLSearchParams },
): FulfillArg | null

// --- 612 ---
import type { SimulateBody, SimulateResult } from '../src/features/insurance-rules/simulator/simulate'
import type { GuardBacktest } from '../src/core/insurance-rules/backtest'
export declare const SIM_PATIENT: string
export declare function simulateGuards(body: SimulateBody): SimulateResult
export declare function backtestReport(days: number, revision?: number): GuardBacktest
export interface BacktestStore {
  next: number
  jobs: Record<string, { days: number; reads: number; revision: number }>
  starts: unknown[]
  simulates: unknown[]
}
export declare function newBacktestStore(): BacktestStore
export declare function simulatorStub(
  method: string,
  path: string,
  body: unknown,
  opts?: { store?: BacktestStore; deny?: string[] },
): FulfillArg | null
