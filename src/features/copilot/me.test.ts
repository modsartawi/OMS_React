import { describe, expect, it } from 'vitest'
import { addMember, fromMeWire, lookupFits, removeMember } from './me'

const label = (en: string) => ({ en, ar: `${en} (ar)` })

/** The wire as 3689's build notes give it, one of each shape. */
const WIRE = {
  readings: [
    {
      kind: 'scope',
      value: 'ksa',
      label: label('Saudi Arabia'),
      unused: false,
      choices: [
        { value: 'chain', label: label('The whole chain') },
        { value: 'ksa', label: label('Saudi Arabia') },
        { value: 'bahrain', label: label('Bahrain') },
        { value: 'set:01jcset00000000000000000001', label: label('my stores') },
      ],
      keptAt: '2026-11-12T09:32:00',
      keptBy: 'direct',
    },
    {
      kind: 'period',
      value: 'last-fortnight',
      label: label('last-fortnight'),
      unused: true,
      choices: [
        { value: 'today', label: label('Today') },
        { value: 'last-7-days', label: label('The last 7 days') },
      ],
      keptAt: '2026-11-12T09:30:00',
      keptBy: 'offer',
    },
  ],
  sets: [
    {
      setId: '01JCSET00000000000000000001',
      name: 'my stores',
      kind: 'store',
      members: [
        { key: 'store:S101', kind: 'store', label: label('Jeddah Corniche'), gone: false },
        { key: 'store:S999', kind: 'store', label: label('store:S999'), gone: true },
      ],
      gone: 1,
      keptAt: '2026-11-12T09:31:00',
      keptBy: 'offer',
    },
  ],
  limits: { maxSets: 10, maxMembers: 200, maxName: 40 },
  canChange: true,
}

describe('the page "What the copilot knows about me" (ticket 894, BackOffice 3689)', () => {
  it('fromMeWire_listsReadingsInKindOrderAndSets_markingUnusedReadingsAndGoneMembers', () => {
    const me = fromMeWire(WIRE)
    // Period before scope, whatever order the wire used.
    expect(me.readings.map((r) => [r.kind, r.value, r.unused])).toEqual([
      ['period', 'last-fortnight', true],
      ['scope', 'ksa', false],
    ])
    // A set scope (review of 3633, R8) is a choice like the others, labelled by the server with the set's name.
    expect(me.readings[1].choices.map((c) => [c.value, c.label.en])).toEqual([
      ['chain', 'The whole chain'],
      ['ksa', 'Saudi Arabia'],
      ['bahrain', 'Bahrain'],
      ['set:01jcset00000000000000000001', 'my stores'],
    ])
    expect(me.canChange).toBe(true)
    expect(me.sets).toHaveLength(1)
    expect(me.sets[0].name).toBe('my stores')
    expect(me.sets[0].members.map((m) => [m.key, m.gone])).toEqual([
      ['store:S101', false],
      ['store:S999', true],
    ])
    expect(me.sets[0].gone).toBe(1)
    expect(me.limits).toEqual({ maxSets: 10, maxMembers: 200, maxName: 40 })
    expect(me.empty).toBe(false)
  })

  it('fromMeWire_aMalformedOrEmptyReplyIsAnEmptyPage', () => {
    for (const w of [null, undefined, {}, { readings: 'x', sets: null }]) {
      const me = fromMeWire(w as never)
      expect(me.readings).toEqual([])
      expect(me.sets).toEqual([])
      expect(me.empty).toBe(true)
    }
    // A kind the page does not know is not drawn; a member without a key is not drawn.
    const odd = fromMeWire({
      readings: [{ kind: 'weather', value: 'sunny', label: label('x'), unused: false, choices: [], keptAt: '', keptBy: 'page' }],
      sets: [{ ...WIRE.sets[0], members: [{ key: '', kind: 'store', label: label('x'), gone: false }] }],
    } as never)
    expect(odd.readings).toEqual([])
    expect(odd.sets[0].members).toEqual([])
  })

  it('canChange_falseHidesTheChanges_absentReadsAsTheOldDoorThatAnsweredOnlyWhenOn', () => {
    // Review of 3633: GET Copilot/Me answers whatever the switch; `canChange: false` = list, delete and forget only.
    expect(fromMeWire({ ...WIRE, canChange: false }).canChange).toBe(false)
    // A door from before the review answered only with own readings applying: there, changes were allowed.
    const { canChange: _c, ...old } = WIRE
    void _c
    expect(fromMeWire(old).canChange).toBe(true)
    // Anything but a plain false is not a refusal to draw.
    expect(fromMeWire({ ...WIRE, canChange: 'no' } as never).canChange).toBe(true)
  })

  it('aSetsGoneCountFollowsItsMembers_whenTheWireCountIsMissing', () => {
    const { gone: _drop, ...noCount } = WIRE.sets[0]
    void _drop
    expect(fromMeWire({ sets: [noCount] } as never).sets[0].gone).toBe(1)
  })
  it('editingASet_sendsTheLiveMembersInOrder_leavingGoneOnesOut', () => {
    const set = fromMeWire(WIRE).sets[0]
    const s102 = { key: 'store:S102', kind: 'store', label: label('Jeddah Tahlia'), gone: false }
    // Adding: the current keys, the gone one left out (the server refuses it), the match last.
    expect(addMember(set, s102, 200)).toEqual({ ok: true, request: { setId: set.setId, members: ['store:S101', 'store:S102'] } })
    // A member already in the set is not sent twice.
    expect(addMember(set, set.members[0], 200)).toEqual({ ok: false, why: 'already' })
    // One kind to a set.
    expect(addMember(set, { key: 'city:Jeddah', kind: 'city', label: label('Jeddah'), gone: false }, 200)).toEqual({ ok: false, why: 'kind' })
    // A full set.
    expect(addMember(set, s102, 1)).toEqual({ ok: false, why: 'full' })
    // Removing: what is left, gone ones out too.
    const two = { ...set, members: [...set.members, s102] }
    expect(removeMember(two, 'store:S101')).toEqual({ ok: true, request: { setId: set.setId, members: ['store:S102'] } })
    // Removing a gone member is the same edit: it is left out.
    expect(removeMember(two, 'store:S999')).toEqual({ ok: true, request: { setId: set.setId, members: ['store:S101', 'store:S102'] } })
    // The last live member: a set is never left empty; delete the set instead.
    expect(removeMember(set, 'store:S101')).toEqual({ ok: false, why: 'last' })
  })

  it('lookupFits_notBlankAndAtMostOneHundredCharacters', () => {
    expect(lookupFits('Jeddah')).toBe(true)
    expect(lookupFits('  ')).toBe(false)
    expect(lookupFits('a'.repeat(100))).toBe(true)
    expect(lookupFits('a'.repeat(101))).toBe(false)
  })
})
