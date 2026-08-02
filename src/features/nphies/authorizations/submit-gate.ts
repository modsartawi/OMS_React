/**
 * **Submit as a gated path, not a button** (ticket 220, spec 209 stories 57–63,
 * contract v1.0 §3.5 / §3.7 / §6 / §7.3).
 *
 * Pure: no React, no i18n, no network. Three rulings live here because all three
 * fail silently, and two of them fail at a national exchange:
 *
 * 1. 🚩 **Every reason Submit is unavailable is stated in ONE place, and each
 *    names itself.** WPF validated at submit and answered with a message box
 *    naming whichever condition it hit first; the agent fixed that one, pressed
 *    Submit and met the next. The list is the whole of what is missing.
 * 2. 🚩 **The clinical-edit gate is one surface in two shapes** — a warning may
 *    be overridden, a fatal simply has no confirm button. The *same* answer
 *    carries both, so the rule reads identically and cannot drift into two
 *    dialogs that disagree.
 * 3. 🚩 **A timeout on the submit leg is IN FLIGHT, never failed** (law 6). The
 *    only act it may offer is a status check. Raising a second authorization for
 *    a request that already reached the payer is the worst outcome this screen
 *    can produce, and this module is the whole of what prevents it — there is no
 *    `failed` landing, no `resubmit` act, and `submitIsLocked` is true forever
 *    after one.
 *
 * And the fourth thing, which is what makes a refusal fixable at all: a `Failed`
 * is a **form state**, not an error page, so each reason is placed on the row or
 * the header that caused it (§7.3, §5's correction of record).
 */

import { ApiError, apiErrorCode, apiErrorMessage } from '@/core/api'
import type {
  NphiesAuthSessionLine,
  NphiesAuthSessionState,
  NphiesClinicalEditFinding,
  NphiesClinicalEditRequest,
  NphiesSubmitRefusalReason,
  NphiesSubmitResult,
} from '@/core/models/nphies'
import { attachmentBlockers, type PreparedAttachment } from './attachment-prepare'
import { diagnosisBlockers } from './diagnosis-form'

const text = (raw: string | null | undefined) => (raw ?? '').trim()

// ---------------------------------------------------------------------------
// 1 · The submit blockers
// ---------------------------------------------------------------------------

/**
 * The client-derived reasons Submit is held, each its own name.
 *
 * Two come from 219's modules unchanged (`noPrincipal`, `morphologyMissing` from
 * the diagnosis form; `noAttachment` from the attachment picker) — this module
 * composes them rather than restating them, so there is exactly one definition of
 * each rule and one i18n key per reason.
 */
export type ClientSubmitBlockerCode =
  /** Nothing live is on the request. A basket of voided lines is an empty basket. */
  | 'noItems'
  /** §3.5's mandatory attachment, as a FORM state rather than a submit-time throw. */
  | 'noAttachment'
  /** The exchange requires exactly one principal diagnosis. */
  | 'noPrincipal'
  /** The principal diagnosis is one the service marks `isNeedMorph` and nobody
   *  chose a morphology code. */
  | 'morphologyMissing'
  /** 🚩 No coverage was picked. `memberId` **IS** the policy choice (§2), and 213
   *  forces the pick when the patient holds two or more — a request raised under
   *  no policy is one the payer cannot answer. */
  | 'noCoverage'
  /** No provider. §1.3's one operator-input field, inherited from the eligibility
   *  (story 25) — blank here means the check it came from carried none. */
  | 'noProvider'

/**
 * One reason Submit is unavailable.
 *
 * 🚩 **`source` is load-bearing, not bookkeeping.** A client blocker is a rule
 * this repo owns and renders from its own key; a server blocker is §2's
 * `submitBlockers` entry, whose `message` is server-supplied text passed through
 * as data (§6 kind 2, `.claude/rules/i18n-zero-literal.md`). Collapsing the two
 * would either invent English for a server code or leave a client rule
 * untranslatable.
 */
export interface SubmitBlocker {
  code: string
  source: 'client' | 'server'
  /** The server's own sentence. `null` on a client blocker, which has a key. */
  message: string | null
}

