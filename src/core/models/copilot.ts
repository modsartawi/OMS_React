import type { AnalyticsLabel, AnalyticsReportDefinition } from './analytics'

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
  draft: CopilotReportDraft
}

/** The designer's working copy: the report's words and its definition. */
export interface CopilotReportDraft {
  title: AnalyticsLabel
  subtitle: AnalyticsLabel
  definition: AnalyticsReportDefinition
}

/** `POST Copilot/Ask` body. `conversationId` is sent back on a follow-up (D5); `reportContext` while a report is open in the designer (832). */
export interface CopilotAskRequest {
  question: string
  conversationId?: string
  reportContext?: CopilotReportContext
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
  /** What a built or edited report assumed, one line each, in both languages (802 item 1; ⚠ field name proposed). */
  assumptions?: AnalyticsLabel[]
  /**
   * The house-rules version the answer was given under (ticket 790, BackOffice 3395); 0 is the built-in
   * fallback. Absent on a pre-3395 server and `null` on a trial: either way not shown.
   */
  promptVersion?: number | null
  /** Estate local wall-clock, `yyyy-MM-ddTHH:mm:ss`. */
  askedAt: string
}
