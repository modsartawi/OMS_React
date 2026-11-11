import type { AnalyticsBoardDefinition, AnalyticsLabel, AnalyticsReportDefinition } from './analytics'

/**
 * The copilot's wire shapes (spec 734 D10; doors `Copilot/Access` and `Copilot/Ask`, BackOffice BO-1,
 * unbuilt). camelCase, as ASP.NET Core emits. A shape change goes into the spec's D10 first, then here.
 *
 * Refusals are not here: they are envelope business outcomes (`COPILOT-401` … `COPILOT-406`, D7)
 * read through `@/core/api`'s `apiErrorCode`.
 */

/** `GET Copilot/Access` — both flags read `BackOfficeScreen[Copilot, 01]` (D7). */
export interface CopilotAccess {
  /** May open the panel and ask (`POST Copilot/Ask`). */
  canAsk: boolean
  /** May reach the same tools over `/mcp` (D8) — not read by the web. */
  canUseMcp: boolean
  /**
   * May edit the house rules at `/copilot/rules` (ticket 790, BackOffice 3395). Absent on a pre-3395
   * server, and read as denied.
   */
  canCurate?: boolean
}

/**
 * One saved version of the copilot's house rules, as the screen holds it (ticket 790). Read off BackOffice 3395's
 * wire by `fromPromptWire` / `fromVersionWire` (`features/copilot/rules`): the wire calls the text `houseRules`
 * and sends `""` for an absent saver, time or note, read here as `null`. Version 0 is the built-in text, when no
 * version is stored yet (a save then makes version 1).
 */
export interface CopilotPromptVersion {
  version: number
  /** The house rules, at most 4,000 characters. */
  text: string
  savedBy: string | null
  /** Estate local wall-clock, `yyyy-MM-ddTHH:mm:ss`; null on version 0. */
  savedAt: string | null
  /** "Why the change", optional. */
  note: string | null
  /** Set on a version a restore made: the version it copied. */
  revertedFrom: number | null
}

/** The locked core (read-only, never sent back) and the active house rules, as the screen holds them. */
export interface CopilotPrompt {
  core: string
  active: CopilotPromptVersion
}

/** `GET Copilot/Prompt` → `data` (BackOffice 3395 `CopilotPromptView`): the active version, flat. */
export interface CopilotPromptWire {
  core: string
  houseRules: string
  /** 0 when none is stored yet. */
  version: number
  savedBy: string
  /** `yyyy-MM-ddTHH:mm:ss`; `""` on version 0. */
  savedAt: string
  note: string
  maxLength: number
}

/** One version as `GET Copilot/Prompt/History`, `POST Copilot/Prompt` and `…/Revert` return it (`CopilotPromptVersionView`). */
export interface CopilotPromptVersionWire {
  version: number
  houseRules: string
  note: string
  savedBy: string
  savedAt: string
  revertedFrom: number | null
}

/** `POST Copilot/Prompt` body. `baseVersion` is the version the draft was edited from (`COPILOT-411` when stale). */
export interface CopilotPromptSaveRequest {
  houseRules: string
  note: string | null
  baseVersion: number
}

/** `POST Copilot/Prompt/Try` body: a question answered with the draft house rules, saved or not. */
export interface CopilotPromptTryRequest {
  houseRules: string
  question: string
}

/** `POST Copilot/Prompt/Revert` body: the version to restore; the server makes it a new version. */
export interface CopilotPromptRevertRequest {
  version: number
}

/**
 * The report open in the designer (spec 819 §D, ticket 832, ⚠ proposed): its id, the revision it was loaded or saved
 * at, and the designer's working copy, saved or not. Sent on Ask so "add the cancellation rate as a bar" edits THAT
 * report; the AI then answers a `reportEdit` and never saves it.
 */
export interface CopilotReportContext {
  /**
   * The report's id, or `null` for a new report not saved yet (story 101: the copilot edits what is open, saved or
   * not; ⚠ proposed — §D's `edit_report` takes `{ reportId, baseRevision | draft }`, here with no id and the draft).
   * `revision` is then 0.
   */
  reportId: string | null
  revision: number
  /**
   * The designer's working copy of the report's DEFINITION, in the store's wire shape (`{ params, bindings, sections }`),
   * not wrapped with its title: BackOffice reads it as the definition (3408 §I, 3421). Wrapped, the model was shown an
   * empty report and answered with one (835 walk).
   */
  draft: AnalyticsReportDefinition
}

/**
 * The board open in its editor (ticket 836, BackOffice 3430): its id and revision, and the editor's working copy of its
 * definition, bare, in the store's wire shape. Sent on Ask so "remove the stores chart" edits THAT board; the AI then
 * answers a `boardEdit` and never saves it.
 */
