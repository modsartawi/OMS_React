/**
 * The **contact removal** module's pure half (ticket 306, spec 301) — what a
 * removal names, and what an analyst must have typed before one can be
 * constructed at all.
 *
 * Both removals live here — the email one (ticket 306) and the mobile one
 * (ticket 307). One module, two paths, so *what a removal names* and *what makes
 * one confirmable* are asked and answered in the same place rather than drifting
 * between two components.
 *
 * 🚩 **The precondition is the point of the file.** ADR 0002 rules that a
 * removal records the loyalty id, the acting user, the time and the customer's
 * **case reference** — and records the removed value nowhere. The reference is
 * therefore the *whole* of the "why": without it the trail says a contact detail
 * vanished and nothing at all about who asked. Spec 301 #39 wants an
 * unaccountable removal to be **impossible** rather than discouraged, so the
 * verdict below is the only way to obtain a `ContactRemoval`, and the screen
 * cannot arm its Remove control off anything else.
 *
 * Prior art is `actions-request.ts`: a pure guard placed so the dangerous call
 * cannot be constructed, rather than a screen that remembers not to make it.
 *
 * Pure by construction: no React, no `t`, no network. It returns **keys**, never
 * sentences ([i18n-zero-literal](../../../../.claude/rules/i18n-zero-literal.md)).
 */

/**
 * The member fields a **contact removal** may clear. Deliberately a closed union
 * of *contact* fields: a removal is per-field (spec 301), and the name, the
 * national id, the points and the purchase history are not removable by any
 * command on this screen — which is exactly what makes this not the thing
 * `CONTEXT.md` warns the copy against implying.
 *
 * 🚩 **Widened by 307**, which is the ticket that gave the last two a code path:
 * a mobile removal clears the number **and its country code**, so that no field
 * is left asserting something about a value that is gone.
 */
export type RemovableContactField = 'email' | 'mobile' | 'mobileCountry'

/**
 * One removal, as the screen holds it between the confirmation and the wire.
 *
 * 🚩 **It carries no removed value.** There is no `oldEmail` here and there
 * never will be: the Actions tab renders free-form command data verbatim to
 * anyone holding the read grant, so recording the old address would republish
 * the very thing the customer asked to have taken away (ADR 0002). The removed
 * value survives only in the *preceding* **member update snapshot**, which no
 * portal read exposes.
 *
 * `clears` and `blocks` state the command's **consequence** rather than its
 * wire shape — the route in the path is what tells the door which removal this
 * is (`api.ts`). They are here because they are the two facts the confirmation
 * copy must not contradict: an email removal clears one field and blocks nobody,
 * a mobile removal clears the number with its country code and **blocks the
 * member under a system reason**. One place says which, so the dialog and the
 * command cannot disagree — and the difference between the two removals is a
 * thing a test can read rather than a thing two components happen to do.
 */
export interface ContactRemoval {
  readonly clears: readonly RemovableContactField[]
  /** Whether the member is blocked as part of the removal. 🚩 An email removal
   *  never blocks: the customer keeps their login, their points and their
   *  history, and the confirmation must not imply otherwise. */
  readonly blocks: boolean
  /** The customer's request, trimmed — the ONE thing a removal records. */
  readonly caseReference: string
}

/**
 * How long a **case reference** may be.
 *
 * 🚩 **A cap, not a format.** Spec 301 gives the reference no pattern on
 * purpose: a rule that is wrong for a phone call with no ticket buys nothing
 * except analysts typing a hyphen to get past it. What a cap does buy is that
 * the free-form trail slot cannot be used as a notes field — a paragraph in the
 * one column an auditor reads is how PII arrives on the Actions tab by consent
 * rather than by accident.
 *
 * The number is the screen's own. No column width for the trail's free-form slot
 * is known in this repo, and the door that would state one is unwritten (the
 * backend half of 301). It is generous enough for any ticket id or a sentence
 * naming a call, and short enough not to be prose. 🚩 If the BackOffice spec
 * eventually names a narrower column, **that** is the authority and this is the
 * line to reconcile.
 */
export const CASE_REFERENCE_MAX_LENGTH = 120

/** What the confirmation makes of the case reference an analyst has typed. */
export type ContactRemovalVerdict =
  /** Nothing accountable typed yet. Not a complaint — the Remove control is
   *  simply unarmed, exactly as the mobile command's empty field is. */
  | { state: 'noReference' }
  /** Longer than the cap. Said out loud, because unlike an empty field this is
   *  something the analyst did and can shorten. */
  | { state: 'referenceTooLong' }
  /** Nothing retyped yet — the **mobile** path only. Silent, exactly as an empty
   *  case reference is: an analyst mid-keystroke is not being told off. */
  | { state: 'noTypedId' }
  /** 🚩 The retyped loyalty id is not this member's — the **mobile** path only,
   *  and the one arm that exists to catch the *wrong member* rather than a
   *  mistyped field (ticket 307). An empty id lands here too, and says nothing:
   *  see `mobileRemovalProblemKey`. */
  | { state: 'idMismatch' }
  /**
   * 🚩 The only state carrying a removal — **the verdict IS the request**, so a
   * call site cannot arm the confirm off one reference and send another, and
   * cannot assemble a removal by hand at all.
   */
  | { state: 'removable'; removal: ContactRemoval }

