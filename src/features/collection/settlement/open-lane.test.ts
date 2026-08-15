import { describe, expect, it } from 'vitest'
import type { SettlementOpenLaneRow } from '@/core/models/settlement'
import { OPEN_LANE_LIMIT } from './cap'
import { buildOpenLane, DEFAULT_OPEN_TAB, openTabSearch, readOpenTab } from './open-lane'

/**
 * **The open settlements lane's projection** (ticket 285, spec 282 D8).
 *
 * 🚩 Every assertion here is something a **reader of the screen** would notice — the
 * order of rows, which section a row landed in, which of the five states drew, what
 * the signpost says. Nothing asserts an internal function's shape (spec 282 §Testing
 * Decisions), which is what lets the module be rearranged without rewriting the file
 * that proves it.
 *
 * The three Proof bullets, and why each is here rather than left to the drive:
 *
 * 1. **the split, and the server's order preserved** — the lane is capped, so
 *    re-sorting a capped page silently changes which rows the cap kept;
 * 2. **the signpost's comparison claimed only when true** — the one line on screen
 *    that says the estate holds something worse than anything of yours;
 * 3. **empty ≠ emptied-by-filter ≠ failed** — the assertion that stops a refused door
 *    rendering as good news.
 */

/** The server's answer, one row. Terse, because these tests are meant to be read as
 *  *cases* and twelve lines of `postedByStaffId: ''` between two of them is how a
 *  case stops being visible. */
function row(o: {
  entryNumber: number
  ageDays?: number
  kind?: 'SHORTAGE' | 'SURPLUS'
  isMine?: boolean
  servedBy?: string
  storeId?: string
  amount?: number
  remaining?: number
}): SettlementOpenLaneRow {
  const amount = o.amount ?? 100
  return {
    settlementEntryId: `E${o.entryNumber}`,
    entryNumber: o.entryNumber,
    storeId: o.storeId ?? '0142',
    storeName: 'Al-Rawdah Pharmacy',
    entryKind: o.kind ?? 'SHORTAGE',
    amount,
    remainingAmount: o.remaining ?? amount,
    reason: 'test',
    status: 'OPEN',
    batchId: '',
    postedByStaffId: '30117',
    postedByName: 'Huda',
    postedAt: '2026-03-09T11:14:00',
    closedByStaffId: '',
    closedAt: '',
    closedReason: '',
    currencyKey: 'SAR',
    ...(o.servedBy !== undefined ? { servedBy: o.servedBy } : {}),
    ...(o.isMine !== undefined ? { isMine: o.isMine } : {}),
    ...(o.ageDays !== undefined ? { ageDays: o.ageDays } : {}),
  }
}

const numbers = (rows: readonly SettlementOpenLaneRow[]) => rows.map((r) => r.entryNumber)

/** The server's order: oldest first, tie-broken by entry number so it is TOTAL. */
const SERVER_ORDER: SettlementOpenLaneRow[] = [
  row({ entryNumber: 11, ageDays: 162, kind: 'SHORTAGE', isMine: false }),
  row({ entryNumber: 12, ageDays: 159, kind: 'SURPLUS', isMine: true }),
  // ⚠️ The tie: two entries posted the same day. The door breaks it on the entry
  // number, ascending — 20 before 21.
  row({ entryNumber: 20, ageDays: 140, kind: 'SHORTAGE', isMine: true }),
  row({ entryNumber: 21, ageDays: 140, kind: 'SHORTAGE', isMine: false }),
  row({ entryNumber: 30, ageDays: 3, kind: 'SURPLUS', isMine: false }),
  row({ entryNumber: 31, ageDays: 0, kind: 'SHORTAGE', isMine: true }),
]

const lane = (over: Partial<Parameters<typeof buildOpenLane>[0]> = {}) =>
  buildOpenLane({ rows: SERVER_ORDER, failed: false, tab: 'owing', mineOnly: false, ...over })