/**
 * What the screen renders for one blocker — a translation key, or the server's
 * own words.
 *
 * Returned as data rather than a string so this module stays free of i18n and the
 * test can assert *that every blocker is named* without a translation table.
 */
export type BlockerLabel =
  | { kind: 'key'; key: string; params?: Record<string, string> }
  | { kind: 'text'; text: string }

const BLOCKER_KEY_PREFIX = 'form.submit.blockers.'

/**
 * 🚩 **A server blocker whose code the client already states is the same fact,
 * not a second one.** The mandatory attachment is the live case: §3.5 makes it a
 * client-side form state, and a projection that also lists `NO_ATTACHMENTS`
 * (which the server cannot know either way, since attachments only exist in the
 * submit body) would otherwise show the agent the same sentence twice.
 */
const SERVER_CODE_FOR: Partial<Record<ClientSubmitBlockerCode, string>> = {
  noAttachment: 'NO_ATTACHMENTS',
}

/** What the whole gate reads. Named rather than positional: the list grows, and
 *  a fifth boolean argument is how a caller ends up passing them in the wrong
 *  order. */
export interface SubmitGateInput {
  state: NphiesAuthSessionState | null | undefined
  attachments: PreparedAttachment[]
  /** Whether the principal diagnosis is one the service marks `isNeedMorph` —
   *  the service's answer, fetched for the exact code, never derived from an ICD
   *  range in the browser. `undefined` while unknown. */
  needsMorph: boolean | undefined
}

/**
 * **Every reason Submit is unavailable, in one place.**
 *
 * Client rules first, in the order the agent meets them on the page, then
 * whatever the server says on top. An empty list is the only state in which the
 * button is offered at all.
 */
export function submitBlockers({ state, attachments, needsMorph }: SubmitGateInput): SubmitBlocker[] {
  const client: ClientSubmitBlockerCode[] = []

  // 🚩 LIVE lines only. A voided line is kept for the audit trail (law 2) and is
  // not something the payer is being asked for.
  const live = (state?.lines ?? []).filter((line) => !line.voided)
  if (live.length === 0) client.push('noItems')

  client.push(...attachmentBlockers(attachments))
  client.push(...diagnosisBlockers(state?.header.diagnoses ?? [], needsMorph))

  if (text(state?.reference.memberId) === '') client.push('noCoverage')
  if (text(state?.reference.providerCode) === '') client.push('noProvider')

  // 🚩 **Unconditionally**, not "while the client blocker holds". A code in this
  // table is one the client OWNS as a form state, and the server cannot see the
  // fact behind it: attachments exist only inside the submit body, so a
  // projection that keeps saying `NO_ATTACHMENTS` after the agent has attached a
  // prescription is the server answering a question it was never asked. Filtering
  // by the live client codes instead would leave that entry standing the moment
  // the agent fixed it — and disable Submit for the rest of the session.
  const stated = new Set(Object.values(SERVER_CODE_FOR))
  const server = (state?.submitBlockers ?? [])
    .filter((blocker) => !stated.has(text(blocker.code)))
    .map((blocker): SubmitBlocker => ({
      code: text(blocker.code),
      source: 'server',
      message: text(blocker.message) || null,
    }))

  return [
    ...client.map((code): SubmitBlocker => ({ code, source: 'client', message: null })),
    ...server,
  ]
}

/**
 * The sentence for one blocker.
 *
 * 🚩 **A blocker with no words still gets named.** A server entry that arrives
 * with an empty `message` would otherwise render its machine code as if it were
 * English; instead it reads as an unstated condition *quoting* the code, which is
 * honest about what is known and still actionable by someone who can look it up.
 */
export function blockerLabel(blocker: SubmitBlocker): BlockerLabel {
  if (blocker.source === 'client') return { kind: 'key', key: BLOCKER_KEY_PREFIX + blocker.code }
  if (blocker.message) return { kind: 'text', text: blocker.message }
  return { kind: 'key', key: BLOCKER_KEY_PREFIX + 'server', params: { code: blocker.code } }
}

// ---------------------------------------------------------------------------
// 2 · The clinical-edit gate
// ---------------------------------------------------------------------------

