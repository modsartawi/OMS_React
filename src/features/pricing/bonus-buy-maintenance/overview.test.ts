/**
 * Ticket 416 — the promotion overview's pure seam (BackOffice spec 2374).
 */
import { describe, expect, it } from 'vitest'
import { ApiError } from '@/core/api'
import en from '@/locales/en/bonus-buy-maintenance.json'
import type { BbyMaintainOutcome, BbyRefusal } from '@/core/models/bonus-buy-maintenance'
import {
  canActivateSelection,
  canDeletePromotion,
  editorPath,
  overviewSeverity,
  overviewStatus,
  readPromotionFlip,
  runEach,
  testableNumbers,
} from './overview'

const ok = (number: string): BbyMaintainOutcome => ({ status: 'saved', number, refusals: [], warnings: [] })
const refusal = (code: string): BbyRefusal => ({
  code,
  english: `${code} in English`,
  arabic: `${code} بالعربية`,
})
const refused = (...refusals: BbyRefusal[]): BbyMaintainOutcome => ({
  status: 'refused',
  number: null,
  refusals,
  warnings: [],
})

describe('promotion overview maps blank/1/2 to Activated/Planned/Deactivated', () => {
  it('reads SAP’s status column', () => {
    expect(overviewStatus('')).toBe('activated')
    expect(overviewStatus('1')).toBe('planned')
    expect(overviewStatus('2')).toBe('deactivated')
  })

  it('a space-padded code is SAP’s blank — activated', () => {
    expect(overviewStatus(' ')).toBe('activated')
  })

  it('🚩 a MISSING status is unknown, never live — a drifted field must not paint every row Activated', () => {
    expect(overviewStatus(null)).toBe('unknown')
    expect(overviewStatus(undefined)).toBe('unknown')
  })

  // Ticket 419 took '3' out of this list: spec 2396 made it Tested (the block at the end).
  it('the legacy A/I/D/X letters are NOT guessed into the four — unknown', () => {
    for (const code of ['A', 'I', 'D', 'X', '4']) expect(overviewStatus(code)).toBe('unknown')
  })

  it('only Activated is the in-force colour; Planned waits for a human', () => {
    expect(overviewSeverity('activated')).toBe('ok')
    expect(overviewSeverity('planned')).toBe('warn')
    expect(overviewSeverity('deactivated')).toBe('mute')
    expect(overviewSeverity('unknown')).toBe('mute')
  })
})

describe('multi-select activate reports each number outcome and keeps going', () => {
  it('one call per number, in order, and a refusal, a not-found and a throw never stop the run', async () => {
    const called: string[] = []
    const numbers = ['OMS000000001', 'OMS000000002', 'OMS000000003', 'OMS000000004', 'OMS000000005']
    const progress: number[] = []
    const out = await runEach(
      numbers,
      async (n) => {
        called.push(n)
        if (n === 'OMS000000002') return refused(refusal('BBY-051'), refusal('BBY-020'))
        if (n === 'OMS000000003') return { status: 'notFound', number: n, refusals: [], warnings: [] }
        if (n === 'OMS000000004') throw new ApiError('server', 'SIS.Api fault', 500)
        return ok(n)
      },
      'The action could not be completed.',
      (_, done) => progress.push(done),
    )

    expect(called).toEqual(numbers)
    expect(progress).toEqual([1, 2, 3, 4, 5])
    expect(out.map((o) => [o.number, o.kind])).toEqual([
      ['OMS000000001', 'done'],
      ['OMS000000002', 'refused'],
      ['OMS000000003', 'notFound'],
      ['OMS000000004', 'failed'],
      ['OMS000000005', 'done'],
    ])
    // Every refusal of a refused number is kept, not just the first.
    expect(out[1].refusals.map((r) => r.code)).toEqual(['BBY-051', 'BBY-020'])
    expect(out[3].message).toBe('SIS.Api fault')
  })
})