/**
 * The half of the ceremony **both** removals share: a reference that is missing
 * after trimming, or longer than the cap. Returns the refusal, or null when the
 * reference is one a removal may be built on.
 *
 * Module-private, because it is not a verdict — it cannot produce a removal, and
 * a caller that could reach it might mistake "the reference is fine" for "the
 * command may be sent".
 */
function refuseTheReference(caseReference: string): ContactRemovalVerdict | null {
  const reference = caseReference.trim()
  if (!reference) return { state: 'noReference' }
  return reference.length > CASE_REFERENCE_MAX_LENGTH ? { state: 'referenceTooLong' } : null
}

/**
 * The verdict on a typed case reference for an **email** removal.
 *
 * The trim is the rule and not a tidy-up: `'   '` is a reference an auditor
 * cannot read, so it is refused as if nothing had been typed, and the length is
 * measured on what will actually be recorded rather than on what was pasted.
 */
export function emailRemovalVerdict(caseReference: string): ContactRemovalVerdict {
  const refused = refuseTheReference(caseReference)
  if (refused) return refused
  const reference = caseReference.trim()
  return {
    state: 'removable',
    // 🚩 One field, no block, and no old value. This object is the whole of what
    // an email removal is.
    removal: { clears: ['email'], blocks: false, caseReference: reference },
  }
}

/**
 * One problem, said **against the field that caused it**.
 *
 * 🚩 The field is half the answer and not decoration: the mobile removal asks
 * for two things, and an over-long case reference reported under the retyped
 * loyalty id is an analyst hunting the wrong input. Returning the placement as
 * data keeps that decision in the module the tests can reach, rather than in a
 * JSX branch neither vitest nor the type system can see.
 *
 * Null is the common answer, and it is not a gap: an empty reference and an
 * un-typed id both say **nothing at all**. An analyst who has not typed yet is
 * not being told off, and a guard that nags mid-keystroke is a guard people
 * learn to click past — which is the one thing this ceremony cannot afford. The
 * disabled control and its own hint already say what is still missing.
 *
 * ONE reader for both removals: the mobile path's problems are a strict superset
 * of the email path's, and `idMismatch` is simply unreachable from a verdict the
 * email path produced.
 */
export interface RemovalProblem {
  /** Which input the sentence belongs under. */
  field: 'caseReference' | 'loyId'
  key: string
}

export function removalProblem(verdict: ContactRemovalVerdict): RemovalProblem | null {
  if (verdict.state === 'referenceTooLong')
    return { field: 'caseReference', key: REFERENCE_TOO_LONG_KEY }
  if (verdict.state === 'idMismatch')
    return { field: 'loyId', key: 'profile.removeMobile.problem.idMismatch' }
  return null
}

/**
 * The over-long reference reads the same on both removals, so it is one key.
 *
 * It lives under `profile.caseReference` with the rest of the shared ceremony —
 * the label, the placeholder, the hint and the disabled reason — because both
 * removals ask for the same thing in the same words. A second identical sentence
 * under each command would be a locale's chance to make one command's cap sound
 * different from the other's, when it is the same cap.
 */
const REFERENCE_TOO_LONG_KEY = 'profile.caseReference.problem.tooLong'

/**
 * What the **mobile** removal's confirmation makes of what the analyst has typed
 * — the reference, plus the loyalty id retyped.
 *
 * 🚩 **The retyped id is the guard, and the dialog is not.** The failure being
 * designed against is not a mis-click but the **wrong member** — two members open
 * in two tabs — and people click through confirmations. A retyped id stops it,
 * because the wrong id is on screen and will not match (spec 301, "Confirmation";
 * ticket 307).
 *
 * 🚩 **Exact: not trimmed, not case-folded.** Every looser rule has to answer
 * *how unlike the id on screen may this be*, and for the one command that
 * destroys a login — after which the loyalty id is the only handle left, because
 * the portal's own search will no longer find them — the honest answer is *not at
 * all*. The id being retyped is on screen a few centimetres away; the cost of
 * exactness is a keystroke, and the cost of looseness is the wrong customer.
 *
 * The reference is asked for **first**: an analyst who has not named the request
 * yet is not told that an id they have not reached is wrong.
 */
export function mobileRemovalVerdict(
  caseReference: string,
  typedLoyId: string,
  loyId: string,
): ContactRemovalVerdict {
  // 🚩 The reference is judged FIRST and by the SAME rule as the email path's —
  // one function, so the two removals cannot start disagreeing about what an
  // accountable reference is. It also means an analyst who has not named the
  // request yet is not told that an id they have not reached is wrong.
  const refused = refuseTheReference(caseReference)
  if (refused) return refused
  const reference = caseReference.trim()
  // Nothing typed is not a mismatch: the two are told apart here so that the
  // wording can stay silent until the analyst has actually claimed an id.
  if (!typedLoyId) return { state: 'noTypedId' }
  if (typedLoyId !== loyId) return { state: 'idMismatch' }
  return {
    state: 'removable',
    // 🚩 The number AND its country code, because a country code left behind
    // asserts something about a number that is gone (spec 301). And `blocks`,
    // which is the whole difference from the email removal: *this person asked to
    // be removed* is a recorded state under a **system reason**, not an emergent
    // side effect of an empty column.
    removal: { clears: ['mobile', 'mobileCountry'], blocks: true, caseReference: reference },
  }
}
