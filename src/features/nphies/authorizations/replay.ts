/**
 * **A reopen is a replay, not a restore** (ticket 221, spec 209 stories 81–85,
 * contract v1.0 §3.9).
 *
 * Pure: no React, no i18n, no network. Two rulings live here, and the second is
 * the one that makes the feature safe to have at all:
 *
 * 1. 🚩 **The replay is a genuinely NEW request.** Drafts are not resumable and a
 *    refused authorization is terminal (law 9), so this module produces a *plan*
 *    of verbs that **already exist** — `Open`, `SetInsurance`, `SetHeader`,
 *    `AddItem`, `UpdateLineInsurance`, `UpdateLineMeta` — and there is **no new
 *    session verb** and nothing anywhere that reaches for the terminal
 *    transaction. `replayVerbs` states that as data so a test can hold it.
 * 2. 🚩 **It must not pretend to be silent.** An item may since have been blocked,
 *    repriced, or lost its Nphies category. A scan that refuses is not a failure
 *    of the replay — it is *the information the agent needs*, and a silent
 *    restore would be worse than no feature at all, because the agent would press
 *    Submit believing they were resending the same request. So every line that
 *    did not come back the way it went out is **named**, and the report is built
 *    by comparing the plan against the engine's own answer rather than by trusting
 *    that the verbs worked.
 *
 * The source is the **write-ahead journal row** (§3.9), which already carries the
 * whole request and is the only source that covers a header-only refusal — one
 * the service's own guards threw before the lines were built.
 */

import { formatAmount } from '@/core/nphies/format'
import type {
  AuthDetail,
  AuthDetailLine,
  AuthJournalItem,
  AuthRequestJournal,
  NphiesAuthSessionLine,
  NphiesSessionDiagnosis,
  NphiesSessionInsurance,
} from '@/core/models/nphies'

const text = (raw: string | null | undefined) => (raw ?? '').trim()
const number = (raw: number | null | undefined) => (typeof raw === 'number' && Number.isFinite(raw) ? raw : 0)
/** Two item numbers are the same item — the same trimmed, case-folded comparison
 *  `auth-session` uses, because an item number is a machine code and a replay that
 *  matched it more loosely would report a line as missing that is on the request.
 *  Exported so the page's own line lookup cannot drift from the report's. */
export const sameItem = (a: string, b: string) => text(a).toUpperCase() === text(b).toUpperCase()

/** §3.9's `morphology` supporting-info category — `ClaimInformationCategoryConstants`. */
const MORPHOLOGY_CATEGORY = 'morphology'
/** §3.5's attachment category, on the same collection. */
const ATTACHMENT_CATEGORY = 'attachment'
/** `DiagnosisTypes.Principal`, and the type `Diagnoses` marks with its radio. */
const PRINCIPAL = 'principal'

// ---------------------------------------------------------------------------
// 1 · Decoding what was submitted
// ---------------------------------------------------------------------------

/**
 * The header diagnoses, out of the string the request stored them in.
 *
 * 🚩 **The encoding is the service's own and is not guessed**: `AuthRequest.Diagnosis`
 * is `type|code` rows joined by `,`, written by
 * `ProcessAddAuthRequest.cs:266` and parsed back by
 * `NphiesDiagnosis.GetDiagnosisList` (`Models/NphiesDiagnosis.cs`, read
 * 2026-08-02) — which splits on `,`, then on `|`, taking column 0 as the **type**
 * and column 1 as the **code**. §3.4 says the client owns parsing it because
 * `NAuthDiagnosis` is dead code upstream; this is that parse, in the same order
 * the service reads it.
 *
 * ⚠️ **The description is not in the encoding**, so it comes back empty. The
 * screen renders the code, which is what the exchange was actually sent; a
 * description invented from a lookup would be this client asserting a mapping the
 * request never carried.
 *
 * `morphology` rides on the principal, from the supporting info whose category is
 * `morphology` and whose **`code`** is the morph code (`Extensions.cs:705-710`).
 */
