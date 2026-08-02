/**
 * Two of ticket 219's four pure Proof bullets, at the seam that owns them:
 * `morphologyExistsOnlyWhileThePrincipalIsANeoplasm` and
 * `choosingAPrincipalDeselectsTheOther`.
 *
 * Both state an external behaviour and would survive the sub-form being rebuilt:
 * what the agent can see, and what the request carries afterwards. Neither
 * asserts which hook fired or how a component is shaped.
 */
import { describe, expect, it } from 'vitest'
import type { NphiesSessionDiagnosis } from '@/core/models/nphies'
import {
  DIAGNOSIS_DIFFERENTIAL,
  DIAGNOSIS_PRINCIPAL,
  DIAGNOSIS_SECONDARY,
  DIAGNOSIS_TYPES_OFFERED,
  addDiagnosis,
  choosePrincipal,
  diagnosisBlockers,
  diagnosesChanged,
  lookupRowFor,
  morphologyField,
  principalDiagnosis,
  removeDiagnosis,
  setMorphology,
} from './diagnosis-form'

const diagnosis = (
  code: string,
  type: string,
  morphology = '',
): NphiesSessionDiagnosis => ({ code, type, description: `${code} description`, morphology })

const NEOPLASM = 'C50.9'
const PLAIN = 'J45.9'

describe('choosingAPrincipalDeselectsTheOther', () => {
  it('leaves exactly one principal — uniqueness is structural, not asserted', () => {
    const before = [diagnosis(NEOPLASM, DIAGNOSIS_PRINCIPAL), diagnosis(PLAIN, DIAGNOSIS_SECONDARY)]

    const after = choosePrincipal(before, PLAIN)

    expect(after.filter((d) => d.type === DIAGNOSIS_PRINCIPAL).map((d) => d.code)).toEqual([PLAIN])
  })

  it('demotes the row that lost it rather than dropping the diagnosis', () => {
    const after = choosePrincipal(
      [diagnosis(NEOPLASM, DIAGNOSIS_PRINCIPAL), diagnosis(PLAIN, DIAGNOSIS_DIFFERENTIAL)],
      PLAIN,
    )

    expect(after.map((d) => [d.code, d.type])).toEqual([
      [NEOPLASM, DIAGNOSIS_SECONDARY],
      [PLAIN, DIAGNOSIS_PRINCIPAL],
    ])
  })

  it('is idempotent — re-choosing the row that already holds it changes nothing', () => {
    const held = [diagnosis(NEOPLASM, DIAGNOSIS_PRINCIPAL), diagnosis(PLAIN, DIAGNOSIS_SECONDARY)]

    expect(choosePrincipal(held, NEOPLASM)).toEqual(held)
  })

  it('never offers principal as a value of the type dropdown — it is the radio', () => {
    expect([...DIAGNOSIS_TYPES_OFFERED]).not.toContain(DIAGNOSIS_PRINCIPAL)
    expect([...DIAGNOSIS_TYPES_OFFERED]).toEqual([DIAGNOSIS_SECONDARY, DIAGNOSIS_DIFFERENTIAL])
  })

  it('makes the first diagnosis added the principal, and the next one not', () => {
    const first = addDiagnosis([], { code: NEOPLASM, description: 'Breast, unspecified' })
    expect(first.ok && first.diagnoses[0].type).toBe(DIAGNOSIS_PRINCIPAL)

    const second =
      first.ok && addDiagnosis(first.diagnoses, { code: PLAIN, description: 'Asthma' })
    expect(second && second.ok && second.diagnoses[1].type).toBe(DIAGNOSIS_SECONDARY)
  })

  it('refuses the same code twice — unlike an attachment title, it has nothing to tell the rows apart', () => {
    const held = [diagnosis(NEOPLASM, DIAGNOSIS_PRINCIPAL)]

    expect(addDiagnosis(held, { code: 'c50.9', description: 'again' })).toEqual({
      ok: false,
      reason: 'duplicate',
    })
  })

  it('removing the principal leaves the request with none, rather than silently promoting a row', () => {
    const left = removeDiagnosis(
      [diagnosis(NEOPLASM, DIAGNOSIS_PRINCIPAL), diagnosis(PLAIN, DIAGNOSIS_SECONDARY)],
      NEOPLASM,
    )

    expect(principalDiagnosis(left)).toBeNull()
    expect(diagnosisBlockers(left, false)).toContain('noPrincipal')
  })
})

