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
}

/** `POST Copilot/Ask` body. `conversationId` is sent back on a follow-up (D5). */
export interface CopilotAskRequest {
  question: string
  conversationId?: string
}

/** One tool call the server made for the answer (D10 `trace`). */
export interface CopilotTraceEntry {
  tool: string
  input: Record<string, unknown>
  rows: number
  ms: number
  ok: boolean
}

/** A view the answer created (spec 766 D, BackOffice 3383): its id and its bilingual title. */
/** A report the answer built or revised (CTO demo): its id, title and the revision now current. */
export interface CopilotReportRef {
  id: string
  title: string
  revision: number
}

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
  /** The reports `build_report` / `update_report` wrote in this answer (CTO demo); absent reads as empty. */
  reportRefs?: CopilotReportRef[]
  /** Estate local wall-clock, `yyyy-MM-ddTHH:mm:ss`. */
  askedAt: string
}
