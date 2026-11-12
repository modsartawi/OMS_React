import type { AnalyticsBoardDefinition, AnalyticsLabel, AnalyticsReportDefinition } from './analytics'

/**
 * The copilot's wire shapes (spec 734 D10; doors `Copilot/Access` and `Copilot/Ask`, BackOffice BO-1,
 * unbuilt). camelCase, as ASP.NET Core emits. A shape change goes into the spec's D10 first, then here.
 *
 * Refusals are not here: they are envelope business outcomes (`COPILOT-401` … `COPILOT-406`, D7)
 * read through `@/core/api`'s `apiErrorCode`. Only a refusal's `data` is (`CopilotPromptFieldRefusal`).
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
  /**
   * BackOffice spec 3586 A23 (3593, oms-react 874): the active version's default readings; `""` when it has none of
   * its own, and it then uses `builtInDefaultReadings`. On the wire whether `Copilot:Answers:DefaultReadings` is on or off.
   */
  defaultReadings: string
  /** The built-in default readings (A24): show them when `defaultReadings` is `""`, and send `""` back unless edited. */
  builtInDefaultReadings: string
  /** The default readings' own limit, 2000 (A25): not taken from the house rules' `maxLength`. */
  defaultReadingsMaxLength: number
  /**
   * Spec 3586 A51 (3600, oms-react 875): the active version's starters, each with its proof; both lists empty when it
   * has none. Absent with `Copilot:Answers:Starters` off.
   */
  starters?: CopilotStarterSet
  /** 3600: the most starters for one kind of reader, 6. Absent with the switch off. */
  startersPerKind?: number
  /** 3600: the longest starter text in one language, 200. Absent with the switch off. */
  starterMaxLength?: number
}

/** One version as `GET Copilot/Prompt/History`, `POST Copilot/Prompt` and `…/Revert` return it (`CopilotPromptVersionView`). */
export interface CopilotPromptVersionWire {
  version: number
  houseRules: string
  note: string
  savedBy: string
  savedAt: string
  revertedFrom: number | null
  /** 3593: the version's default readings; `""` when it has none of its own (the built-in text). */
  defaultReadings: string
  /** 3600: the version's starters, each with its proof; absent with `Copilot:Answers:Starters` off. */
  starters?: CopilotStarterSet
}

/**
 * `POST Copilot/Prompt` body. `baseVersion` is the version the draft was edited from (`COPILOT-411` when stale). One
 * save makes one version holding all three texts.
 */
export interface CopilotPromptSaveRequest {
  houseRules: string
  note: string | null
  baseVersion: number
  /**
   * 3593: the default readings, at most 2,000 characters (else `COPILOT-412` naming `defaultReadings`). Absent, null or
   * blank: the version has none of its own. Send `""`, not the built-in text, when the curator did not change it.
   */
  defaultReadings?: string | null
  /**
   * 3600: the starters, each non-blank one with its trial's proof (a stored proof is sent back unchanged); a failing one
   * is `COPILOT-412` naming its path. Absent or two empty lists: none. Ignored with `Copilot:Answers:Starters` off.
   */
  starters?: CopilotStarterSet
}

/** `POST Copilot/Prompt/Try` body: a question answered with the draft house rules, saved or not. */
export interface CopilotPromptTryRequest {
  houseRules: string
  question: string
  /** 3593: the draft default readings, checked like a save. Absent or blank: the trial uses the built-in text. */
  defaultReadings?: string | null
}

/**
 * Spec 3586 A51 (3600): one house-rules version's starter questions, a list for each kind of reader. Both lists are
 * always there, at most `startersPerKind` (6) each.
 */
export interface CopilotStarterSet {
  /** For a reader holding one of the configured executive roles (A53). */
  executive: CopilotStarter[]
  /** For everyone else. */
  operations: CopilotStarter[]
}

/** The two kinds of reader a starter is written for (A51, A53). */
export type CopilotReaderKind = 'executive' | 'operations'