describe('the lane splits one answer into two tabs', () => {
  it('puts SHORTAGE on Owing and SURPLUS on Owed, and counts both from the one answer', () => {
    const owing = lane({ tab: 'owing' })
    const owed = lane({ tab: 'owed' })

    // Both tabs report the same two counts whichever one is being looked at — the
    // whole reason a single call feeds them.
    expect(owing.counts).toEqual({ owing: 4, owed: 2 })
    expect(owed.counts).toEqual({ owing: 4, owed: 2 })

    const shown = (l: ReturnType<typeof lane>) =>
      l.view.kind === 'rows' ? l.view.sections.flatMap((s) => numbers(s.rows)) : []
    expect(shown(owing).sort((a, b) => a - b)).toEqual([11, 20, 21, 31])
    expect(shown(owed).sort((a, b) => a - b)).toEqual([12, 30])
  })

  it('keeps the SERVER order inside each section, ties and all — it never re-sorts', () => {
    const view = lane({ tab: 'owing' }).view
    if (view.kind !== 'rows') throw new Error('expected rows')

    const mine = view.sections.find((s) => s.which === 'mine')!
    const theirs = view.sections.find((s) => s.which === 'theirs')!

    // Oldest first within each section, and the 140-day tie resolved by entry
    // number: 20 is mine, 21 is theirs, and each sits at the head of its own tail.
    expect(numbers(mine.rows)).toEqual([20, 31])
    expect(numbers(theirs.rows)).toEqual([11, 21])
    expect(mine.oldestAgeDays).toBe(140)
    expect(theirs.oldestAgeDays).toBe(162)
  })

  it('ranks yours FIRST and never drops the rest of the estate', () => {
    const view = lane({ tab: 'owing' }).view
    if (view.kind !== 'rows') throw new Error('expected rows')

    expect(view.sections.map((s) => s.which)).toEqual(['mine', 'theirs'])
    // 🚩 The carve-out: the estate's OLDEST owing entry belongs to nobody's *mine*,
    // and it is still on the screen.
    expect(numbers(view.sections[1].rows)).toContain(11)
  })

  it('draws one unsectioned list when the wire says nothing about who serves a branch', () => {
    // Server dependency §6 unbuilt: no `isMine`, no `ageDays`, no `servedBy`.
    const bare = [row({ entryNumber: 8 }), row({ entryNumber: 9 })]
    const built = buildOpenLane({ rows: bare, failed: false, tab: 'owing', mineOnly: false })

    expect(built.ranked).toBe(false)
    // 🚩 And no *Served by* column either: drawing "Nobody assigned" on every row
    // would be a confident false statement about the estate's pairing, where drawing
    // nothing is merely silence.
    expect(built.named).toBe(false)
    // 🚩 …and the screen must stop claiming *oldest first*: `sort=age` is half of the
    // same dependency, so a door sending no ages answered its own default order.
    expect(built.aged).toBe(false)
    expect(lane().aged).toBe(true)
    expect(lane().named).toBe(false)
    expect(
      buildOpenLane({
        rows: [row({ entryNumber: 1, ageDays: 2, isMine: false, servedBy: '' })],
        failed: false,
        tab: 'owing',
        mineOnly: false,
      }).named,
    ).toBe(true)
    if (built.view.kind !== 'rows') throw new Error('expected rows')
    expect(built.view.sections.map((s) => s.which)).toEqual(['all'])
    expect(numbers(built.view.sections[0].rows)).toEqual([8, 9])
    // Nothing is derived — no age, and therefore nothing to signpost.
    expect(built.view.sections[0].oldestAgeDays).toBeNull()
    expect(built.view.sections[0].signpost).toEqual({ kind: 'silent' })
  })
})

describe('the signpost claims the comparison only when it is true', () => {
  const signpostOf = (rows: SettlementOpenLaneRow[]) => {
    const view = buildOpenLane({ rows, failed: false, tab: 'owing', mineOnly: false }).view
    if (view.kind !== 'rows') throw new Error('expected rows')
    return view.sections.find((s) => s.which === 'theirs')!.signpost
  }

  it('says the estate holds something older than anything of yours, WHEN it does', () => {
    expect(
      signpostOf([
        row({ entryNumber: 1, ageDays: 162, isMine: false }),
        row({ entryNumber: 2, ageDays: 159, isMine: true }),
      ]),
    ).toEqual({ kind: 'olderThanYours', oldestAgeDays: 162, yoursOldestAgeDays: 159 })
  })

  it('states the second section’s oldest and DROPS the clause when yours is older', () => {
    expect(
      signpostOf([
        row({ entryNumber: 1, ageDays: 200, isMine: true }),
        row({ entryNumber: 2, ageDays: 39, isMine: false }),
      ]),
    ).toEqual({ kind: 'oldest', oldestAgeDays: 39 })
  })

  it('drops the clause on a TIE — equal is not older', () => {
    expect(
      signpostOf([
        row({ entryNumber: 1, ageDays: 90, isMine: true }),
        row({ entryNumber: 2, ageDays: 90, isMine: false }),
      ]),
    ).toEqual({ kind: 'oldest', oldestAgeDays: 90 })
  })

  it('says nothing at all when there is no section of yours to compare against', () => {
    expect(
      signpostOf([
        row({ entryNumber: 1, ageDays: 162, isMine: false }),
        row({ entryNumber: 2, ageDays: 40, isMine: false }),
      ]),
    ).toEqual({ kind: 'silent' })
  })

  it('says nothing when the server sent ranking but no ages', () => {
    expect(
      signpostOf([
        row({ entryNumber: 1, isMine: false }),
        row({ entryNumber: 2, isMine: true }),
      ]),
    ).toEqual({ kind: 'silent' })
  })
})

