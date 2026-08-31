/**
 * The profile form's three rulings (ticket 304, spec 301).
 *
 * 🚩 The first of them is the single most valuable pure test in the wave: a
 * regression to the till's **mandatory gender** rule is invisible in the type
 * system, invisible at build, and surfaces only as an analyst who cannot fix a
 * misspelt name on a member with no recorded gender.
 */
import { describe, expect, it } from 'vitest'
import { ApiError } from '@/core/api'
import type { LoyMember } from '@/core/models/loy'
import {
  MEMBER_CHANGED_CODE,
  dirtyProfileFields,
  isStaleProfileRefusal,
  PROFILE_FIELDS,
  profileDraftOf,
  profileFormIsStale,
  profileProblems,
  profileStampVerdict,
  profileRefusedField,
  profileUpdateRequest,
} from './profile-form'

/** A member as the door hands one over, built from the fields a scenario cares
 *  about — every string on `LoyMemberModel` is nullable on the way here. */
const member = (fields: Partial<LoyMember> = {}) =>
  ({
    loyId: '100001293',
    fullName: 'Nouf Al-Harbi',
    email: 'nouf.h@example.com',
    birthDate: '1990-11-08T00:00:00',
    gender: 'F',
    nationality: 'SA',
    nationalId: '1098443217',
    cityCode: 'RUH',
    preferredLanguage: 'AR',
    insuranceCompany: null,
    lastUpdate: '2026-07-31T09:12:00',
    ...fields,
  }) as unknown as LoyMember

/** A business refusal exactly as `core/api.ts` raises one from the envelope. */
const refusal = (errorCode: string) =>
  new ApiError('business', 'The member could not be updated.', 400, [
    { errorCode, errorMessage: '', internalErrorCode: '' },
  ])

// ---------------------------------------------------------------------------

describe('aBlankGenderAndLanguageSurviveASave', () => {
  const sparse = member({ gender: null, preferredLanguage: null, birthDate: '0001-01-01T00:00:00' })

  it('🚩 a member with neither recorded validates — nothing is invented', () => {
    // The whole ticket. The till's validator would refuse this member and force
    // the analyst to make a fact about the customer up.
    expect(profileProblems(profileDraftOf(sparse), PROFILE_FIELDS.map((f) => f.key))).toEqual([])
  })

  it('🚩 and produces a request body carrying NEITHER — null, never an empty string', () => {
    const body = profileUpdateRequest(profileDraftOf(sparse), sparse.lastUpdate)
    expect(body.gender).toBeNull()
    expect(body.preferredLanguage).toBeNull()
    // The sentinel birth date is an unset one, not a fact about the customer.
    expect(body.birthDate).toBeNull()
    // The explicit handling of the live empty-string question: `""` never
    // leaves the browser, on any of the nine.
    expect(Object.values(body)).not.toContain('')
  })

  it('a member with both set keeps them', () => {
    const body = profileUpdateRequest(profileDraftOf(member()), '2026-07-31T09:12:00')
    expect(body.gender).toBe('F')
    expect(body.preferredLanguage).toBe('AR')
    expect(body.birthDate).toBe('1990-11-08')
  })

  it('🚩 blanking a recorded gender is a legal edit too — the ruling runs both ways', () => {
    const draft = { ...profileDraftOf(member()), gender: '', preferredLanguage: '   ' }
    expect(profileProblems(draft, ['gender', 'preferredLanguage'])).toEqual([])
    const body = profileUpdateRequest(draft, '2026-07-31T09:12:00')
    expect(body.gender).toBeNull()
    expect(body.preferredLanguage).toBeNull()
  })

  it('sends all nine fields every time, not only the changed ones', () => {
    // A partial body would leave the server guessing whether an absent field
    // means unchanged or cleared — the ambiguity that silently blanks a record.
    const body = profileUpdateRequest(profileDraftOf(member()), '2026-07-31T09:12:00')
    expect(Object.keys(body).sort()).toEqual(
      [
        'birthDate',
        'cityCode',
        'email',
        'fullName',
        'gender',
        'insuranceCompany',
        'lastUpdate',
        'nationalId',
        'nationality',
        'preferredLanguage',
      ].sort(),
    )
  })

  it('names the field a shape check refuses, never the form', () => {
    expect(
      profileProblems({ ...profileDraftOf(member()), email: 'not-an-address' }, ['email']),
    ).toEqual([{ field: 'email', key: 'profile.invalid.email' }])
    // 🚩 A blank email is not a shape failure — blanking one through the profile
    // command is explicitly permitted; *removing* it is a different command.
    expect(profileProblems({ ...profileDraftOf(member()), email: '  ' }, ['email'])).toEqual([])
  })

  it('🚩 refuses only what the ANALYST typed — a stored value it cannot parse blocks nothing', () => {
    // The blank-tolerance ruling, reintroduced through the one field that HAS a
    // shape rule: a legacy member whose recorded email is `user@localhost` or
    // `n/a` would otherwise be unsaveable outright, and an analyst fixing a
    // misspelt name would first have to edit or BLANK a contact detail — losing
    // a way of reaching the customer to correct something else entirely.
    const legacy = profileDraftOf(member({ email: 'user@localhost' }))
    expect(profileProblems(legacy, [])).toEqual([])
    expect(profileProblems({ ...legacy, fullName: 'Nouf Al-Harbee' }, ['fullName'])).toEqual([])
    // Touch it, and it is theirs to answer for.
    expect(profileProblems({ ...legacy, email: 'still not one' }, ['email'])).toEqual([
      { field: 'email', key: 'profile.invalid.email' },
    ])
  })

  it('refuses a birth date that would not be sent as the day it was typed', () => {
    const on = (birthDate: string) =>
      profileProblems({ ...profileDraftOf(member()), birthDate }, ['birthDate'])
    // `new Date` rolls 31 February forward to March rather than refusing, so
    // parsing alone would write a different day than the analyst typed.
    expect(on('2026-02-31')).toEqual([{ field: 'birthDate', key: 'profile.invalid.birthDate' }])
    expect(on('08/11/1990')).toEqual([{ field: 'birthDate', key: 'profile.invalid.birthDate' }])
    expect(on('1990-11-08')).toEqual([])
    // 🚩 A SHAPE, never a value: "not in the future" and "not before 1900" are
    // judgements about the customer, and spec 301 puts value rules on the door
    // where a refusal can be named. A far-future day is well-formed, so it goes.
    expect(on('2999-01-01')).toEqual([])
  })
})

