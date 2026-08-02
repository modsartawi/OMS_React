/**
 * **The diagnoses that justify the request** (ticket 219, spec 209 stories 42–45,
 * contract v1.0 §1.2's `setHeader` / §2's header shape).
 *
 * Pure: no React, no i18n, no network. The sub-form is a controlled shell over
 * this module, which is what lets its two load-bearing rules be tested with no
 * React Testing Library in the repo (spec 209's tier-1 ruling).
 *
 * Both rules **replace a validation with a control**, which is the whole reason
 * this slice is not a port:
 *
 * 1. 🚩 **Principal is a radio, so uniqueness is structural.** Choosing one
 *    deselects the other. WPF let the agent set the type on every row and then
 *    refused at submit — `ClinicalEditValidator.cs:58` still carries that refusal,
 *    "At least one diagnosis has to be principal!", as a *fatal* finding. The rule
 *    is not deleted, it is moved into the shape of the control, and the door's
 *    finding becomes a backstop nothing ever asks.
 * 2. 🚩 **Morphology exists only while the principal needs one.** It appears and
 *    disappears with the radio, carrying its own "required because…" heading —
 *    the same rule stated forward instead of as a message box after submit.
 *
 * 🚩 **What "a neoplasm" means is the service's, not this file's.** The authority
 * is `isNeedMorph` on the diagnosis lookup row (`NDiagnosis.IsNeedMorph`, read
 * 2026-08-02), fetched per code. An ICD range spelled into the browser would be a
 * guessed shape that disagrees with the table the exchange is validated against —
 * exactly the failure this wave's brief forbids.
 */

import type { NphiesDiagnosisLookup, NphiesSessionDiagnosis } from '@/core/models/nphies'

/**
 * The three diagnosis types, from the service's own `DiagnosisTypes.cs` (read
 * 2026-08-02) and matching §2's `"type": "principal"`. Machine codes that reach
 * NPHIES verbatim — not user-visible text, and never localized.
 */
export const DIAGNOSIS_PRINCIPAL = 'principal'
export const DIAGNOSIS_SECONDARY = 'secondary'
export const DIAGNOSIS_DIFFERENTIAL = 'differential'

/**
 * 🚩 **What the type dropdown offers — and principal is NOT in it.** Principal is
 * the row's radio, so it cannot also be a value of the same control: two ways to
 * say the same thing is how a request ends up with two principals, or none.
 */
export const DIAGNOSIS_TYPES_OFFERED = [DIAGNOSIS_SECONDARY, DIAGNOSIS_DIFFERENTIAL] as const

export type OfferedDiagnosisType = (typeof DIAGNOSIS_TYPES_OFFERED)[number]

const code = (raw: string | null | undefined) => (raw ?? '').trim()

/** Two diagnosis codes are the same code. Case-folded: a diagnosis code is a
 *  machine code and `c50.9` is not a second disease. */
const sameCode = (a: string, b: string) => code(a).toUpperCase() === code(b).toUpperCase()

export function isPrincipal(diagnosis: NphiesSessionDiagnosis): boolean {
  return diagnosis.type === DIAGNOSIS_PRINCIPAL
}

/** The principal diagnosis, or `null` while none has been chosen. */
export function principalDiagnosis(
  diagnoses: NphiesSessionDiagnosis[],
): NphiesSessionDiagnosis | null {
  return diagnoses.find(isPrincipal) ?? null
}

/**
 * Make one row principal — **and the others not**.
 *
 * 🚩 This is the radio, expressed as data. Nothing asserts "exactly one
 * principal" anywhere in this repo, because after this function there cannot be
 * two: the row that gains it is the only one that keeps it, and every row that
 * loses it also loses its morphology, which was only ever there because *it* was
 * the principal.
 *
 * The row that stops being principal falls back to `secondary` rather than
 * disappearing — the agent recorded that diagnosis and moving the radio is not a
 * statement that it is no longer present.
 */
export function choosePrincipal(
  diagnoses: NphiesSessionDiagnosis[],
  diagnosisCode: string,
): NphiesSessionDiagnosis[] {
  return diagnoses.map((diagnosis) => {
    if (sameCode(diagnosis.code, diagnosisCode)) {
      return { ...diagnosis, type: DIAGNOSIS_PRINCIPAL }
    }
    if (!isPrincipal(diagnosis)) return diagnosis
    return { ...diagnosis, type: DIAGNOSIS_SECONDARY, morphology: '' }
  })
}

/** Why a diagnosis could not be added. */
export type DiagnosisRefusal = 'blank' | 'duplicate'

/**
 * Add a diagnosis to the list.
 *
 * The **first** one added is principal by construction: a request needs exactly
 * one and the agent adding a diagnosis to an empty list plainly means that one.
 * After that the row takes the type the picker offered, and the radio is how the
 * principal moves.
 *
 * ⚠️ **A duplicate code is refused**, unlike a duplicate attachment title. The
 * two are not analogous: a second `Prescription` is a second document and
 * `sequence` distinguishes them, whereas the same diagnosis code twice is the
 * same fact recorded twice with nothing to tell the rows apart.
 */
