import { describe, expect, it } from 'vitest'
import {
  NO_SERVED_BY,
  SERVED_BY_KINDS,
  buildServedByParams,
  defaultSelection,
  readServedBySelection,
  resolvedKinds,
  servedByGroups,
  type AssignmentOptions,
} from './served-by'

// BackOffice tracer 1163's criteria Proof for the shared "Served by" control.
// What is asserted is what the wire and the operator can observe — the params
// object, and which groups a screen offers — never how the builder reached it.

const OPTIONS: AssignmentOptions = {
  accountants: [{ staffId: '4466', displayName: 'ضحى عبدالرحمن بن محمد الجعفري' }],
  collectors: [{ staffId: '7787', displayName: 'مصلح محمد عبدالله العمري' }],
  supervisors: [],
}

describe('buildServedByParams', () => {
  it('emits the Kind and the id as a pair', () => {
    expect(buildServedByParams({ kind: SERVED_BY_KINDS.accountant, id: '4466' })).toEqual({
      ServedByKind: 'ACCOUNTANT',
      ServedById: '4466',
    })
  })

  // 🚩 The promise that lets every screen adopt this control with no feature flag:
  // with nothing picked the query is the one the screen sent before it existed.
  it('sends NEITHER key when nothing is picked, rather than sending them blank', () => {
    expect(buildServedByParams(NO_SERVED_BY)).toEqual({})
    expect(buildServedByParams(undefined)).toEqual({})
    expect(buildServedByParams({ kind: '', id: '4466' })).toEqual({})
  })

  it('trims, so a pasted id with a stray space is still the same filter', () => {
    expect(buildServedByParams({ kind: SERVED_BY_KINDS.collector, id: ' 7787 ' })).toEqual({
      ServedByKind: 'COLLECTOR',
      ServedById: '7787',
    })
  })

  // UNASSIGNED names nobody by design — a branch with an empty slot here, a
  // collector off the roster on the two collected-by screens.
  it('sends UNASSIGNED with no id at all', () => {
    expect(buildServedByParams({ kind: SERVED_BY_KINDS.unassigned, id: '' })).toEqual({
      ServedByKind: 'UNASSIGNED',
    })
  })

  // The server answers a named Kind with a blank id with a 400. A toolbar should
  // not construct a request it knows will be refused.
  it('sends nothing when a named Kind has no id', () => {
    expect(buildServedByParams({ kind: SERVED_BY_KINDS.accountant, id: '   ' })).toEqual({})
  })
})

describe('servedByGroups', () => {
  it('offers Accountants on Cash Collections — the screen that reads the assignment', () => {
    expect(servedByGroups('collections', OPTIONS).map((g) => g.kind)).toEqual([
      'ACCOUNTANT',
      'COLLECTOR',
    ])
  })

  // ⚠️ Not tidiness: those screens read the document's own collector column, and an
  // accountant never collects. The server refuses the combination outright.
  it('hides Accountants on the two collected-by screens', () => {
    expect(servedByGroups('acrs', OPTIONS).map((g) => g.kind)).toEqual(['COLLECTOR'])
    expect(servedByGroups('deposits', OPTIONS).map((g) => g.kind)).toEqual(['COLLECTOR'])
  })

  // 🚩 Empty on day one for everybody — the extract's supervisor columns are blank.
  // An empty heading in a picker reads as a broken screen.
  it('omits a group with no members rather than rendering an empty heading', () => {
    expect(servedByGroups('collections', OPTIONS).map((g) => g.kind)).not.toContain('SUPERVISOR')

    const withSupervisor = { ...OPTIONS, supervisors: [{ staffId: '9', displayName: 'X' }] }
    expect(servedByGroups('collections', withSupervisor).map((g) => g.kind)).toContain('SUPERVISOR')
  })

  // 🚩 BackOffice 1164's `SupervisorsGroupIsAbsentUntilSomebodyIsNamed`. Turning the
  // SUPERVISOR Kind on server-side does NOT put a Supervisors heading on anybody's
  // toolbar: a supervisor is not a role, you are one iff somebody names you, and the
  // shipped extract's supervisor columns are entirely blank. So the group stays
  // absent on today's seed for every screen that offers it — and appears by itself,
  // with no deploy, the afternoon finance names the first one.
  it('keeps the Supervisors group absent until somebody is named as one', () => {
    const shippedSeed: AssignmentOptions = { ...OPTIONS, supervisors: [] }

    for (const screen of ['collections', 'settlement'] as const) {
      expect(servedByGroups(screen, shippedSeed).map((g) => g.kind)).not.toContain('SUPERVISOR')
    }

    // The moment one exists, nothing else has to change.
    const named: AssignmentOptions = {
      ...OPTIONS,
      supervisors: [{ staffId: '6420', displayName: 'عادل' }],
    }
    expect(servedByGroups('collections', named).map((g) => g.kind)).toContain('SUPERVISOR')
  })

  it('renders nothing at all before the payload arrives', () => {
    expect(servedByGroups('collections', undefined)).toEqual([])
  })
})