/** One starter as the house-rules doors carry it (3600, A51, A52). */
export interface CopilotStarter {
  /** Both languages needed, each at most `starterMaxLength` (200) characters after trimming. */
  question: AnalyticsLabel
  /** A52: the question has a blank the reader fills; the panel puts it in the question box and it needs no proof. */
  blank: boolean
  /** A52: the tool call that answered it in the curator's trial (one `trace` entry's `tool` and `input`). Absent on a blank starter. */
  proof?: CopilotStarterProof
}

/** A52: a starter's proof - one entry of the trial answer's `trace`; the server checks it without running it. */
export interface CopilotStarterProof {
  tool: string
  input: Record<string, unknown>
}

/**
 * `COPILOT-412`'s `data` (3593, 3600): the field the refusal is about. `defaultReadings`, or a starter's path with a
 * zero-based index (`starters.executive`, `starters.executive[0]`, `starters.executive[0].question.en` / `.ar`,
 * `starters.executive[0].proof`); the message counts from 1. A `COPILOT-412` with no `data` is about the house rules.
 */
export interface CopilotPromptFieldRefusal {
  field: string
}

/**
 * `GET Copilot/Starters` → `data` (3601, A53, oms-react 873): the starters for the asking reader's kind, gated like
 * `Ask`. An empty `starters` (the switch off, none saved, or the reader's own list empty) means the panel keeps its two
 * fixed examples.
 */
export interface CopilotReaderStarters {
  /** Absent when there are no starters to give (the switch off, or none saved). */
  kind?: CopilotReaderKind
  /** In their saved order. */
  starters: CopilotReaderStarter[]
}

/** One starter as a reader gets it: never the proof. A tap asks it with `origin: 'starter'`; a `blank` one fills the box. */
export interface CopilotReaderStarter {
  question: AnalyticsLabel
  blank: boolean
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
  /**
   * BackOffice 3597 (spec 3586 A37, A55, oms-react 872): on a reply to an `asked` answer, its `ask.id`, always with
   * that answer's `conversationId`. The reply continues the asked question (same `questionNo`, nothing taken from the
   * hourly limit). An id naming no pending ask is ignored: the request is a new question. Absent on any other question.
   */
  askId?: string
  /**
   * 3597: with `askId`, the `key` of the tapped choice. Absent when the reader typed: `question` is then the reply. On a
   * tap `question` is still sent, as the choice's label shown (it is the new question if the ask is gone).
   */
  choiceKey?: string
  /** 3598 (A49, A55): where the question came from. Only the audit keeps it; absent is "not said", never refused. */
  origin?: CopilotQuestionOrigin
  /**
   * BackOffice 3664 (spec 3631 S18, S37, oms-react 885): Confirm or Cancel of a `proposed` answer's card, always with that
   * answer's `conversationId`. A request carrying it is not a question: `question` is not read (send `''`), the model is
   * not called and nothing is taken from the hourly limit.
   */
  confirmation?: CopilotConfirmation
  /**
   * BackOffice spec 3632 Q27 (3673, oms-react 888): the panel's SQL mode toggle. Sent `true` only while the toggle is on,
   * and the toggle shows only on `Analytics/Access`'s `canSql`. The server reads it per request (send it on a reply to
   * an ask too) and ignores it, never refuses, for a reader without the grant or off the panel. Absent: a normal question.
   */
  sqlMode?: boolean
  /**
   * BackOffice 3678 (spec 3632 Q46, oms-react 890): a SQL item opened in the copilot ("Change by asking"). Sent with
   * `sqlMode: true` on the question that OPENS the item only; follow-ups omit it. Refused `COPILOT-456` (no data) when not
   * in SQL mode, not a readable SQL item, or the reader may not change it. Only the id: the server reads the rest.
   */
  sqlItemContext?: { itemId: string }
}

/** The confirmation of a proposal (3664): its id, and the card's values, or a cancel. */
export interface CopilotConfirmation {
  /** The proposed answer's `proposal.id`. */
  proposalId: string
  /** Cancel: `values` are not read. */
  cancel?: boolean
  /** The card as the reader left it; absent (or a field absent) is "as proposed". */
  values?: CopilotConfirmationValues
}