/** `ClinicalEditRestrictionTypeConstants` (`ClinicalEditValidator.cs:319`). */
export const CLINICAL_EDIT_FATAL = 'F'
export const CLINICAL_EDIT_WARNING = 'W'

/** `clear` is not a surface at all — it is the ordinary case and submission just
 *  proceeds. */
export type ClinicalEditShape = 'clear' | 'warning' | 'fatal'

export interface ClinicalEditGate {
  shape: ClinicalEditShape
  /** 🚩 **All of them, whatever the shape.** The agent sees everything the check
   *  found, not only the finding that stopped them. */
  findings: NphiesClinicalEditFinding[]
  /** 🚩 The one difference between the two shapes: whether the confirm button
   *  exists. Nothing else about the surface changes. */
  overridable: boolean
}

/**
 * The gate's whole decision, from the check's findings.
 *
 * 🚩 **Fatal is exactly `"F"`, because that is exactly what the service means by
 * it.** `ValidateClinicalEditForAuth` throws only on `RestrictionType == Fatal`
 * and lets every other value pass, and `RestrictionType` is filled straight from
 * the raw `RareRestrictionType` / `GenderRestrictionType` / `AgeRestrictionType`
 * columns — so an unrecognised value is a *warning* here for the same reason it
 * is one there. Reproduced rather than tightened: a web screen that refused what
 * the till allows would disagree with the till about what may be sent.
 */
export function clinicalEditGate(findings: NphiesClinicalEditFinding[]): ClinicalEditGate {
  const all = findings ?? []
  const fatal = all.some(
    (finding) => text(finding.restrictionType).toUpperCase() === CLINICAL_EDIT_FATAL,
  )
  if (all.length === 0) return { shape: 'clear', findings: [], overridable: true }
  return {
    shape: fatal ? 'fatal' : 'warning',
    findings: all,
    overridable: !fatal,
  }
}

/**
 * The clinical-edit body, built from the session state (§1.1 #10's passthrough).
 *
 * 🚩 **It carries no line, no amount and no attachment.** The check is about the
 * patient and the diagnoses — age and gender restrictions per code, and whether a
 * principal was named — so the basket is not part of it and no money leaves the
 * browser (law 1).
 */
export function clinicalEditRequestFrom(
  state: NphiesAuthSessionState,
): NphiesClinicalEditRequest {
  return {
    serviceDate: state.header.serviceDate,
    patientBirthDate: state.reference.patientBirthDate,
    patientGender: state.reference.patientGender,
    diagnoses: state.header.diagnoses.map((diagnosis) => ({
      diagnosisCode: diagnosis.code,
      diagnosisType: diagnosis.type,
    })),
  }
}

// ---------------------------------------------------------------------------
// 3 · The submission and its outcomes
// ---------------------------------------------------------------------------

/**
 * The window a submission is synchronous for (§1: "Explicit **100 s** on the
 * submit leg").
 *
 * 🚩 **It is the SERVER's timeout, stated here so the screen can say it** — the
 * browser sets none of its own. A client-side abort shorter than the server's
 * would manufacture an in-flight answer for a request SIS.Api was still about to
 * answer properly, and a longer one would buy nothing. What the number is for is
 * story 63: an agent watching a still screen for ninety seconds concludes the
 * submission has died, and the one thing they must not then do is send another.
 */
export const SUBMIT_TIMEOUT_SECONDS = 100

/** Where the agent is left, once the submission has answered — or failed to. */
export type SubmitLanding =
  /** Lodged. The authorization exists and the agent lands on its detail. */
  | { kind: 'submitted'; authId: string; preAuthRef: string }
  /** A `Failed`: refused before the payer saw it, and **fixable here**. */
  | { kind: 'refused'; authId: string | null; reasons: NphiesSubmitRefusalReason[] }
  /** 🚩 The 100 s window elapsed, or the wire broke. **Not a failure** (law 6). */
  | { kind: 'inFlight'; reason: 'server' | 'transport' }
  /** §6 kind 2 — a guardrail refusal that never left SIS.Api. The request is
   *  intact and may be corrected and sent again. */
  | { kind: 'blocked'; code: string | null; message: string | null }

/** What the screen may offer next. 🚩 There is no `submit` member and no
 *  `resubmit` member: law 6 is enforced by the type, not by remembering it. */