export interface CopilotBoardContext {
  boardId: string
  revision: number
  draft: AnalyticsBoardDefinition
}

/** `edit_board` against the board in context (3430): the validated FULL definition, unsaved; `note` says what changed. */
export interface CopilotBoardEdit {
  boardId: string
  definition: AnalyticsBoardDefinition
  note: AnalyticsLabel
}

/**
 * `POST Copilot/Ask` body. `conversationId` is sent back on a follow-up (D5); `reportContext` while a report is open in
 * the designer (832); `boardContext` while a board is open in its editor (836).
 */
export interface CopilotAskRequest {
  question: string
  conversationId?: string
  reportContext?: CopilotReportContext
  boardContext?: CopilotBoardContext
  /**
   * Ticket 869 (BackOffice spec 3558 D17, 3565): this question's client-minted ULID. With `Copilot:Speed:Steps` on,
   * `GET Copilot/Ask/{requestId}/Steps` reads its steps while it runs; with it off the server ignores it.
   */
  requestId?: string
}

/** `GET Copilot/Ask/{requestId}/Steps` -> `data` (BackOffice 3565). A 404 (no body): nothing yet, or the switch off. */
export interface CopilotSteps {
  requestId: string
  /** The answer call has returned (answered, refused or failed). */
  done: boolean
  /** Oldest first; the last is the current one. */
  steps: CopilotStep[]
}

/** One step: `model` | `tool:<name>` | `answer`. The panel shows its own words for it, never `label` (English only). */
export interface CopilotStep {
  step: string
  label: string
  /** Estate local wall clock, `yyyy-MM-ddTHH:mm:ss`. */
  at: string
}

/** One tool call the server made for the answer (D10 `trace`). */
export interface CopilotTraceEntry {
  tool: string
  input: Record<string, unknown>
  rows: number
  ms: number
  ok: boolean
}

/** A report the answer built (`create_report`) or saved (`edit_report` with no designer open): spec 819 §D, ⚠ proposed. */
export interface CopilotReportRef {
  id: string
  /** The revision now current: 1 for a new report. */
  revision: number
  title: AnalyticsLabel
  /**
   * The steps the words asked for that the AI never takes itself (spec 819 §D, story 108): the answer ends with
   * "Share…" and "Schedule…" links to the report's dialogs. ⚠ proposed field (the D10 shape has none yet); absent
   * reads as none.
   */
  nextSteps?: CopilotReportStep[]
}

/** A step the AI links instead of taking (§D: it never shares, certifies or schedules). */
export type CopilotReportStep = 'share' | 'schedule'

/**
 * `edit_report` against the report in context (spec 819 §D, ⚠ proposed): the validated FULL definition, unsaved. The
 * open designer applies it as one undo step; `note` says what changed.
 */
export interface CopilotReportEdit {
  /** The report it edits; `null` for the unsaved new report in context (⚠ proposed, as `CopilotReportContext.reportId`). */
  reportId: string | null
  definition: AnalyticsReportDefinition
  note: AnalyticsLabel
}

/** A view the answer created (spec 766 D, BackOffice 3383): its id and its bilingual title. */
export interface CopilotViewRef {
  id: string
  title: { en: string; ar: string }
}

/** The audit's outcome (D6), as the answer carries it. */
export type CopilotOutcome = 'answered' | 'cannot-answer' | 'refused' | 'blocked-pii' | 'limit' | 'error'

/** `POST Copilot/Ask` → `data`. */
export interface CopilotAnswer {
  conversationId: string
  /** 1–10 within the conversation (D5). */
  questionNo: number
  /** Plain text with light markdown: paragraphs, bullet lists and simple tables only. */
  answer: string
  /** The order or delivery numbers named in the answer. */
  orderRefs: string[]
  trace: CopilotTraceEntry[]
  outcome: CopilotOutcome
  /** The loop hit its 8-tool-call or 60-second cap and answered with what it had (D4). */
  stoppedEarly: boolean
  /** The provider and model that served the answer (D4). */
  servedBy: string
  /**
   * The analytics views `create_view` saved in this answer (spec 766 D, additive in BackOffice 3383).
   * Absent on an older server, and read as empty.
   */
  viewRefs?: CopilotViewRef[]
  /** The reports `create_report` / `edit_report` saved in this answer (spec 819 §D); absent reads as empty. */
  reportRefs?: CopilotReportRef[]
  /** `edit_report`'s unsaved definition for the report in context (spec 819 §D); absent reads as none. */
  reportEdit?: CopilotReportEdit | null
  /** `edit_board`'s unsaved definition for the board in context (836, BackOffice 3430); absent reads as none. */
  boardEdit?: CopilotBoardEdit | null
  /** What a built or edited report assumed, one line each, in both languages (802 item 1; ⚠ field name proposed). */
  assumptions?: AnalyticsLabel[]
  /**
   * The house-rules version the answer was given under (ticket 790, BackOffice 3395); 0 is the built-in
   * fallback. Absent on a pre-3395 server and `null` on a trial: either way not shown.
   */
  promptVersion?: number | null
  /**
   * Ticket 868 (BackOffice spec 3558 D5-D7, D13, 3564): the `semantic_query` results the model marked to show, each with
   * ALL its rows, drawn under the summary as the analytics table form. Empty or absent (the switch
   * `Copilot:Speed:PanelTables` off, or nothing marked): the answer renders as before.
   */
  tables?: CopilotAnswerTable[]
  /** Estate local wall-clock, `yyyy-MM-ddTHH:mm:ss`. */
  askedAt: string
}

