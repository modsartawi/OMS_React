/**
 * The **contact removal** module's pure half (ticket 306, spec 301) — what a
 * removal names, and what an analyst must have typed before one can be
 * constructed at all.
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
 * 🚩 **One member today, because one command exists today.** 307's mobile
 * removal clears the number and its country code and is the ticket that widens
 * this — writing those two in now would be a promise about a command nobody can
 * run yet, and a `clears` array no code path can produce.
 */
export type RemovableContactField = 'email'

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
 * copy must not contradict: an email removal clears one field and blocks
 * nobody, and 307's mobile removal clears three and blocks the member under a
 * **system reason**. One place says which, so the dialog and the command cannot
 * disagree.
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
  /**
   * 🚩 The only state carrying a removal — **the verdict IS the request**, so a
   * call site cannot arm the confirm off one reference and send another, and
   * cannot assemble a removal by hand at all.
   */
  | { state: 'removable'; removal: ContactRemoval }

/**
 * The verdict on a typed case reference for an **email** removal.
 *
 * The trim is the rule and not a tidy-up: `'   '` is a reference an auditor
 * cannot read, so it is refused as if nothing had been typed, and the length is
 * measured on what will actually be recorded rather than on what was pasted.
 */
export function emailRemovalVerdict(caseReference: string): ContactRemovalVerdict {
  const reference = caseReference.trim()
  if (!reference) return { state: 'noReference' }
  if (reference.length > CASE_REFERENCE_MAX_LENGTH) return { state: 'referenceTooLong' }
  return {
    state: 'removable',
    // 🚩 One field, no block, and no old value. This object is the whole of what
    // an email removal is.
    removal: { clears: ['email'], blocks: false, caseReference: reference },
  }
}

/**
 * The wording a verdict earns, or null for one that needs none.
 *
 * An empty field says nothing — an analyst who has not typed a reference yet is
 * not being told off, and the disabled control plus its hint already say what is
 * missing.
 */
export function emailRemovalProblemKey(verdict: ContactRemovalVerdict): string | null {
  return verdict.state === 'referenceTooLong' ? 'profile.removeEmail.problem.tooLong' : null
}