describe('empty, emptied-by-filter and failed are three different answers', () => {
  it('a tab with nothing open is EMPTY, and still counts the other tab honestly', () => {
    const built = buildOpenLane({
      rows: [row({ entryNumber: 1, kind: 'SURPLUS', ageDays: 4, isMine: true })],
      failed: false,
      tab: 'owing',
      mineOnly: false,
    })
    expect(built.view).toEqual({ kind: 'empty' })
    expect(built.counts).toEqual({ owing: 0, owed: 1 })
  })

  it('a tab emptied by the MINE ONLY chip says so — it is never "nothing owing"', () => {
    const built = buildOpenLane({
      rows: [row({ entryNumber: 1, ageDays: 4, isMine: false })],
      failed: false,
      tab: 'owing',
      mineOnly: true,
    })
    expect(built.view).toEqual({ kind: 'filtered' })
    // 🚩 The count is the ESTATE's, not the filter's — the tab still says there is
    // one owing entry out there, which is what makes the emptiness legible.
    expect(built.counts.owing).toBe(1)
  })

  it('a failed door is FAILED, and its counts are unknown rather than zero', () => {
    const built = buildOpenLane({ rows: undefined, failed: true, tab: 'owing', mineOnly: false })
    expect(built.view).toEqual({ kind: 'failed' })
    // ⚠️ `null`, so the tabs can render an em-dash. A `0` here is the screen
    // fabricating a number, and it reads as "nothing needs you".
    expect(built.counts).toEqual({ owing: null, owed: null })
    expect(built.capReached).toBe(false)
  })

  it('a door that answered nothing at all is EMPTY, not failed', () => {
    const built = buildOpenLane({ rows: [], failed: false, tab: 'owing', mineOnly: false })
    expect(built.view).toEqual({ kind: 'empty' })
    expect(built.counts).toEqual({ owing: 0, owed: 0 })
  })

  it('the mine-only chip narrows to yours and keeps them in the server’s order', () => {
    const built = lane({ tab: 'owing', mineOnly: true })
    if (built.view.kind !== 'rows') throw new Error('expected rows')
    expect(built.view.sections.map((s) => s.which)).toEqual(['mine'])
    expect(numbers(built.view.sections[0].rows)).toEqual([20, 31])
  })
})

describe('the cap describes the ONE answer both tabs came out of', () => {
  it('fires when the whole answer reached the limit, not when a tab did', () => {
    const many = Array.from({ length: OPEN_LANE_LIMIT }, (_, i) =>
      row({ entryNumber: i + 1, ageDays: OPEN_LANE_LIMIT - i, kind: i % 2 ? 'SURPLUS' : 'SHORTAGE' }),
    )
    const built = buildOpenLane({ rows: many, failed: false, tab: 'owing', mineOnly: false })
    expect(built.capReached).toBe(true)
    // Each tab holds half the answer and neither of them reached 2,000 — a banner
    // measured per tab would never have fired.
    expect(built.counts.owing).toBe(OPEN_LANE_LIMIT / 2)
  })

  it('stays quiet under the limit', () => {
    expect(lane().capReached).toBe(false)
  })
})

describe('the tab is an address', () => {
  it('defaults to Owing, and an unreadable tab lands on it rather than on nothing', () => {
    expect(readOpenTab(new URLSearchParams(''))).toBe(DEFAULT_OPEN_TAB)
    expect(readOpenTab(new URLSearchParams('tab=owing'))).toBe('owing')
    expect(readOpenTab(new URLSearchParams('tab=owed'))).toBe('owed')
    expect(readOpenTab(new URLSearchParams('tab=OWED'))).toBe('owed')
    expect(readOpenTab(new URLSearchParams('tab='))).toBe(DEFAULT_OPEN_TAB)
    expect(readOpenTab(new URLSearchParams('tab=nonsense'))).toBe(DEFAULT_OPEN_TAB)
    // 286's tab — reserved on the wire, not yet a view. It must not resolve to Owing
    // silently once that slice lands, so it is read here as unknown today.
    expect(readOpenTab(new URLSearchParams('tab=cash'))).toBe(DEFAULT_OPEN_TAB)
  })

  it('keeps the scope, drops what led here, and spells the default as absence', () => {
    const from = new URLSearchParams('scope=all&store=0142&q=rawdah')
    expect(openTabSearch(from, 'owed')).toBe('/collection/settlement/open?scope=all&tab=owed')
    expect(openTabSearch(from, 'owing')).toBe('/collection/settlement/open?scope=all')
    expect(openTabSearch(new URLSearchParams(''), 'owing')).toBe('/collection/settlement/open')
  })
})