/** One answer table (3564): a shown `semantic_query` result. Every value is text on the wire; a measure's is a number's invariant text. */
export interface CopilotAnswerTable {
  /**
   * 0-based index of its call in `trace`. NOT unique among an answer's tables (3621): an analysis result gives one table
   * per part, all on its one step, so a table is told apart by its place in `tables` as well.
   */
  step: number
  /**
   * BackOffice 3621 (spec 3587 B22; web 878): the title of a table made from a part of an analysis result (a cut's name,
   * "The headline"), in both languages. Absent on a plain query's table. A titled table's cells are the tool's own
   * texts ("62.0%", "-620"), shown as sent; the columns the tool computed are not in `query`, and `query` is `{}` when
   * the part came from no single query.
   */
  title?: AnalyticsLabel | null
  columns: CopilotTableColumn[]
  /** ALL the rows, in the result's order; `values` by column position. */
  rows: CopilotTableRow[]
  total: number
  truncated: boolean
  /** `yyyy-MM-dd`. */
  periodFrom: string
  periodTo: string
  previous: CopilotTableRow[] | null
  /** On an analysis result's table (3621): the comparison's days, for either comparison, while `previous` stays null. */
  previousFrom: string | null
  previousTo: string | null
  /**
   * BackOffice 3607 (spec 3587 B13; web 878): the rows of the same weeks last year when the query asked for them — `[]`
   * where no area holds those weeks — with their days (`yyyy-MM-dd`). All three absent when it did not ask.
   */
  lastYear?: CopilotTableRow[] | null
  lastYearFrom?: string | null
  lastYearTo?: string | null
  dataAsOf: string
  notes: CopilotTableNotes
  /** The `semantic_query` input it ran (the `show` mark taken off): what "Open as view" seeds the editor with. */
  query: CopilotTableQuery
}

/**
 * The `semantic_query` input a table ran: a view query (read through the analytics wire's `readDefinition`) plus the
 * tool's own `order` (a view sorts by its chart's one key instead) and `show` mark.
 */
export interface CopilotTableQuery {
  order?: { key: string; direction?: string | null }[] | null
  show?: unknown
  [field: string]: unknown
}

export interface CopilotTableColumn {
  key: string
  role: 'dimension' | 'measure'
  /** The header in both languages: the calculation's or variant's own label, else the model's, else the key. */
  label: AnalyticsLabel
  /** `count` | `SAR` | `minutes` | `percent`; null on a dimension. */
  unit: string | null
  shape: string | null
  dateBasis: AnalyticsLabel | null
  /** `from` (3607): `lastYear` on a change taken from the same weeks last year; absent on every other. */
  calculation: { kind: string; measure: string; of: string | null; within: string[] | null; from?: string | null } | null
  variant: { measure: string; filters: { dimension: string; values: string[] }[] } | null
}

export interface CopilotTableRow {
  values: (string | null)[]
  /** An "All" row (spec 3543 D12); null on every other row. */
  isTotal: boolean | null
}

/** The server's notes on a table; each null when it does not apply. */
export interface CopilotTableNotes {
  untilReached: boolean | null
  /** A running share within a parent: each parent's values in the `within` order, and whether it reached `until`. */
  untilReachedByParent: { parent: (string | null)[]; reached: boolean }[] | null
  notSplit: { measure: string; by: string[] }[] | null
  notFiltered: { measure: string; by: string[] }[] | null
  dataGap: string | null
  /** BackOffice 3607: each area that does not hold the same weeks last year, the day its data starts and its measures; absent otherwise. */
  lastYearNotHeld?: { area: string; dataFrom: string; measures: string[] }[] | null
}
