import { describe, expect, it } from 'vitest'
import {
  NO_SERVED_BY,
  SERVED_BY_KINDS,
  buildServedByParams,
  readServedBySelection,
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

  it('renders nothing at all before the payload arrives', () => {
    expect(servedByGroups('collections', undefined)).toEqual([])
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
