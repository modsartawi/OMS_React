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
  /** 895: the curators' counts of readers' own readings (`readerCountRows`); absent when the server sends none (switch off). */
  readerCounts?: ReaderCountRow[]
}

/** 895: one kind of default reading as the house-rules screen draws its counts (`features/copilot/rules`). */
export interface ReaderCountRow {
  kind: CopilotOwnReadingKind
  readers: number
  values: { value: string; readers: number; label: AnalyticsLabel | null }[]
  /** Null: nothing is drawn for the other values. */
  other: number | null
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
  /**
   * BackOffice spec 3633 R30 (3691, oms-react 895): how many readers hold their own reading of each kind, and the values
   * held by at least `minimumReaders`. Absent with `Copilot:Answers:OwnReadings` off. Read-only: the save never sends it.
   */
  readerReadings?: CopilotReaderReadings
}

/** The four kinds of default reading a reader may hold their own of (spec 3633), in the order the server sends them. */
export type CopilotOwnReadingKind = 'period' | 'comparison' | 'scope' | 'money-base'

/** 3691: the curators' counts. No reader is ever named; a value held by fewer than `minimumReaders` is never sent. */
export interface CopilotReaderReadings {
  /** 5 (R30). */
  minimumReaders: number
  /** Always the four kinds, in `CopilotOwnReadingKind` order. */
  kinds: CopilotReaderReadingKind[]
}

/** 3691: one kind's count. `readers` may exceed the sum shown: values under the threshold are not listed. */
export interface CopilotReaderReadingKind {
  kind: CopilotOwnReadingKind
  /** Readers holding their own reading of this kind; 0 = none. Shown whatever its size: it names no value. */
  readers: number
  /** Only values held by at least `minimumReaders`, most held first; may be empty. */
  values: CopilotReaderReadingValue[]
  /** The readers on every value not listed, together; null when they too are fewer than `minimumReaders` (show nothing). */
  other: number | null
}

/**
 * 3691: one value and its readers. `value` is the stored code: a period's named period (`last-7-days` …), a comparison's
 * `previous` | `last-year` | `both` | `none`, a scope's `chain` | `ksa` | `bahrain` | `named-set` (every named set
 * together, never by name), or a money base's measure key. The screen names the codes itself, except a money base.
 */
export interface CopilotReaderReadingValue {
  value: string
  readers: number
  /** A money base only: its name in the analytics model (its key in both when the model has none). Absent otherwise. */
  label?: AnalyticsLabel
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
   * BackOffice 3685 (spec 3633 R15, oms-react 892): a tapped assumption line's choice. Sent with `question` = the tapped
   * answer's question, verbatim, and the same `conversationId`; the server re-asks it with the reading stated. Ignored
   * where own readings do not apply; a reading the server does not allow is the `COPILOT-430` envelope.
   */
  statedReading?: CopilotStatedReading
}

/** 3685: a reading stated by a tap, `value` the readings store's code (as `CopilotAssumptionChoice.choices[].value`). */
export interface CopilotStatedReading {
  kind: CopilotOwnReadingKind
  value: string
}

/**
 * BackOffice 3685 (spec 3633 R15): the other readings one server-written assumption line offers. A line with no entry
 * is not tappable.
 */
export interface CopilotAssumptionChoice {
  /** 0-based index into the answer's `assumptions`. */
  line: number
  kind: CopilotOwnReadingKind
  /** The reading the query used; `null` when it was none of the named ones (a fixed range). */
  value: string | null
  /** Never holds `value`. A tap sends `statedReading: { kind, value: choices[i].value }`. */
  choices: CopilotReadingChoice[]
}

/** One reading a line offers (3685): the store code and its words. */
export interface CopilotReadingChoice {
  value: string
  label: AnalyticsLabel
}

/**
 * BackOffice 3686 (spec 3633 R16-R18): "Always read it this way for me?", offered once, under the answer that corrected
 * an assumed reading. The server writes every word; the client shows `offer` with Keep and Not now.
 */
export interface CopilotReadingOffer {
  /** 32 hex: what Keep and Not now name as `offerId`. */
  id: string
  kind: CopilotOwnReadingKind
  /** The store code the server holds; Keep stores THIS, never a value the client sends. */
  value: string
  label: AnalyticsLabel
  /** The question, in both languages. */
  offer: AnalyticsLabel
}

/** `POST Copilot/Readings/Keep` and `POST Copilot/Readings/NotNow` body (3686). */
export interface CopilotReadingOfferRequest {
  conversationId: string
  offerId: string
}

/**
 * `POST Copilot/Readings/Keep` -> `data` (3686). `line` is shown in place of the buttons. Refusals: `COPILOT-437` (the
 * offer is no longer open: hide the buttons), `COPILOT-430` (the reading is no longer allowed), `COPILOT-401`.
 */