/** The card's values a confirmation sends (3664). */
export interface CopilotConfirmationValues {
  /** Cut to 80 characters by the server. */
  title?: string
  cadence?: { kind: CopilotCadenceKind; days?: CopilotWeekday[] | null; day?: string | null }
  /** `HH:mm`, Riyadh. */
  time?: string
  /** Read only when the card offered `periodChoices`. */
  periodChoice?: CopilotPeriodChoice
  /** Read ONLY for the language of the "expired" sentence: send the proposal's own. */
  lang?: 'en' | 'ar'
  /**
   * BackOffice 3665 (oms-react 887): a pause/delete card's chosen schedule (a `choices[].id`), and the only value such a
   * confirmation reads. Omitted on a one-choice card (the server takes its only choice). Missing when several were
   * offered, or not one of them: `COPILOT-441` with `data.problems[{ field: 'choice', reason: 'required' | 'badChoice' }]`.
   */
  choice?: string
}

/**
 * The SQL item a conversation was opened on (Q46): its id, sent as `sqlItemContext`, and the revision it was opened at,
 * the `baseRevision` of the reader's Save (the item's own `PUT`) so a save in between is refused `ANALYTICS-405`.
 */
export interface CopilotSqlItemRef {
  itemId: string
  revision: number
}

/**
 * The request's `origin` (3598): typed, a tapped suggestion (its `question` sent as the question), a tapped starter
 * (3601), or a tapped choice of an `ask` (beside `askId` and `choiceKey`).
 */
export type CopilotQuestionOrigin = 'typed' | 'suggestion' | 'starter' | 'choice'

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

/**
 * The audit's outcome (D6), as the answer carries it. BackOffice spec 3586 adds two, each only with its server switch
 * on: `figures-only` (3590, `Copilot:Answers:NumberCheck`: `answer` is a fixed sentence holding none of the model's
 * words, `tables` every analytics result, `orderRefs` `[]`) and `asked` (3596, `Copilot:Answers:AskUnclearName`: `ask`
 * holds the question; `answer` repeats it as plain text and is not drawn beside it). The audit's own `trial-figures-only`
 * and `trial-asked` never reach an answer.
 */
export type CopilotOutcome =
  | 'answered'
  | 'cannot-answer'
  | 'refused'
  | 'blocked-pii'
  | 'limit'
  | 'error'
  | 'figures-only'
  | 'asked'
  | 'proposed'
  | 'confirmed'
  | 'cancelled'
  | 'expired'
  | 'not-confirmed'

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
  /**
   * `edit_report`'s unsaved definition for the report in context (spec 819 §D); absent reads as none. With
   * `Copilot:Answers:NumberCheck` on (BackOffice 3591) its `note` may be the fixed "The change is ready to review."
   */
  reportEdit?: CopilotReportEdit | null
  /** `edit_board`'s unsaved definition for the board in context (836, BackOffice 3430); absent reads as none. 3591 as `reportEdit`. */
  boardEdit?: CopilotBoardEdit | null
  /**
   * What the answer assumed, one line each, in both languages, at most 10 (802 item 1). First a built or edited
   * report's; with `Copilot:Answers:DefaultReadings` on (BackOffice 3594, oms-react 870) also an answer where no report
   * or board tool ran, written by the server. With `Copilot:Answers:NumberCheck` on (3591) a failing line is dropped.
   * `[]` on an `asked` answer.
   */
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
  /**
   * BackOffice 3596 (spec 3586 A36, A54, oms-react 872): the server's question about a name the reader typed. Present
   * exactly when `outcome` is `asked`; absent (never null) otherwise. On `Copilot/Prompt/Try` it is shown only
   * (`conversationId` `""`): it cannot be replied to.
   */
  ask?: CopilotAsk
  /**
   * BackOffice 3598/3599 (spec 3586 A46, A47, A54, oms-react 871): 1 to 3 next questions the server has checked as
   * answerable, the model's first, in the order to show. Absent (never null, never `[]`) with
   * `Copilot:Answers:Suggestions` off, on an `asked` or `refused` answer, on the conversation's last question
   * (`questionNo` 10), or when none passed the check.
   */
  suggestions?: CopilotSuggestion[]
  /**
   * BackOffice 3663 (spec 3631 S13, S36, oms-react 885): what the reader may confirm. Present exactly when `outcome` is
   * `proposed`; absent (never null) otherwise, and always with `Copilot:Schedule:Propose` off. `answer` then holds the
   * same lines as plain text, for a client that does not draw the card.
   */
  proposal?: CopilotProposal
  /**
   * 3663/3664: a proposal refused for the reader's own reason. On an `answered` answer (3663: `limit`, `noCompanyEmail`)
   * or a `not-confirmed` one (3664, which adds `noViewGrant`; the card stays confirmable). `limit` links "My schedules".
   */
  scheduleRefusal?: CopilotScheduleRefusal
  /** 3664: ONLY on `confirmed`: what was saved and when it is first sent. A confirmed pause/delete carries none. */
  confirmed?: CopilotConfirmed
  /** 3665 (oms-react 887): ONLY on a `confirmed` pause/delete: the schedule paused or deleted. */
  stopped?: CopilotStopped
  /**
   * BackOffice 3673 (spec 3632 Q33, oms-react 888): the answer's SQL part. ABSENT on every answer not given in SQL mode.
   * `assumptions` is `[]` and `tables` absent in SQL mode: the rows are here.
   */
  sql?: CopilotSqlPart
  /**
   * BackOffice 3674 (spec 3632 Q28, oms-react 888): "Try in SQL mode", added by the server (never the model) to a
   * `cannot-answer` given OUTSIDE SQL mode, on the panel, to a reader holding the SQL grant. Absent on every other answer.
   */
  sqlOffer?: CopilotSqlOffer
  /** Estate local wall-clock, `yyyy-MM-ddTHH:mm:ss`. */
  askedAt: string
}