// ---------------------------------------------------------------------------

describe('onlyChangedFieldsCountAsDirtyAndAnUnchangedFormCannotSave', () => {
  const seed = profileDraftOf(member())

  it('an untouched form has changed nothing', () => {
    expect(dirtyProfileFields(seed, { ...seed })).toEqual([])
  })

  it('🚩 a whitespace-only edit is not a change', () => {
    // The keystroke a Save-that-records-no-change would write a member update
    // snapshot for.
    expect(dirtyProfileFields(seed, { ...seed, fullName: '  Nouf Al-Harbi ' })).toEqual([])
  })

  it('🚩 a field returned to its original value is not dirty either', () => {
    const typed = { ...seed, email: 'typo@example.com' }
    expect(dirtyProfileFields(seed, typed)).toEqual(['email'])
    expect(dirtyProfileFields(seed, { ...typed, email: 'nouf.h@example.com' })).toEqual([])
  })

  it('a blank field left blank is not a change', () => {
    const sparse = profileDraftOf(member({ gender: null, insuranceCompany: null }))
    expect(dirtyProfileFields(sparse, { ...sparse })).toEqual([])
    // …and neither is a space typed into one.
    expect(dirtyProfileFields(sparse, { ...sparse, gender: ' ' })).toEqual([])
  })

  it('names every field that really moved, in the form’s own order', () => {
    expect(
      dirtyProfileFields(seed, { ...seed, cityCode: 'JED', fullName: 'Nouf Al-Harbe' }),
    ).toEqual(['fullName', 'cityCode'])
  })

  it('🚩 clearing a recorded value IS a change — the one edit a trim must not swallow', () => {
    expect(dirtyProfileFields(seed, { ...seed, gender: '' })).toEqual(['gender'])
  })
})

// ---------------------------------------------------------------------------

describe('aStaleFormIsRefusedRatherThanClobbering', () => {
  it('the last-update echo round-trips exactly as the member carried it', () => {
    const m = member()
    expect(profileUpdateRequest(profileDraftOf(m), m.lastUpdate).lastUpdate).toBe(
      '2026-07-31T09:12:00',
    )
  })

  it('a member who has not moved is not stale', () => {
    expect(profileFormIsStale('2026-07-31T09:12:00', '2026-07-31T09:12:00')).toBe(false)
  })

  it('🚩 a member who moved underneath the form is', () => {
    expect(profileFormIsStale('2026-07-31T09:12:00', '2026-08-30T11:04:00')).toBe(true)
  })

  it('🚩 an unknown stamp is never a clash — the screen does not invent a warning', () => {
    expect(profileFormIsStale(null, '2026-08-30T11:04:00')).toBe(false)
    expect(profileFormIsStale('2026-07-31T09:12:00', '')).toBe(false)
    expect(profileFormIsStale(undefined, undefined)).toBe(false)
  })

  it('🚩 surfaces the server’s refusal as *the member changed*, not as a crash', () => {
    expect(isStaleProfileRefusal(refusal(MEMBER_CHANGED_CODE))).toBe(true)
    expect(isStaleProfileRefusal(refusal('LOY-00100'))).toBe(false)
    // Not a crash, and not a throw: anything that is not a coded refusal is
    // simply not this one.
    expect(isStaleProfileRefusal(new Error('network down'))).toBe(false)
    expect(isStaleProfileRefusal(null)).toBe(false)
  })

  it('marks a refused field against the control that caused it', () => {
    // The module's EXISTING lookup refusals — `CountryCodeNotExists` and
    // `CityCodeNotExists` — which the profile command reuses, which is why it
    // mints no code of its own for either. Guessed as `00106`/`00107`.
    expect(profileRefusedField(refusal('LOY-00003'))).toBe('nationality')
    expect(profileRefusedField(refusal('LOY-00005'))).toBe('cityCode')
    // A refusal that belongs against no single field marks none — the server's
    // own sentence still speaks for it.
    expect(profileRefusedField(refusal('LOY-00100'))).toBeNull()
    expect(profileRefusedField(refusal(MEMBER_CHANGED_CODE))).toBeNull()
  })

  it('🚩 a prototype key from the wire cannot reach through to a field', () => {
    expect(profileRefusedField(refusal('constructor'))).toBeNull()
    expect(profileRefusedField(refusal('toString'))).toBeNull()
  })
})

