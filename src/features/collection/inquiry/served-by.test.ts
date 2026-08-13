import { describe, expect, it } from 'vitest'
import {
  NO_SERVED_BY,
  SERVED_BY_KINDS,
  SERVED_BY_SCREENS,
  buildServedByParams,
  defaultSelection,
  readServedBySelection,
  parseServedByText,
  resolvedKinds,
  servedByEntries,
  servedByGroups,
  servedByText,
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

  // ⚠️ FOUR on the collected-by reading since BackOffice 1167 built its arms against
  // the document's own collector column. ACCOUNTANT is the one that is absent
  // PERMANENTLY rather than pending: a document records who COLLECTED and an
  // accountant never collects, so the server refuses that combination outright and
  // offering it would be offering a filter that errors when used.
  it('offers the collected-by Kinds — and never ACCOUNTANT — on ACRs and Deposits', () => {
    expect(resolvedKinds('acrs')).toEqual(['COLLECTOR', 'SUPERVISOR', 'UNASSIGNED', 'MINE'])
    expect(resolvedKinds('deposits')).toEqual(resolvedKinds('acrs'))
    expect(resolvedKinds('acrs')).not.toContain('ACCOUNTANT')
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

  // 🚩 BackOffice 1167 — the collected-by screens land the callers who have a
  // referent there, and only those. A collector's own rounds are real rows; an
  // ACCOUNTANT's are provably none, because an accountant never collects. Landing
  // them anyway would open an EMPTY grid under a control claiming to show their
  // work, which is strictly worse than the estate under a control claiming nothing.
  it('lands a collector on the collected-by screens, and an accountant on the estate', () => {
    const collector: AssignmentOptions = {
      ...OPTIONS,
      defaultScope: { kind: 'MINE', staffId: '7787', role: 'COLLECTOR', displayName: 'مصلح' },
    }
    const accountant: AssignmentOptions = {
      ...OPTIONS,
      defaultScope: { kind: 'MINE', staffId: '4466', role: 'ACCOUNTANT', displayName: 'ضحى' },
    }

    expect(defaultSelection('acrs', collector)).toEqual({ kind: 'MINE', id: '7787' })
    expect(defaultSelection('deposits', collector)).toEqual({ kind: 'MINE', id: '7787' })
    expect(defaultSelection('acrs', accountant)).toEqual(NO_SERVED_BY)

    // …and the SAME accountant still lands scoped on the screens that read the
    // assignment, so this is the reading refusing them rather than the person.
    expect(defaultSelection('collections', accountant)).toEqual({ kind: 'MINE', id: '4466' })
  })

  // ⚠️ A blank role is the PURE SUPERVISOR — somebody who serves no branches and
  // only supervises — and the person merely NAMED as a supervisor with no roster row
  // of their own. Both have reports whose collections are real rows, so both land.
  it('lands a pure supervisor, whose Role is blank, on the collected-by screens too', () => {
    const supervisor: AssignmentOptions = {
      ...OPTIONS,
      defaultScope: { kind: 'MINE', staffId: '15493', role: '', displayName: '' },
    }
    expect(defaultSelection('acrs', supervisor)).toEqual({ kind: 'MINE', id: '15493' })
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

// ── BackOffice 1167 — the combobox half, on the two collected-by screens ─────────
//
// The strict picker's option values already carry the pair. A combobox cannot: its
// control is a text box, so the only thing that comes back out is a string, and
// these two functions are the whole of turning that string into a selection and
// back. `label` is the datalist option's own value, composed by the component
// (which has the translator) and matched here (which must stay pure).
describe('the combobox on the collected-by screens', () => {
  const ROSTER: AssignmentOptions = {
    accountants: [{ staffId: '4466', displayName: 'ضحى' }],
    collectors: [
      { staffId: '7787', displayName: 'مصلح' },
      { staffId: '8725', displayName: 'فهد' },
    ],
    supervisors: [{ staffId: '8725', displayName: 'فهد' }],
  }

  // The component's own composition, stubbed to something legible: the Kind has to
  // be readable from the text alone, because a datalist has no groups to carry it.
  const label = (entry: { kind: string; id: string; name: string }) =>
    entry.kind === 'UNASSIGNED'
      ? 'Off the roster'
      : entry.kind === 'SUPERVISOR'
        ? `${entry.name}'s team`
        : entry.kind === 'MINE'
          ? 'My collections'
          : entry.name

  const entries = () => servedByEntries('acrs', ROSTER, label)

  // 🔑 THE PROOF THE COMBOBOX EXISTS FOR. The roster holds 8 collectors while a
  // shipped ACR carries WHOEVER collected — so a strict picker would make an id
  // plainly visible in the grid un-typeable in the filter beside it. The typed id
  // travels as COLLECTOR, whose predicate is byte-identical to the equality the
  // free-text box this control replaced has always sent.
  it('a typed id that matches nothing travels as the COLLECTOR kind', () => {
    expect(parseServedByText('acrs', '99999', entries())).toEqual({
      kind: 'COLLECTOR',
      id: '99999',
    })
    expect(parseServedByText('deposits', ' 99999 ', entries())).toEqual({
      kind: 'COLLECTOR',
      id: '99999',
    })

    // …and it reaches the wire as an ordinary pick, indistinguishable from one made
    // off the roster. That is the point: one predicate, two ways of reaching it.
    expect(buildServedByParams(parseServedByText('acrs', '99999', entries()))).toEqual({
      ServedByKind: 'COLLECTOR',
      ServedById: '99999',
    })
  })

  // ⚠️ The mirror image, and the reason `freeText` is a per-screen contract rather
  // than a global. On a screen that reads ASSIGNED-TO, an id off the roster is by
  // definition assigned to nobody, so guessing at it would return a confidently
  // empty grid instead of admitting the pick was not understood.
  it('drops unmatched text on the screens that read the assignment', () => {
    const strict = servedByEntries('collections', ROSTER, label)
    expect(parseServedByText('collections', '99999', strict)).toEqual(NO_SERVED_BY)
  })

  it('matches a clicked suggestion by its label — that is what says which question', () => {
    expect(parseServedByText('acrs', 'مصلح', entries())).toEqual({
      kind: 'COLLECTOR',
      id: '7787',
    })

    // 🚩 A person who both collects AND supervises is offered TWICE, and only the
    // line the user clicked says which of the two questions they asked.
    expect(parseServedByText('acrs', "فهد's team", entries())).toEqual({
      kind: 'SUPERVISOR',
      id: '8725',
    })
  })

  // 🚩 THE ONE THE TICKET'S "byte-identical to today's predicate" DEPENDS ON. The box
  // this control replaced only ever asked `CollectorOperatorId = <what you typed>`,
  // so a bare id must keep asking exactly that — for a roster member, for a
  // supervisor, and for the caller's own id — or typing the number in the grid
  // silently answers a different question than it used to.
  it('reads a bare id as COLLECTOR even when that id is on the roster', () => {
    const scoped: AssignmentOptions = {
      ...ROSTER,
      defaultScope: { kind: 'MINE', staffId: '7787', role: 'COLLECTOR', displayName: 'مصلح' },
    }
    const scopedEntries = servedByEntries('acrs', scoped, label)

    // A collector typing their OWN id gets their own rounds — NOT the MINE entry at
    // the head of the list, which would silently add every one of their reports'.
    expect(parseServedByText('acrs', '7787', scopedEntries)).toEqual({
      kind: 'COLLECTOR',
      id: '7787',
    })

    // …and a supervisor's id gets that person's own rounds — NOT the SUPERVISOR
    // predicate, which EXCLUDES them, so an id visible in the grid would come back
    // with its own rows missing.
    expect(parseServedByText('acrs', '8725', scopedEntries)).toEqual({
      kind: 'COLLECTOR',
      id: '8725',
    })
  })

  it('reads an empty box as the estate, not as a filter', () => {
    expect(parseServedByText('acrs', '   ', entries())).toEqual(NO_SERVED_BY)
  })

  // The inverse, so the box redisplays what was chosen rather than a second
  // rendering of it — including a typed id, which has no entry and shows as itself.
  it('round-trips a selection back into the box', () => {
    expect(servedByText({ kind: 'SUPERVISOR', id: '8725' }, entries())).toBe("فهد's team")
    expect(servedByText({ kind: 'COLLECTOR', id: '99999' }, entries())).toBe('99999')
    expect(servedByText(NO_SERVED_BY, entries())).toBe('')
  })

  // ⚠️ THE ACCOUNTANTS GROUP IS NOT RENDERED HERE — not greyed, not empty-headed,
  // absent. The document records who COLLECTED and an accountant never collects, so
  // the server refuses the combination outright (spec D10); offering it would be
  // offering a filter that errors when used, and the receipt→store→assignment join
  // that could fake an answer is rejected because it would make one control mean two
  // different things on one screen.
  it('never offers the Accountants group on the collected-by screens', () => {
    const kinds = entries().map((entry) => entry.kind)
    expect(kinds).not.toContain('ACCOUNTANT')
    expect(entries().map((entry) => entry.id)).not.toContain('4466')

    // The same payload on Cash Collections DOES offer them, so this is the screen
    // ruling rather than an empty roster.
    expect(
      servedByEntries('collections', ROSTER, label).map((entry) => entry.kind),
    ).toContain('ACCOUNTANT')
  })

  // *Unassigned* keeps its place, last and carrying no id — here it means "collected
  // by somebody finance never enrolled", which is the only way to DISCOVER who is
  // missing from the roster, and the mate of the typed-id escape hatch above.
  it('offers Unassigned last, naming nobody', () => {
    const last = entries()[entries().length - 1]
    expect(last).toMatchObject({ kind: 'UNASSIGNED', id: '' })
    expect(buildServedByParams(parseServedByText('acrs', 'Off the roster', entries()))).toEqual({
      ServedByKind: 'UNASSIGNED',
    })
  })

  // 🔑 **BackOffice 1168 — Deposits is the ACRs list, control-for-control.** The
  // ticket's claim is that mounting the collector reading on the fourth screen adds
  // NO second meaning, and this is where that is measured rather than asserted in a
  // comment: one per-screen table, two entries, and everything the control offers
  // and parses comes out identical for one payload.
  //
  // ⚠️ It is not a tautology about a shared module. The table could perfectly well
  // have given Deposits its own reading, its own `freeText`, or its own Kind list —
  // 1166 did exactly that for Cash Collections, whose free-text box SURVIVED beside
  // the control because there the two genuinely ask different questions. What makes
  // these two the same is a fact about the DOCUMENTS: a deposit records the
  // depositor, and its candidate ACRs are gathered by that very id, so "collected
  // by" and "deposited by" cannot diverge.
  //
  // 🚩 A `toEqual` over both tables, not a spot-check of one field: a later slice
  // adding a third key to the contract would otherwise pass this test while quietly
  // splitting the two screens on that key.
  it('renders the same groups, kinds and entries as the ACRs list', () => {
    expect(SERVED_BY_SCREENS.deposits).toEqual(SERVED_BY_SCREENS.acrs)
    expect(SERVED_BY_SCREENS.deposits.reading).toBe('collector')

    expect(resolvedKinds('deposits')).toEqual(resolvedKinds('acrs'))
    expect(servedByGroups('deposits', ROSTER)).toEqual(servedByGroups('acrs', ROSTER))
    expect(servedByEntries('deposits', ROSTER, label)).toEqual(entries())

    // …down to what a typed id and a clicked suggestion each become — the two
    // routes into a selection, both answering the same way on either screen.
    const depositEntries = servedByEntries('deposits', ROSTER, label)
    expect(parseServedByText('deposits', '99999', depositEntries)).toEqual(
      parseServedByText('acrs', '99999', entries()),
    )
    expect(parseServedByText('deposits', "فهد's team", depositEntries)).toEqual({
      kind: 'SUPERVISOR',
      id: '8725',
    })

    // The mutation-catcher: Cash Collections reads the SAME payload differently, so
    // "identical" above is a ruling this test can watch being made rather than a
    // property every screen trivially shares.
    expect(SERVED_BY_SCREENS.collections).not.toEqual(SERVED_BY_SCREENS.deposits)
    expect(servedByEntries('collections', ROSTER, label)).not.toEqual(depositEntries)
  })
})