export function decodeDiagnoses(raw: string, morphology: string): NphiesSessionDiagnosis[] {
  return readDiagnoses(raw, morphology).diagnoses
}

/**
 * The same parse, plus **how many rows it could not read**.
 *
 * 🚩 Counted here rather than inferred from `rows.length - diagnoses.length` at
 * the call site: the service `.Distinct()`s its own rows, so a legitimately
 * repeated diagnosis is *not* an unreadable one, and a subtraction would report
 * the honest duplicate as a row nobody could parse.
 */
export function readDiagnoses(
  raw: string,
  morphology: string,
): { diagnoses: NphiesSessionDiagnosis[]; unreadable: number } {
  const rows = text(raw)
    .split(',')
    .map((row) => row.trim())
    .filter((row) => row !== '')
  const seen = new Set<string>()
  const diagnoses: NphiesSessionDiagnosis[] = []
  let unreadable = 0
  for (const row of rows) {
    const columns = row
      .split('|')
      .map((column) => column.trim())
      .filter((column) => column !== '')
    // A row that is not a `type|code` pair is not a diagnosis this client can
    // name. Dropping it silently would be the exact defect this module exists to
    // prevent, so it is left out of the plan and reported as a gap.
    if (columns.length < 2) {
      unreadable += 1
      continue
    }
    const [type, code] = columns
    // The service's own `.Distinct()`, and not a gap: the same diagnosis twice is
    // one diagnosis, upstream and here.
    if (seen.has(code.toUpperCase())) continue
    seen.add(code.toUpperCase())
    diagnoses.push({ code, type, description: '', morphology: '' })
  }
  const morph = text(morphology)
  if (morph !== '') {
    const principal = diagnoses.find((diagnosis) => text(diagnosis.type).toLowerCase() === PRINCIPAL)
    if (principal) principal.morphology = morph
  }
  return { diagnoses, unreadable }
}

/** One line the replay will ask for, and what it looked like when it was sent. */
export interface ReplayItem {
  sequence: number
  itemNumber: string
  quantity: number
  /** 🚩 The engine's money as it was **submitted** — carried ONLY so the report
   *  can say the replay priced differently. Nothing here is ever sent (law 1). */
  unitPrice: number
  extendedPrice: number
  /** `InsuranceItemCategory` (§4) as it was then. An item that has since lost it
   *  is a refusal the agent has to see. */
  deductibleGroupName: string
  /** The agent's overrides — `updateLineInsurance` and `updateLineMeta`. */
  maxCoverage: number
  daysSupply: number
  selectionReason: string
}

/** Something the journal held that the replay cannot carry across, known *before*
 *  a single verb is sent. Named rather than dropped — §3.9's whole rule. */
export type ReplayGap =
  /** 🚩 §3.5's attachments ride inside the journal row, and they are **not**
   *  replayed: the row records `image` | `pdf` and not a MIME type, so the browser
   *  cannot rebuild the `contentType` the submit body takes without inventing one.
   *  At least one attachment is mandatory, so this is stated rather than met as a
   *  submit blocker with no explanation. Logged in `.afk/HITL-221.md`. */
  | 'attachmentsNotReplayed'
  /** The request failed before its lines were built (§3.9). The header, the
   *  policy and the deductible terms still come across — which is the whole point
   *  of prefilling from the journal rather than from the response. */
  | 'noLinesRecorded'
  /** A `Diagnosis` row that was not a `type|code` pair. */
  | 'diagnosisUnreadable'
  /** 🚩 §3.4's known gap, and it is only reachable on the **fallback** source:
   *  `MaxCoverage` is on `NAuthLine` and **absent from `AuthLineDto`**, so a
   *  prefill sourced from the response-by-id loses that one override. The ticket's
   *  instruction is exactly this — *report it if it happens; do not work around
   *  it*. It cannot occur on the journal path, which carries the field. */
  | 'capNotRecorded'
  /** The reason for visit was on the submitted request and is not replayed: §1.2
   *  carries it on `setHeader` and no screen in this wave edits one, so the form
   *  has no control that could show it back. Named rather than dropped. */
  | 'reasonForVisitNotReplayed'