describe('aMemberWithNoStampIsAFormWithNoClashDetection', () => {
  it('🚩 a blank echo on either side is never a clash — the screen does not invent one', () => {
    // The guard the render-phase adoption in `ProfileForm` now relies on: a
    // member the projection answered with no `lastUpdate` adopts a BLANK stamp
    // rather than null, which is what stops the adoption looping — and a blank
    // is exactly what this comparison already reads as "cannot tell".
    expect(profileFormIsStale('', '2026-08-30T11:04:00')).toBe(false)
    expect(profileFormIsStale('2026-07-31T09:12:00', '')).toBe(false)
    expect(profileFormIsStale('', '')).toBe(false)
  })

  it('and the door stays the authority — an echo it dislikes is ITS refusal to make', () => {
    const body = profileUpdateRequest(profileDraftOf(member()), '')
    expect(body.lastUpdate).toBe('')
    // The field is SENT, blank, rather than dropped: an absent key would leave
    // the door unable to tell "no stamp" from "a client that forgot one".
    expect(Object.keys(body)).toContain('lastUpdate')
  })
})

// ---------------------------------------------------------------------------

describe('aSiblingCommandDoesNotMakeTheFormCryWolf', () => {
  const opened = '2026-07-31T09:12:00'
  const moved = '2026-08-30T11:04:00'
  const seeded = profileDraftOf(member())

  it('🚩 a mobile change, a block or a removal leaves the stamp to be ADOPTED', () => {
    // The bug this exists for, reported from the live form: an analyst changes a
    // mobile, the door bumps `UpdatedAt` for it, the member re-reads, and the
    // profile form beside it announces that the member changed while they had it
    // open. It did — because of them, seconds ago, on a field this form does
    // not even draw. None of the nine moved, so the stamp is news about nothing.
    expect(profileStampVerdict(opened, moved, seeded, seeded)).toBe('adopt')
  })

  it('🚩 and adopting is not cosmetic — without it the next Save is refused', () => {
    // The half that makes this more than a hidden banner. `openedOn` is what the
    // command echoes, so a form left holding the superseded stamp meets
    // LOY-00103 on its next Save — a stale-write refusal raised against a member
    // nobody disagreed with the analyst about. The verdict is what lets the form
    // move its echo forward.
    expect(profileUpdateRequest(seeded, moved).lastUpdate).toBe(moved)
    expect(profileStampVerdict(moved, moved, seeded, seeded)).toBe('unmoved')
  })

  it('🚩 a REAL edit to one of the nine is still stale — the warning is not weakened', () => {
    // The whole risk of this change: quieting the false alarm must not quiet the
    // true one. One field moved in storage and the banner stands, whichever of
    // the nine it was.
    for (const field of PROFILE_FIELDS.map((f) => f.key)) {
      const stored = { ...seeded, [field]: 'moved by somebody else' }
      expect(profileStampVerdict(opened, moved, seeded, stored)).toBe('stale')
    }
  })

  it('🔑 it is about the FIELDS, not about who moved them', () => {
    // No mutation-watching could have answered this one: a DIFFERENT analyst who
    // changed only the mobile is exactly as harmless to a name correction as
    // this analyst doing it, and equally deserves no banner. Comparing the
    // seeded nine against the stored nine covers both without the screen ever
    // having to know whose command it was.
    const blockedElsewhere = profileDraftOf(member())
    expect(profileStampVerdict(opened, moved, seeded, blockedElsewhere)).toBe('adopt')
  })

  it('an unmoved stamp is unmoved whatever the fields say', () => {
    // Ordering matters: the stamp is asked first, so a member re-read that
    // brought back different values WITHOUT a new stamp is not this function's
    // problem to report — it cannot happen, and inventing a verdict for it
    // would be a warning the screen made up.
    expect(profileStampVerdict(opened, opened, seeded, { ...seeded, cityCode: 'JED' })).toBe(
      'unmoved',
    )
    expect(profileStampVerdict(null, moved, seeded, seeded)).toBe('unmoved')
    expect(profileStampVerdict(opened, '', seeded, seeded)).toBe('unmoved')
  })

  it('⚠ a trimmed-only difference is not a moved field', () => {
    // `dirtyProfileFields` compares trimmed, and this leans on that: a stored
    // value that gained a space is not somebody's edit, and a form that treated
    // it as one would put the banner back for a keystroke nobody made.
    expect(
      profileStampVerdict(opened, moved, seeded, { ...seeded, fullName: '  Nouf Al-Harbi ' }),
    ).toBe('adopt')
  })
})