/** The kinds of proposal: `schedule` (3663); 3665 adds `pause` and `delete`. */
export type CopilotProposalKind = 'schedule' | 'pause' | 'delete'

export type CopilotWeekday = 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat'
export type CopilotCadenceKind = 'daily' | 'weekly' | 'monthly'
/** How a fixed period is read on each send (S32): the same length ending at the send, or the same dates. */
export type CopilotPeriodChoice = 'sameLength' | 'sameDates'

/** A proposal (3663): the server writes all of it, the model none. */
export interface CopilotProposal {
  /** What the confirmation names (3664). */
  id: string
  kind: CopilotProposalKind
  /** The card, in order, in both languages: what, one "- <block>" per block, when, how the period is read, to whom. */
  lines: AnalyticsLabel[]
  values: CopilotProposalValues
  /** 3665: pause/delete only, 1..4 in "My schedules" order (one must be picked when several); absent on `schedule`. */
  choices?: CopilotProposalChoice[]
}

/** A schedule a pause/delete card offers (3665). */
export interface CopilotProposalChoice {
  /** The schedule's id ("My schedules"' id): what `values.choice` names. */
  id: string
  /** Both languages hold the reader's own words. */
  title: AnalyticsLabel
  /** "every Monday at 07:00 Riyadh time". */
  when: AnalyticsLabel
  /** Always false on a pause card (paused ones are not offered). */
  paused: boolean
}

/** A confirmed pause or delete (3665). */
export interface CopilotStopped {
  kind: 'pause' | 'delete'
  scheduleId: string
  title: string
}

/**
 * The card's editable values as proposed (3663). On a pause/delete card (3665) they are read only: `lang` is the
 * question's, `title`/`cadence`/`time` the one matched schedule's (empty strings when several matched), the period null.
 */
export interface CopilotProposalValues {
  /** The question that produced the answer, at most 80 characters. */
  title: string
  /** Weekly: `days`; monthly: `day` (`'1'`..`'28'` or `'last'`); the other null. */
  cadence: { kind: CopilotCadenceKind; days: CopilotWeekday[] | null; day: string | null }
  /** `HH:mm` Riyadh, default `07:00`. */
  time: string
  /** The question's language. */
  lang: 'en' | 'ar'
  /** null: a relative period, no choice to show. */
  periodChoice: CopilotPeriodChoice | null
  /** Fixed dates: `[sameLength, sameDates]`; dates of different lengths: `[sameDates]`; else null. */
  periodChoices: { key: CopilotPeriodChoice; label: AnalyticsLabel }[] | null
  /** 3665, pause/delete: preset to the only choice; ABSENT when the reader must choose. */
  choice?: string
}