describe('promotion activate shows every refused bonus buy and changes nothing', () => {
  // The shipped `BbyMaintainResult`: each refused bonus buy in `bonusBuys[]` with its own
  // refusals, and the same refusals flattened (naming no bonus buy) in `refusals[]`.
  const item = (number: string, ...refusals: BbyRefusal[]) => ({ number, status: 'refused', refusals, warnings: [] })
  const flip = (...items: ReturnType<typeof item>[]): BbyMaintainOutcome => ({
    ...refused(...items.flatMap((i) => i.refusals)),
    bonusBuys: items,
  })

  it('a refused flip is changed:false and lists every refused bonus buy with all its refusals', () => {
    const view = readPromotionFlip(
      'P000000001',
      flip(
        item('OMS000000001', refusal('BBY-051'), refusal('BBY-020')),
        item('OMS000000003', refusal('BBY-030')),
        item('OMS000000007', refusal('BBY-040')),
      ),
    )
    expect(view.changed).toBe(false)
    expect(view.refused.map((g) => g.number)).toEqual(['OMS000000001', 'OMS000000003', 'OMS000000007'])
    expect(view.refused[0].refusals.map((r) => r.code)).toEqual(['BBY-051', 'BBY-020'])
    // Both languages travel with each refusal.
    expect(view.refused[0].refusals[0].arabic).toBe('BBY-051 بالعربية')
    // …and the flattened copies are not listed a second time under the promotion.
    expect(view.refused).toHaveLength(3)
  })

  it('a refusal outside every bonus buy groups under the promotion', () => {
    const view = readPromotionFlip('P000000001', refused(refusal('BBY-090')))
    expect(view.refused).toEqual([{ number: 'P000000001', refusals: [refusal('BBY-090')] }])
  })

  it('an accepted flip is changed:true with nothing refused', () => {
    expect(readPromotionFlip('P000000001', ok('P000000001'))).toEqual({
      changed: true,
      notFound: false,
      refused: [],
    })
  })

  it('a promotion gone elsewhere is notFound — changed nothing, and NOT an empty refusal list', () => {
    expect(
      readPromotionFlip('P000000001', { status: 'notFound', number: null, refusals: [], warnings: [] }),
    ).toEqual({ changed: false, notFound: true, refused: [] })
  })
})

describe('delete promotion is disabled while it holds bonus buys', () => {
  const row = { bbyNumber: 'OMS000000001', description: '1 + 1', validFrom: '', validTo: '', bbyStatus: '1' }
  it('offered only when empty', () => {
    expect(canDeletePromotion({ bonusBuys: [] })).toBe(true)
    expect(canDeletePromotion({ bonusBuys: [row] })).toBe(false)
    expect(canDeletePromotion(null)).toBe(false)
  })
})

describe('the editor page each overview button opens', () => {
  it('Create, Change and Display address the editor under the promotion', () => {
    expect(editorPath('P000000001', 'create')).toBe('/pricing/bonus-buy-maintenance/P000000001/bonus-buy/new')
    expect(editorPath('P000000001', 'change', 'OMS000000002')).toBe(
      '/pricing/bonus-buy-maintenance/P000000001/bonus-buy/OMS000000002',
    )
    expect(editorPath('P000000001', 'display', 'OMS000000002')).toBe(
      '/pricing/bonus-buy-maintenance/P000000001/bonus-buy/OMS000000002?mode=display',
    )
  })
})

/** Ticket 419 (spec 2396, ADR 0063): the fourth status, and Activate only after a test. */
describe('status 3 reads Tested in the overview and the editor', () => {
  it('`3` is Tested, space-padded as SAP pads too', () => {
    expect(overviewStatus('3')).toBe('tested')
    expect(overviewStatus(' 3 ')).toBe('tested')
  })

  it('the label both screens render is "Tested" — overview rows and the editor header read one key', () => {
    // Both `StatusCell` and the editor's header render `overview.status.<overviewStatus(code)>`.
    expect(en.overview.status[overviewStatus('3') as keyof typeof en.overview.status]).toBe('Tested')
  })

  it('Tested is ready to go (`go`): neither live nor waiting on its author', () => {
    expect(overviewSeverity('tested')).toBe('go')
  })
})

describe('activate on a Planned bonus buy is not offered', () => {
  it('a selection holding a Planned bonus buy cannot be activated, one row or many', () => {
    expect(canActivateSelection(['planned'])).toBe(false)
    expect(canActivateSelection(['tested', 'planned', 'deactivated'])).toBe(false)
  })

  it('Tested, and Deactivated (reactivation needs no re-test), are offered', () => {
    expect(canActivateSelection(['tested'])).toBe(true)
    expect(canActivateSelection(['tested', 'deactivated'])).toBe(true)
  })

  it('an empty selection offers nothing', () => {
    expect(canActivateSelection([])).toBe(false)
  })
})

describe('Mark Tested on a selection sends only its Planned bonus buys', () => {
  it('a select-all keeps the Planned ones, in grid order, and drops every other status', () => {
    expect(
      testableNumbers([
        { number: '1', status: 'planned' },
        { number: '2', status: 'tested' },
        { number: '3', status: 'activated' },
        { number: '4', status: 'planned' },
        { number: '5', status: 'deactivated' },
        { number: '6', status: 'unknown' },
      ]),
    ).toEqual(['1', '4'])
  })

  it('a selection with no Planned bonus buy has nothing to mark', () => {
    expect(testableNumbers([{ number: '2', status: 'tested' }])).toEqual([])
    expect(testableNumbers([])).toEqual([])
  })
})