describe('morphologyExistsOnlyWhileThePrincipalIsANeoplasm', () => {
  it('appears with the radio when the service says the principal needs one', () => {
    const held = [diagnosis(NEOPLASM, DIAGNOSIS_PRINCIPAL), diagnosis(PLAIN, DIAGNOSIS_SECONDARY)]

    const field = morphologyField(held, true)

    expect(field.visible).toBe(true)
    // 🚩 The field arrives WITH ITS CAUSE — the heading names the diagnosis that
    // required it, which is the whole difference from a refusal after submit.
    expect(field.becauseCode).toBe(NEOPLASM)
    expect(field.satisfied).toBe(false)
  })

  it('disappears with the radio — moving the principal to a plain diagnosis removes the field', () => {
    const held = setMorphology(
      [diagnosis(NEOPLASM, DIAGNOSIS_PRINCIPAL), diagnosis(PLAIN, DIAGNOSIS_SECONDARY)],
      'M8140/3',
    )
    expect(morphologyField(held, true).visible).toBe(true)

    const moved = choosePrincipal(held, PLAIN)

    // The plain diagnosis does not need one, so the field does not exist…
    expect(morphologyField(moved, false).visible).toBe(false)
    // …and the morphology went with it, rather than riding along on a row that no
    // longer has any reason to carry one.
    expect(moved.every((d) => d.morphology === '')).toBe(true)
  })

  it('does not exist for a request with no principal at all', () => {
    expect(morphologyField([diagnosis(PLAIN, DIAGNOSIS_SECONDARY)], true).visible).toBe(false)
  })

  it('is not a validation at submit — an unanswered one is a named blocker while it is on screen', () => {
    const held = [diagnosis(NEOPLASM, DIAGNOSIS_PRINCIPAL)]

    expect(diagnosisBlockers(held, true)).toEqual(['morphologyMissing'])
    expect(diagnosisBlockers(setMorphology(held, 'M8140/3'), true)).toEqual([])
  })

  it('stays hidden while the lookup has not answered — a field does not flicker into existence', () => {
    expect(morphologyField([diagnosis(NEOPLASM, DIAGNOSIS_PRINCIPAL)], undefined).visible).toBe(
      false,
    )
  })

  it('reads the flag off the EXACT code, never off a sibling the search brought back', () => {
    const rows = [
      { ...row('C50', false) },
      { ...row(NEOPLASM, true) },
    ]

    expect(lookupRowFor(rows, NEOPLASM)?.isNeedMorph).toBe(true)
    expect(lookupRowFor(rows, 'C50')?.isNeedMorph).toBe(false)
    expect(lookupRowFor(rows, 'C51')).toBeNull()
  })
})

describe('diagnosesChanged', () => {
  it('says nothing changed when nothing did, so an idle edit sends no verb', () => {
    const held = [diagnosis(NEOPLASM, DIAGNOSIS_PRINCIPAL)]

    expect(diagnosesChanged(held, [diagnosis(NEOPLASM, DIAGNOSIS_PRINCIPAL)])).toBe(false)
    expect(diagnosesChanged(held, setMorphology(held, 'M8140/3'))).toBe(true)
  })
})

/** A diagnosis lookup row, as `GET Nphies/Diagnoses?query=` answers it. */
function row(diagnosisCode: string, isNeedMorph: boolean) {
  return {
    diagnosisCode,
    diagnosisDescription: `${diagnosisCode} description`,
    genderRestriction: '',
    genderRestrictionType: '',
    ageLow: '',
    ageHigh: '',
    ageRestrictionType: '',
    rareRestrictionType: '',
    isNeedMorph,
    isUnacceptedAsPrincipal: false,
  }
}