export function addDiagnosis(
  diagnoses: NphiesSessionDiagnosis[],
  row: { code: string; description: string; type?: string },
): { ok: true; diagnoses: NphiesSessionDiagnosis[] } | { ok: false; reason: DiagnosisRefusal } {
  const diagnosisCode = code(row.code)
  if (diagnosisCode === '') return { ok: false, reason: 'blank' }
  if (diagnoses.some((held) => sameCode(held.code, diagnosisCode))) {
    return { ok: false, reason: 'duplicate' }
  }
  const first = diagnoses.length === 0
  return {
    ok: true,
    diagnoses: [
      ...diagnoses,
      {
        code: diagnosisCode,
        type: first ? DIAGNOSIS_PRINCIPAL : (row.type ?? DIAGNOSIS_SECONDARY),
        description: (row.description ?? '').trim(),
        morphology: '',
      },
    ],
  }
}

/** Take a diagnosis off the request. Removing the principal leaves the request
 *  with none — which is a **blocker the form states**, not something silently
 *  patched by promoting whichever row happens to be first. */
export function removeDiagnosis(
  diagnoses: NphiesSessionDiagnosis[],
  diagnosisCode: string,
): NphiesSessionDiagnosis[] {
  return diagnoses.filter((diagnosis) => !sameCode(diagnosis.code, diagnosisCode))
}

/** Record the morphology on the principal row — the only row that may carry one. */
export function setMorphology(
  diagnoses: NphiesSessionDiagnosis[],
  morphology: string,
): NphiesSessionDiagnosis[] {
  return diagnoses.map((diagnosis) =>
    isPrincipal(diagnosis) ? { ...diagnosis, morphology: code(morphology) } : diagnosis,
  )
}

/**
 * Whether the morphology field exists at all, and whether it has been answered.
 *
 * 🚩 `visible: false` means **the field does not exist**, not that it is disabled
 * or empty. That is the ticket's whole point: the requirement arrives with its
 * cause and leaves with it.
 */
export interface MorphologyField {
  visible: boolean
  /** The principal's code and description — the *cause*, which the heading says
   *  out loud so the agent reads why the field turned up. */
  becauseCode: string
  becauseDescription: string
  /** What the principal currently carries. Empty while unanswered. */
  morphology: string
  /** Visible and answered. `true` when it is not visible at all: a field that
   *  does not exist cannot be outstanding. */
  satisfied: boolean
}

/**
 * The morphology field, derived from the principal and the service's own flag.
 *
 * `needsMorph` is `isNeedMorph` off the diagnosis lookup row for the principal's
 * code — `undefined` while that lookup has not answered yet, which is treated as
 * **not required**: turning a field on because a search is in flight would make it
 * flicker into existence and out again on every re-render.
 */
export function morphologyField(
  diagnoses: NphiesSessionDiagnosis[],
  needsMorph: boolean | undefined,
): MorphologyField {
  const principal = principalDiagnosis(diagnoses)
  const visible = principal !== null && needsMorph === true
  const morphology = visible ? code(principal?.morphology) : ''
  return {
    visible,
    becauseCode: principal ? principal.code : '',
    becauseDescription: principal ? principal.description : '',
    morphology,
    satisfied: !visible || morphology !== '',
  }
}

/**
 * What this sub-form contributes to Submit being unavailable.
 *
 * Two of the blockers spec 209 §"submit blockers" names are this slice's — the
 * other four are 220's, and this function deliberately does not know about them.
 */
export type DiagnosisBlocker = 'noPrincipal' | 'morphologyMissing'

export function diagnosisBlockers(
  diagnoses: NphiesSessionDiagnosis[],
  needsMorph: boolean | undefined,
): DiagnosisBlocker[] {
  const blockers: DiagnosisBlocker[] = []
  if (principalDiagnosis(diagnoses) === null) blockers.push('noPrincipal')
  if (!morphologyField(diagnoses, needsMorph).satisfied) blockers.push('morphologyMissing')
  return blockers
}

/**
 * The lookup row for one code, out of whatever the search answered.
 *
 * The door searches `code StartsWith(query) || description Contains(query)`, so
 * asking it for a code returns that code **and its children** — `C50` brings back
 * `C50.9`. Only the exact match may answer "does this diagnosis need a
 * morphology", because a sibling's flag is not this diagnosis's flag.
 */
export function lookupRowFor(
  rows: NphiesDiagnosisLookup[] | undefined,
  diagnosisCode: string,
): NphiesDiagnosisLookup | null {
  if (code(diagnosisCode) === '') return null
  return (rows ?? []).find((row) => sameCode(row.diagnosisCode, diagnosisCode)) ?? null
}

/** Whether two diagnosis lists say the same thing — so an edit that changed
 *  nothing sends no verb, the same rule the deductible boxes follow. */
export function diagnosesChanged(
  before: NphiesSessionDiagnosis[],
  after: NphiesSessionDiagnosis[],
): boolean {
  if (before.length !== after.length) return true
  return before.some((diagnosis, index) => {
    const next = after[index]
    return (
      diagnosis.code !== next.code ||
      diagnosis.type !== next.type ||
      diagnosis.morphology !== next.morphology ||
      diagnosis.description !== next.description
    )
  })
}