export interface CopilotReadingKept {
  kind: CopilotOwnReadingKind
  value: string
  /** Estate local wall-clock, `yyyy-MM-ddTHH:mm:ss`. */
  keptAt: string
  line: AnalyticsLabel
}

/** `POST Copilot/Readings/NotNow` -> `data` (3686): the line is hidden; no offer of that kind until the conversation ends. */
export interface CopilotReadingNotNow {
  kind: CopilotOwnReadingKind
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
   * BackOffice 3685 (spec 3633 R15, oms-react 892): the assumption lines that offer other readings. Absent: no line is
   * tappable (`Copilot:Answers:OwnReadings` off, or no line offers anything).
   */
  assumptionChoices?: CopilotAssumptionChoice[]
  /** BackOffice 3686 (R16): absent unless this answer offers to keep a reading. At most one. */
  readingOffer?: CopilotReadingOffer
  /** Estate local wall-clock, `yyyy-MM-ddTHH:mm:ss`. */
  askedAt: string
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

// ── "What the copilot knows about me" (BackOffice spec 3633 R25/R28/R29, door 3689, oms-react 894) ─────────────────
// Every door behind the cookie and `[Copilot, 01]`: `COPILOT-401` without the grant, `COPILOT-430` while own readings
// are off (a 430 on `GET Copilot/Me` reads as "feature off": the page's entry is hidden). The reader is always the
// cookie's user. Nothing is cached server-side, so a change, a delete or "forget" is used from the next question (R29).

/** One value a kept reading may be changed to (or the value it holds), labelled in both languages. */
export interface CopilotReadingChoice {
  value: string
  label: AnalyticsLabel
}

/** Who kept it: accepted from an answer's offer, changed on this page, or said directly. */
export type CopilotKeptBy = 'offer' | 'page' | 'direct'

/** 3689: one kept reading. */
export interface CopilotKeptReading {
  kind: CopilotOwnReadingKind
  value: string
  label: AnalyticsLabel
  /** R25: the server no longer has the value, and no question uses it (drawn struck through; Change or Delete). */
  unused: boolean
  /** Every value the reading may be changed to. */
  choices: CopilotReadingChoice[]
  /** `yyyy-MM-ddTHH:mm:ss`. */
  keptAt: string
  keptBy: CopilotKeptBy
}

/** 3689: one member of a named set; `key` is the name lookup's (`store:S101`, `city:Jeddah`, …). */
export interface CopilotSetMember {
  key: string
  kind: string
  label: AnalyticsLabel
  /** R25: no longer in the store master / channel list. A gone member must be left out of an edit. */
  gone: boolean
}

/** 3689: one named set, by name. */
export interface CopilotNamedSet {
  /** 26-char ULID. */
  setId: string
  name: string
  kind: string
  members: CopilotSetMember[]
  /** How many members are gone. */
  gone: number
  keptAt: string
  keptBy: CopilotKeptBy
}

export interface CopilotKnowsMeLimits {
  maxSets: number
  maxMembers: number
  maxName: number
}

/**
 * `GET Copilot/Me` → `data` (3689 `CopilotKnowsMePage`): the page's one payload. `readings` holds only kept kinds, in
 * the order period, comparison, scope, money-base. The investigations spec adds its profile beside these.
 */
export interface CopilotKnowsMe {
  readings: CopilotKeptReading[]
  sets: CopilotNamedSet[]
  limits: CopilotKnowsMeLimits
}

/** `POST Copilot/Me/Readings` → one reading (`keptBy: "page"`). `COPILOT-430` for a kind or value not allowed. */
export interface CopilotKeepReadingRequest {
  kind: CopilotOwnReadingKind
  value: string
}

/** `POST Copilot/Me/Readings/Delete`. */
export interface CopilotDeleteReadingRequest {
  kind: CopilotOwnReadingKind
}

/**
 * `POST Copilot/Me/Sets` → one set, its members replaced in the order given (name and id kept). `COPILOT-433`: not the
 * reader's set, a member the server cannot find now, two kinds, 0 or over `maxMembers` members.
 */
export interface CopilotEditSetRequest {
  setId: string
  members: string[]
}

/** `POST Copilot/Me/Sets/Delete`. */
export interface CopilotDeleteSetRequest {
  setId: string
}

/** `…/Delete` → `data`; `false` = already gone. */
export interface CopilotDeleted {
  deleted: boolean
}

/** `POST Copilot/Me/Forget` (no body) → how many readings and sets went, in one transaction. */
export interface CopilotForgotten {
  removed: number
}

/**
 * `GET Copilot/Me/Lookup?text=` → the name lookup's stores, cities, regions and channels, best first (at most 20).
 * `COPILOT-433` for a blank / over-100-character text, text that looks like personal data, or no lookup on the server.
 */
export interface CopilotMeLookup {
  text: string
  matches: CopilotSetMember[]
}
