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

import type {
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
 *  matched it more loosely would report a line as missing that is on the request. */
const sameItem = (a: string, b: string) => text(a).toUpperCase() === text(b).toUpperCase()

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
  const rows = text(raw)
    .split(',')
    .map((row) => row.trim())
    .filter((row) => row !== '')
  const seen = new Set<string>()
  const decoded: NphiesSessionDiagnosis[] = []
  for (const row of rows) {
    const columns = row
      .split('|')
      .map((column) => column.trim())
      .filter((column) => column !== '')
    // A row that is not a `type|code` pair is not a diagnosis this client can
    // name. Dropping it silently would be the exact defect this module exists to
    // prevent, so it is left out of the plan and `planGaps` reports it.
    if (columns.length < 2) continue
    const [type, code] = columns
    if (seen.has(code.toUpperCase())) continue
    seen.add(code.toUpperCase())
    decoded.push({ code, type, description: '', morphology: '' })
  }
  const morph = text(morphology)
  if (morph !== '') {
    const principal = decoded.find((diagnosis) => text(diagnosis.type).toLowerCase() === PRINCIPAL)
    if (principal) principal.morphology = morph
  }
  return decoded
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

  const diagnoses = decodeDiagnoses(journal.diagnosis, morphology)
  const readableRows = text(journal.diagnosis)
    .split(',')
    .map((row) => row.trim())
    .filter((row) => row !== '').length

  const gaps: ReplayGap[] = []
  if (items.length === 0) gaps.push('noLinesRecorded')
  if (attachments > 0) gaps.push('attachmentsNotReplayed')
  if (readableRows > diagnoses.length) gaps.push('diagnosisUnreadable')

  return {
    sourceAuthId: text(sourceAuthId),
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
  if (plan.diagnoses.length > 0 || plan.exceptionPrescription) verbs.push('setHeader')
  for (const item of plan.items) {
    verbs.push('addItem')
    // A cap of 0 is not sent at all — the engine ignores `<= 0` (§4) and the
    // client refuses to send one anywhere else either.
    if (item.maxCoverage > 0) verbs.push('updateLineInsurance')
    if (item.daysSupply > 0 || item.selectionReason !== '') verbs.push('updateLineMeta')
  }
  return verbs
}

// ---------------------------------------------------------------------------
// 3 · The report — what did not come back
// ---------------------------------------------------------------------------

/** What actually happened to one planned item, recorded as the replay ran. The
 *  messages are the **server's own** (§6 kind 2), passed through as data. */
export interface ReplayOutcome {
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
  /** A `ReplayGap`, surfaced in the same list so the agent reads one report. */
  | 'attachmentsNotReplayed'
  | 'noLinesRecorded'
  | 'diagnosisUnreadable'

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

/** Money as the report quotes it — two places, the way every amount on this
 *  screen is already rendered. */
const amount = (value: number) => value.toFixed(2)

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
    const outcome = (outcomes ?? []).find((row) => sameItem(row.itemNumber, item.itemNumber))
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

/** Whether the replay produced a request the agent can trust is the one they
 *  meant to resend. `false` is not a failure — it is the report being worth
 *  reading. */
export function replayIsClean(findings: ReplayFinding[]): boolean {
  return findings.length === 0
}