/**
 * Why a proposal was not made or not saved (3663, 3664). `limit` and `held` only on `limit`. `notFound` (3665): the
 * schedule a pause/delete named was gone meanwhile (`not-confirmed`).
 */
export interface CopilotScheduleRefusal {
  reason: 'limit' | 'noCompanyEmail' | 'noViewGrant' | 'notFound'
  limit?: number
  held?: number
}

/** A confirmed save (3664). */
export interface CopilotConfirmed {
  scheduleId: string
  reportId: string
  /** `yyyy-MM-ddTHH:mm:ss` Riyadh. */
  firstSendAt: string
}

/** One suggested next question (3598). A tap sends `question` as a normal question with `origin: 'suggestion'`. */
export interface CopilotSuggestion {
  /** In the reader's language, at most 200 characters. */
  question: string
  by: CopilotSuggestionBy
}

/** Who wrote a suggestion: the model (3598), or the server from an analytics query of the answer (3599). */
export type CopilotSuggestionBy = 'model' | 'server'

/** The copilot's question about an unclear name (3596, `ask`). The server writes all of it, the model none. */
export interface CopilotAsk {
  /** What the reply names as `askId` (3597). */
  id: string
  /** The fixed question in both languages; with no choice, the "type the name again" sentence. */
  question: AnalyticsLabel
  /** The unclear text, as it was looked up. */
  text: string
  /** 0 to 4, in the order to show. `[]`: the reader types the name again. */
  choices: CopilotAskChoice[]
}

/** One choice of an `ask` (3596). */
export interface CopilotAskChoice {
  /** `kind:key` (`city:Jeddah`, `store:S102`): what a tap sends back as `choiceKey`. */
  key: string
  /** Ready to show: the name, its kind and, for a store, its city. */
  label: AnalyticsLabel
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

/**
 * An answer's SQL part (BackOffice 3673, spec 3632 Q33): the last statement that ran, as the server ran it, and its result.
 * Shown under the "SQL, not a certified figure" mark.
 */
export interface CopilotSqlPart {
  /** Always `"sql"`. */
  mark: 'sql'
  /** False: no statement ran (the model said it cannot answer, or every statement was refused); then `step` is null,
   *  `statement` `""`, the lists empty and the counts 0. */
  ran: boolean
  /** 0-based index of its `run_sql` call in `trace`. */
  step: number | null
  /** As the server ran it: laid out by the parser, with the server's `TOP 1001` cap. */
  statement: string
  /**
   * 3632 review, item 14 (BackOffice 3673 Build notes): the same statement as the model authored it, trimmed, before the
   * server's layout and its inserted `TOP 1001` cap; `""` when nothing ran. A Save sends THIS. Absent from an older server.
   */
  authoredStatement?: string
  /** The analytics tables it read, the allow-list's spelling, each once, in the order met. */
  tables: string[]
  /** The result's columns, the database's order. */
  columns: string[]
  /**
   * EVERY returned row (at most 1,000), cells in `columns`' order, each the invariant text: a date `yyyy-MM-dd`, a time
   * `yyyy-MM-ddTHH:mm:ss`, a number as stored. `null` is SQL NULL.
   */
  rows: (string | null)[][]
  rowCount: number
  /** More than 1,000 rows: `rows` are the first 1,000. */
  isCut: boolean
  durationMs: number
}

/**
 * "Try in SQL mode" (BackOffice 3674, spec 3632 Q28). The tap: `POST Copilot/Ask { question, sqlMode: true,
 * conversationId }` (omitted when null) and the toggle turned on. It is a new question.
 */
export interface CopilotSqlOffer {
  /** The question the reader asked (for a reply to the copilot's own question, that question, not the reply). */
  question: string
  /** Ask in this conversation; `null`: this was its last question, start a new one. */
  conversationId: string | null
}