/**
 * What a reopen replays, derived from the journal row and nothing else.
 *
 * 🚩 **Nothing in here identifies the terminal transaction.** `sourceAuthId` is
 * provenance — what the screen names so the agent knows which refusal they are
 * replaying — and there is no transaction id, no line id and no preauth
 * reference: a fresh `Open` is what this plan begins with, and the payer will
 * answer a different authorization.
 */
export interface ReplayPlan {
  /** Provenance only. The authorization being replayed **from**. */
  sourceAuthId: string
  /** 🚩 Which of §3.9's two sources this plan came out of. `journal` is the write-
   *  ahead row and is complete; `response` is the **free fallback** for a row the
   *  web did not raise, and is the one with the per-line cap gap. */
  source: 'journal' | 'response'
  /** §7.1's `Open` body, whole: the same eligibility and the same chosen coverage. */
  eligibilityId: string
  memberId: string
  /** §4's nine header money fields, read back into §2's three groups. */
  insurance: NphiesSessionInsurance
  diagnoses: NphiesSessionDiagnosis[]
  exceptionPrescription: boolean
  items: ReplayItem[]
  gaps: ReplayGap[]
}

/**
 * The plan, from the journalled request.
 *
 * 🚩 **A header-only refusal still yields a plan.** `items` is empty and
 * everything else — the two ids, the deductible terms, the diagnoses, the
 * exception-prescription flag — is intact, because the journal was written before
 * the payer was called and the guards that threw did so *after* it. That case is
 * the reason §3.9 names this source at all: the ordinary response-by-id has no
 * lines to prefill from, and the worst refusals would otherwise be the least
 * recoverable (story 83).
 */
export function replayPlan(sourceAuthId: string, journal: AuthRequestJournal): ReplayPlan {
  const infos = journal.supportingInfos ?? []
  const morphology =
    infos.find((info) => text(info.category).toLowerCase() === MORPHOLOGY_CATEGORY)?.code ?? ''
  const attachments = infos.filter(
    (info) => text(info.category).toLowerCase() === ATTACHMENT_CATEGORY,
  ).length
  const items = (journal.items ?? []).map(itemOf).sort((a, b) => a.sequence - b.sequence)

  const { diagnoses, unreadable } = readDiagnoses(journal.diagnosis, morphology)

  const gaps: ReplayGap[] = []
  if (items.length === 0) gaps.push('noLinesRecorded')
  if (attachments > 0) gaps.push('attachmentsNotReplayed')
  if (unreadable > 0) gaps.push('diagnosisUnreadable')
  if (text(journal.reasonForVisit) !== '') gaps.push('reasonForVisitNotReplayed')

  return {
    sourceAuthId: text(sourceAuthId),
    source: 'journal',
    eligibilityId: text(journal.eligibilityId),
    memberId: text(journal.memberId),
    insurance: {
      g1: {
        rate: number(journal.deductibleG1),
        max: number(journal.deductibleG1Max),
        paid: number(journal.deductibleG1Paid),
      },
      g2: {
        rate: number(journal.deductibleG2),
        max: number(journal.deductibleG2Max),
        paid: number(journal.deductibleG2Paid),
      },
      g3: {
        rate: number(journal.deductibleG3),
        max: number(journal.deductibleG3Max),
        paid: number(journal.deductibleG3Paid),
      },
    },
    diagnoses,
    exceptionPrescription: journal.exceptionPrescription === true,
    items,
    gaps,
  }
}

function itemOf(item: AuthJournalItem): ReplayItem {
  return {
    sequence: number(item.sequence),
    itemNumber: text(item.itemNumber),
    quantity: number(item.quantity),
    unitPrice: number(item.unitPrice),
    extendedPrice: number(item.extendedPrice),
    deductibleGroupName: text(item.deductibleGroupName),
    maxCoverage: number(item.maxCoverage),
    daysSupply: number(item.daysSupply),
    selectionReason: text(item.selectionReason),
  }
}