// BackOffice 1164 — the other three arms resolve, so the picker may offer them.
describe('resolvedKinds', () => {
  // The invariant, restated for the slice that changed the answer: a Kind is offered
  // iff the server can answer it on THAT SCREEN'S READING. Offering one it refuses is
  // a filter that errors when used.
  // ⚠️ FIVE since 1165: MINE — the landing scope — joined the list, because a screen
  // may only LAND ON a Kind its reading can answer, exactly as it may only offer one.
  it('offers all the assignment-reading Kinds on those screens', () => {
    expect(resolvedKinds('collections')).toEqual([
      'ACCOUNTANT',
      'COLLECTOR',
      'SUPERVISOR',
      'UNASSIGNED',
      'MINE',
    ])
    expect(resolvedKinds('settlement')).toEqual(resolvedKinds('collections'))
  })

  // ⚠️ The collected-by arms are 1167's (ACRs) and 1168's (Deposits) and the server
  // still 500s on them. This is what stops mounting the shared picker on those
  // toolbars from silently offering three picks that error.
  it('offers nothing yet on the two collected-by screens', () => {
    expect(resolvedKinds('acrs')).toEqual([])
    expect(resolvedKinds('deposits')).toEqual([])
  })
})

// BackOffice 1165 — default-to-mine, the client half.
describe('defaultSelection', () => {
  const scoped: AssignmentOptions = {
    ...OPTIONS,
    defaultScope: { kind: 'MINE', staffId: '4466', displayName: 'ضحى' },
  }

  it('opens the assignment-reading screens on the caller’s own scope', () => {
    expect(defaultSelection('collections', scoped)).toEqual({ kind: 'MINE', id: '4466' })
    expect(defaultSelection('settlement', scoped)).toEqual({ kind: 'MINE', id: '4466' })
  })

  // 🚩 The three ways it is "nothing picked", all of them the estate and none an
  // error. A caller on no roster row is the ~7,600 case; a missing payload is an
  // unreachable sink; and a scope the SERVER cannot yet answer on this screen's
  // reading would break the screen on mount rather than merely being ignored.
  it('lands unfiltered when the caller is on no roster row', () => {
    expect(defaultSelection('collections', { ...OPTIONS, defaultScope: null })).toEqual(
      NO_SERVED_BY,
    )
    expect(defaultSelection('collections', OPTIONS)).toEqual(NO_SERVED_BY)
  })

  it('lands unfiltered before the payload arrives, or when it never does', () => {
    expect(defaultSelection('collections', undefined)).toEqual(NO_SERVED_BY)
  })

  it('lands unfiltered on a screen whose reading cannot answer the Kind yet', () => {
    expect(defaultSelection('acrs', scoped)).toEqual(NO_SERVED_BY)
    expect(defaultSelection('deposits', scoped)).toEqual(NO_SERVED_BY)
  })

  it('ignores a scope with no id rather than sending a pick the server refuses', () => {
    const blank: AssignmentOptions = {
      ...OPTIONS,
      defaultScope: { kind: 'MINE', staffId: '  ', displayName: '' },
    }
    expect(defaultSelection('collections', blank)).toEqual(NO_SERVED_BY)
  })
})

describe('readServedBySelection', () => {
  it('round-trips a selection through the applied query', () => {
    const selection = { kind: SERVED_BY_KINDS.accountant, id: '4466' } as const
    expect(readServedBySelection(buildServedByParams(selection))).toEqual(selection)
  })

  it('reads an un-scoped query as nothing picked', () => {
    expect(readServedBySelection({ StoreId: '1024' })).toEqual(NO_SERVED_BY)
    expect(readServedBySelection(undefined)).toEqual(NO_SERVED_BY)
  })
})