export type SubmitNextAct = 'statusCheck' | 'backToForm' | 'openDetail'

/** The server's own answer, read into a landing. */
export function readSubmitResult(result: NphiesSubmitResult): SubmitLanding {
  if (result.outcome === 'submitted') {
    return { kind: 'submitted', authId: result.authId, preAuthRef: result.preAuthRef }
  }
  if (result.outcome === 'refused') {
    return { kind: 'refused', authId: result.authId ?? null, reasons: result.reasons ?? [] }
  }
  return { kind: 'inFlight', reason: 'server' }
}

/**
 * A throw on the submit leg, read into a landing.
 *
 * 🚩 **The whole of law 6 is this branch.** A business refusal carried the
 * envelope, so SIS.Api answered deliberately and the request never went — the
 * agent may fix it and send again. **Anything else is in flight**: a timeout, a
 * dropped socket, an un-enveloped 5xx all leave the same question unanswered —
 * *did it reach the payer?* — and the only safe answer to that question is "check
 * before you send another one".
 *
 * 401 is not read here at all: `core/api.ts`'s `handle401` owns it entirely and
 * feature code never catches it (`.claude/rules/api-envelope.md`).
 */
export function readSubmitFailure(error: unknown): SubmitLanding {
  if (error instanceof ApiError && error.kind === 'business') {
    // The server's own sentence, read through the helper the envelope rule names.
    // An empty fallback rather than a key: this module has no i18n, and the
    // component supplies the words when the refusal carried none.
    return { kind: 'blocked', code: apiErrorCode(error), message: apiErrorMessage(error, '') || null }
  }
  return { kind: 'inFlight', reason: 'transport' }
}

/** The acts the landing permits — one each, because a landing that offered a
 *  choice would be a landing the agent has to reason about. */
export function nextActs(landing: SubmitLanding): SubmitNextAct[] {
  switch (landing.kind) {
    case 'submitted':
      return ['openDetail']
    // 🚩 The one permitted response to an in-flight submission (law 6).
    case 'inFlight':
      return ['statusCheck']
    default:
      return ['backToForm']
  }
}

/**
 * Whether Submit may still be pressed.
 *
 * 🚩 **In flight locks it forever.** The request may already be with the payer,
 * and a second one for the same basket is the outcome this whole ruling exists to
 * prevent. A submitted one locks it for the ordinary reason: the transaction is
 * closed.
 */
export function submitIsLocked(landing: SubmitLanding | null): boolean {
  return landing !== null && (landing.kind === 'inFlight' || landing.kind === 'submitted')
}

// ---------------------------------------------------------------------------
// 4 · Placing the refusal reasons
// ---------------------------------------------------------------------------

export interface PlacedRefusals {
  /** Reasons by `lineId`, in the order the server sent them. */
  byLine: Record<string, string[]>
  /** 🚩 Reasons that belong to no row — `lineId: null`, **and** any naming a line
   *  this request does not hold. */
  header: string[]
  /** How many reasons there are in total. What the banner counts, so a reason
   *  that landed on a row is still known to exist by the summary at the top. */
  total: number
}

/**
 * Put each refusal reason where the agent can act on it.
 *
 * 🚩 **Nothing is dropped.** A `lineId: null` is the header-only case §3.9
 * describes — the service's own guards throw *before the lines are built*, so
 * there is no row to attach to — and an unknown `lineId` falls back to the same
 * place rather than vanishing. A refusal nobody can see is a refusal the agent
 * cannot fix, on exactly the requests that are hardest to recover from.
 */
export function placeRefusals(
  reasons: NphiesSubmitRefusalReason[],
  lines: NphiesAuthSessionLine[],
): PlacedRefusals {
  const known = new Set(lines.map((line) => line.lineId))
  const byLine: Record<string, string[]> = {}
  const header: string[] = []
  for (const reason of reasons ?? []) {
    const lineId = text(reason.lineId)
    if (lineId !== '' && known.has(lineId)) {
      byLine[lineId] = [...(byLine[lineId] ?? []), reason.message]
    } else {
      header.push(reason.message)
    }
  }
  return { byLine, header, total: (reasons ?? []).length }
}