/**
 * **The free fallback** (§3.9: "The response-by-id remains the free fallback for
 * rows the web did not raise").
 *
 * An authorization raised at a till has no write-ahead journal row — the journal
 * is written by the orchestration the *web* submits through — so the journal read
 * answers `AUTH_NOT_FOUND` and this is what prefills instead. It costs nothing:
 * `GET Nphies/AuthResponse/{id}` is the read 216 already makes, and
 * `AuthHeaderDto` eagerly fetches its lines.
 *
 * 🚩 **It has one known gap and the plan CARRIES it rather than papering over
 * it**: `MaxCoverage` is on `NAuthLine` and **absent from `AuthLineDto`** (§3.4),
 * so a per-line cap the agent set at the till is not in this response and cannot
 * be replayed. The ticket's instruction is exact — *report it if it happens; do
 * not work around it* — so `capNotRecorded` is a gap on every plan built here,
 * and no cap is invented for any line.
 */
export function replayPlanFromDetail(sourceAuthId: string, detail: AuthDetail): ReplayPlan {
  const infos = detail.authSupportingInfos ?? []
  const morphology =
    infos.find((info) => text(info.category).toLowerCase() === MORPHOLOGY_CATEGORY)?.code ?? ''
  const attachments = infos.filter(
    (info) => text(info.category).toLowerCase() === ATTACHMENT_CATEGORY,
  ).length
  const items = (detail.authLines ?? [])
    .map(itemFromDetailLine)
    .sort((a, b) => a.sequence - b.sequence)

  const { diagnoses, unreadable } = readDiagnoses(detail.diagnosis, morphology)

  const gaps: ReplayGap[] = ['capNotRecorded']
  if (items.length === 0) gaps.push('noLinesRecorded')
  if (attachments > 0) gaps.push('attachmentsNotReplayed')
  if (unreadable > 0) gaps.push('diagnosisUnreadable')

  return {
    sourceAuthId: text(sourceAuthId),
    source: 'response',
    eligibilityId: text(detail.eligibilityId),
    memberId: text(detail.memberId),
    insurance: {
      g1: {
        rate: number(detail.deductibleG1),
        max: number(detail.deductibleG1Max),
        paid: number(detail.deductibleG1Paid),
      },
      g2: {
        rate: number(detail.deductibleG2),
        max: number(detail.deductibleG2Max),
        paid: number(detail.deductibleG2Paid),
      },
      g3: {
        rate: number(detail.deductibleG3),
        max: number(detail.deductibleG3Max),
        paid: number(detail.deductibleG3Paid),
      },
    },
    diagnoses,
    exceptionPrescription: detail.exceptionPrescription === true,
    items,
    gaps,
  }
}

function itemFromDetailLine(line: AuthDetailLine): ReplayItem {
  return {
    sequence: number(line.sequence),
    itemNumber: text(line.itemNumber),
    quantity: number(line.quantity),
    unitPrice: number(line.unitPrice),
    extendedPrice: number(line.extendedPrice),
    deductibleGroupName: text(line.deductibleGroupName),
    // 🚩 Zero, and it is NOT "no cap was set" — it is "this response cannot say".
    // `capNotRecorded` is what says so; a plan that guessed a number here would be
    // the client asserting an override the agent never made.
    maxCoverage: 0,
    daysSupply: number(line.daysSupply),
    selectionReason: text(line.selectionReason),
  }
}

// ---------------------------------------------------------------------------
// 2 · The verbs a replay uses — all of them ones that already exist
// ---------------------------------------------------------------------------

/**
 * §1.2's eleven, spelled out so the assertion below is against the contract's own
 * table rather than against this module's opinion of it.
 */
export const SESSION_VERBS: readonly string[] = [
  'open',
  'state',
  'addItem',
  'changeQty',
  'voidLine',
  'setHeader',
  'setInsurance',
  'updateLineInsurance',
  'updateLineMeta',
  'submit',
  'abandon',
]

/**
 * The verbs this plan will send, in order.
 *
 * 🚩 **It is a subset of §1.2's table and it always begins with `open`.** That is
 * the ticket's structural rule stated as data: a reopen opens a *fresh* session
 * and replays through verbs that already exist, so there is **no new session
 * verb** and nothing resumes the terminal transaction. A future edit that reached
 * for one would have to add it here first, and the test would fail.
 */
export function replayVerbs(plan: ReplayPlan): string[] {
  const verbs = ['open', 'setInsurance']
  if (replaysHeader(plan)) verbs.push('setHeader')
  for (const item of plan.items) {
    verbs.push('addItem')
    if (replaysCap(item)) verbs.push('updateLineInsurance')
    if (replaysMeta(item)) verbs.push('updateLineMeta')
  }
  // 🚩 The settling read. Lines land **pending** and the engine prices them after
  // (spec story 27), so the report is taken from a state that has finished — a
  // comparison made before it could say nothing about the money, which is the one
  // thing a reopen most has to be able to say.
  verbs.push('state')
  return verbs
}

/** Whether the plan has any header material to send. 🚩 Read by BOTH
 *  `replayVerbs` and the page that sends the verbs, so the test asserts the
 *  decision the form actually makes rather than a second model of it. */
export const replaysHeader = (plan: ReplayPlan) =>
  plan.diagnoses.length > 0 || plan.exceptionPrescription

/** ⚠️ A cap of 0 is never re-sent: the engine ignores `<= 0` (§4), so asking for
 *  one would be asking for something that cannot take effect — and on the
 *  fallback source a 0 means *the response could not say*, not *no cap*. */
export const replaysCap = (item: ReplayItem) => item.maxCoverage > 0

/** The two non-money agent fields of `updateLineMeta`. */
export const replaysMeta = (item: ReplayItem) =>
  item.daysSupply > 0 || item.selectionReason !== ''

// ---------------------------------------------------------------------------
// 3 · The report — what did not come back
// ---------------------------------------------------------------------------

/** What actually happened to one planned item, recorded as the replay ran. The
 *  messages are the **server's own** (§6 kind 2), passed through as data. */
export interface ReplayOutcome {
  /** 🚩 **The journalled line's own sequence, and what the report matches on** —
   *  not the item number. A *refused* request can legitimately hold the same item
   *  twice: WPF refused duplicates at submit, so a request that never got that far
   *  can carry two of them, and this contract moves the refusal forward to the
   *  scan (§2.3). Matching by item number would attribute the second line's
   *  duplicate refusal to the first line and report the second as a quantity that
   *  changed. */
  sequence: number
  itemNumber: string
  /** The door's sentence when the add was refused — an item since blocked, one
   *  with no Nphies category, one that no longer prices at the plant. `null` when
   *  the add landed. */
  addRefusal: string | null
  /** The door's sentence when the cap could not be re-applied. */
  capRefusal: string | null
  /** The door's sentence when days supply or the selection reason could not be
   *  re-applied. */
  metaRefusal: string | null
}

/**
 * One thing about the replayed request that differs from the one being replayed.
 *
 * 🚩 Returned as **data with a kind**, never as a sentence: the words are the
 * screen's `t()` call (`.claude/rules/i18n-zero-literal.md`), except `message`,
 * which is the server's own and is passed through.
 */
export type ReplayFindingKind =
  /** 🚩 Every `ReplayGap` is a finding kind too, by construction rather than by a
   *  second list — one report, and a gap added later cannot be forgotten here. */
  | ReplayGap
  /** The door refused the scan. The commonest and most important one. */
  | 'refused'
  /** The add answered and no live line for it came back — a state that disagrees
   *  with its own verb. */
  | 'missing'
  /** The engine priced it differently from what was submitted. */
  | 'repriced'
  /** Its `InsuranceItemCategory` changed, including losing it entirely. */
  | 'recategorised'
  /** It came back holding a different quantity from the one that was asked for. */
  | 'quantityDiffers'
  /** The `maxCoverage` override could not be re-applied. */
  | 'capNotApplied'
  /** Days supply or the selection reason could not be re-applied. */
  | 'metaNotApplied'
  /** 🚩 The engine had not finished pricing when the report was taken, so nothing
   *  can be said about this line's money. Said out loud rather than read as "the
   *  same", which is what a silent restore would amount to. */
  | 'notPricedYet'

export interface ReplayFinding {
  kind: ReplayFindingKind
  itemNumber: string | null
  sequence: number | null
  /** 🚩 The server's own sentence, on a refusal. `null` on everything the client
   *  derived, which carries a key instead. */
  message: string | null
  /** What was submitted, and what came back — as already-formatted values, so the
   *  screen states both rather than asking the agent to trust one. */
  was: string | null
  now: string | null
}

const finding = (
  kind: ReplayFindingKind,
  over: Partial<ReplayFinding> = {},
): ReplayFinding => ({
  kind,
  itemNumber: null,
  sequence: null,
  message: null,
  was: null,
  now: null,
  ...over,
})

/** Money as the report quotes it — `core/nphies/format`'s, the one this whole
 *  area renders amounts through. A second `toFixed` here is how two figures in
 *  one sentence come to be formatted two ways. */
const amount = formatAmount

/**
 * **Everything that did not come back the way it went out.**
 *
 * 🚩 The report is built by comparing the plan against the **engine's own state**,
 * not by trusting that the verbs succeeded. A verb that answered `200` and landed
 * a line at a new price is exactly the case a success-counting replay would call
 * clean, and it is the case that would have the agent resubmit a quietly different
 * request (story 84).
 *
 * Every planned item is accounted for, in the order it was submitted, and the
 * plan's own `gaps` are folded in at the end so there is **one** report rather
 * than two lists an agent has to read together.
 */
export function replayReport(
  plan: ReplayPlan,
  lines: NphiesAuthSessionLine[],
  outcomes: ReplayOutcome[],
): ReplayFinding[] {
  const findings: ReplayFinding[] = []
  const live = (lines ?? []).filter((line) => !line.voided)

  for (const item of plan.items) {
    const outcome = (outcomes ?? []).find((row) => row.sequence === item.sequence)
    const at = { itemNumber: item.itemNumber, sequence: item.sequence }

    if (outcome?.addRefusal) {
      findings.push(finding('refused', { ...at, message: outcome.addRefusal }))
      continue
    }

    const landed = live.find((line) => sameItem(line.itemNumber, item.itemNumber))
    if (!landed) {
      findings.push(finding('missing', at))
      continue
    }

    if (number(landed.quantity) !== item.quantity) {
      findings.push(
        finding('quantityDiffers', {
          ...at,
          was: String(item.quantity),
          now: String(number(landed.quantity)),
        }),
      )
    }

    if (landed.pricing === 'pending') {
      findings.push(finding('notPricedYet', at))
    } else if (
      // The unit price is what the plant decided; the extended price is what the
      // request will be adjudicated on. Either moving is a repricing the agent has
      // to see before they submit.
      number(landed.unitPrice) !== item.unitPrice ||
      number(landed.extendedPrice) !== item.extendedPrice
    ) {
      findings.push(
        finding('repriced', {
          ...at,
          was: amount(item.extendedPrice),
          now: amount(number(landed.extendedPrice)),
        }),
      )
    }

    if (text(landed.deductibleGroupName) !== item.deductibleGroupName) {
      findings.push(
        finding('recategorised', {
          ...at,
          was: item.deductibleGroupName,
          now: text(landed.deductibleGroupName),
        }),
      )
    }

    if (outcome?.capRefusal) {
      findings.push(
        finding('capNotApplied', {
          ...at,
          message: outcome.capRefusal,
          was: amount(item.maxCoverage),
        }),
      )
    }
    if (outcome?.metaRefusal) {
      findings.push(finding('metaNotApplied', { ...at, message: outcome.metaRefusal }))
    }
  }

  for (const gap of plan.gaps) findings.push(finding(gap))
  return findings
}
