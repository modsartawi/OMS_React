import { describe, expect, it } from 'vitest'
import type { SettlementOpenLaneRow, SettlementUncollectedRow } from '@/core/models/settlement'
import { CASH_LANE_LIMIT, OPEN_LANE_LIMIT } from './cap'
import { LANE_TODAY, SETTLEMENT_OPEN_LANE, SETTLEMENT_UNCOLLECTED } from './open-lane-fixture'
import {
  buildCashLane,
  buildOpenLane,
  DEFAULT_OPEN_TAB,
  openTabSearch,
  readOpenTab,
  tallyCashLane,
  tallyOpenLane,
} from './open-lane'

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

  it('still states the section’s own oldest when there is nothing of yours to compare against', () => {
    // 🔑 Story 18 asks the header to tell me its oldest entry — which is true whether
    // or not the reader is assigned a branch. Only the COMPARISON needs a section of
    // yours; an accountant assigned nothing must not read the estate's whole list
    // under a header that says nothing about it.
    expect(
      signpostOf([
        row({ entryNumber: 1, ageDays: 162, isMine: false }),
        row({ entryNumber: 2, ageDays: 40, isMine: false }),
      ]),
    ).toEqual({ kind: 'oldest', oldestAgeDays: 162 })
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

/**
 * **Ticket 288 — the front page's signpost.**
 *
 * 🔑 The assertions are about what a reader of the DOOR notices: how big each job is,
 * and what the screen says when it does not know. The load-bearing one is the last:
 * a failed read must yield the failure case rather than zeroes, because *"Owing 0"* on
 * the front page is the estate looking settled to somebody about to go home.
 */
describe('the signpost counts rows, and says nothing it cannot count', () => {
  it('counts each tab off the SAME answer the lane draws', () => {
    const tally = tallyOpenLane({ rows: SERVER_ORDER, failed: false })
    expect(tally.counts).toEqual({ owing: 4, owed: 2 })
    expect(tally.failed).toBe(false)
    // 🚩 The signpost and the tab strip are one function over one answer, so the front
    // page and the lane cannot disagree about the same estate.
    expect(tally.counts).toEqual(lane().counts)
  })

  it('counts ROWS, not branches — a branch with four shortages is four calls', () => {
    const fourOnOneBranch = [11, 12, 13, 14].map((entryNumber) =>
      row({ entryNumber, ageDays: 100, storeId: '0611' }),
    )
    expect(tallyOpenLane({ rows: fourOnOneBranch, failed: false }).counts.owing).toBe(4)
  })

  it('says nothing at all when the read FAILED — em-dashes, never zeroes', () => {
    const tally = tallyOpenLane({ rows: undefined, failed: true })
    expect(tally.failed).toBe(true)
    // ⚠️ `null` is *not known*; `0` would be this screen fabricating a number, and it
    // reads as "nothing needs you".
    expect(tally.counts).toEqual({ owing: null, owed: null })
    expect(tally.capReached).toBe(false)
  })

  it('distinguishes a door that answered NOTHING from one that failed', () => {
    const tally = tallyOpenLane({ rows: [], failed: false })
    expect(tally.failed).toBe(false)
    expect(tally.counts).toEqual({ owing: 0, owed: 0 })
  })

  it('says the count is a floor when the answer reached the cap', () => {
    const many = Array.from({ length: OPEN_LANE_LIMIT }, (_, i) => row({ entryNumber: i + 1 }))
    expect(tallyOpenLane({ rows: many, failed: false }).capReached).toBe(true)
    expect(tallyOpenLane({ rows: SERVER_ORDER, failed: false }).capReached).toBe(false)
  })

  it('links to each tab keeping the scope and dropping what led here', () => {
    const from = new URLSearchParams('scope=all&q=rawdah&store=0142')
    // 🚩 The builder the signpost's two links actually call — the SAME one the lane's
    // tab strip navigates with, so the front page cannot spell the default tab one way
    // and the lane another.
    expect(openTabSearch(from, 'owing')).toBe('/collection/settlement/open?scope=all')
    expect(openTabSearch(from, 'owed')).toBe('/collection/settlement/open?scope=all&tab=owed')
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
    // ✅ 286 built the third tab, so `?tab=cash` is now a view rather than an unknown
    // value falling back to Owing — the address an accountant pasted last week opens
    // the list it names.
    expect(readOpenTab(new URLSearchParams('tab=cash'))).toBe('cash')
    expect(readOpenTab(new URLSearchParams('tab=CASH'))).toBe('cash')
  })

  it('keeps the scope, drops what led here, and spells the default as absence', () => {
    const from = new URLSearchParams('scope=all&store=0142&q=rawdah')
    expect(openTabSearch(from, 'owed')).toBe('/collection/settlement/open?scope=all&tab=owed')
    expect(openTabSearch(from, 'owing')).toBe('/collection/settlement/open?scope=all')
    expect(openTabSearch(from, 'cash')).toBe('/collection/settlement/open?scope=all&tab=cash')
    expect(openTabSearch(new URLSearchParams(''), 'owing')).toBe('/collection/settlement/open')
  })
})

/* ══════════════════════════════════════════════════════════════════════════════
 * Ticket 286 — CASH WAITING: a prepared receipt nobody collected.
 *
 * 🔑 The tab reuses 285's arrangement with **three substitutions and nothing else**,
 * so what is worth asserting here is exactly those three and the one rule they create:
 * that a waiting receipt and an unpaid entry are two sentences about the same money
 * and **must both survive**.
 * ══════════════════════════════════════════════════════════════════════════════ */

/** One `Settlement/Uncollected` row. ⚠️ There is no `remainingAmount` to give it —
 *  that is the point of the second Proof bullet, and the type is what enforces it. */
function receipt(o: {
  entryNumber: number
  ageDays: number
  isMine?: boolean
  servedBy?: string
  storeId?: string
  amount?: number
  preparedAt?: string
}): SettlementUncollectedRow {
  return {
    settlementConsumptionId: `C${o.entryNumber}`,
    documentId: `SR-${o.entryNumber}`,
    storeId: o.storeId ?? '0142',
    storeName: 'Al-Rawdah Pharmacy',
    servedBy: o.servedBy ?? '',
    isMine: o.isMine ?? false,
    entryNumber: o.entryNumber,
    entryKind: 'SHORTAGE',
    amount: o.amount ?? 60,
    currencyKey: 'SAR',
    preparedAt: o.preparedAt ?? '2026-08-01T09:20:00',
    ageDays: o.ageDays,
  }
}

/** Which rows a view drew, flattened across its sections and in the drawn order. */
function drawn<Row>(view: { kind: string; sections?: { rows: Row[] }[] }): Row[] {
  return (view.sections ?? []).flatMap((s) => s.rows)
}

describe('lane: a waiting receipt reads its age from prepared, and carries no remaining', () => {
  it('states the receipt’s own age, counted from when it was prepared', () => {
    // 🔑 The fixture derives `preparedAt` FROM `ageDays`, the direction the server
    // subtracts in — so agreeing with the frozen `LANE_TODAY` is the same assertion an
    // accountant makes when they read the number and the date on one row (story 5).
    const midnight = (iso: string) => Date.parse(`${iso.slice(0, 10)}T00:00:00Z`)
    const today = Date.parse(`${LANE_TODAY}T00:00:00Z`)

    for (const r of SETTLEMENT_UNCOLLECTED) {
      expect(Math.round((today - midnight(r.preparedAt)) / 86_400_000)).toBe(r.ageDays)
    }

    // ⚠️ …and it is the RECEIPT's age, not the entry's. A tab that read `postedAt`
    // would answer *"how long has the branch owed this"* under a header that says
    // *prepared*, which is a different question with the same shape.
    const entries = new Map(SETTLEMENT_OPEN_LANE.map((e) => [e.entryNumber, e]))
    const differs = SETTLEMENT_UNCOLLECTED.filter(
      (r) => entries.get(r.entryNumber)?.ageDays !== r.ageDays,
    )
    expect(differs.length).toBeGreaterThan(SETTLEMENT_UNCOLLECTED.length / 2)
  })

  it('carries the receipt’s whole amount and no remaining figure at all', () => {
    const lane = buildCashLane({ rows: SETTLEMENT_UNCOLLECTED, failed: false, mineOnly: false })
    const rows = drawn(lane.view)
    expect(rows.length).toBe(SETTLEMENT_UNCOLLECTED.length)

    for (const r of rows) {
      expect(r.amount).toBeGreaterThan(0)
      // 🚩 A receipt is collected or it is not: there is no partial state, so there is
      // nothing for a *still open* figure to mean and no second number beside it. The
      // wire agrees, and this is the assertion that keeps it agreeing.
      expect('remainingAmount' in r).toBe(false)
    }
  })

  it('names the collector, or says nobody is assigned in words — never a blank claim', () => {
    const lane = buildCashLane({
      rows: [receipt({ entryNumber: 1, ageDays: 9, servedBy: 'Ayed', isMine: true }), receipt({ entryNumber: 2, ageDays: 3 })],
      failed: false,
      mineOnly: false,
    })
    // The projection hands the name through as it arrived — `''` is a real answer the
    // row renders as *nobody assigned*, and it is never turned into a placeholder here.
    expect(drawn(lane.view).map((r) => r.servedBy)).toEqual(['Ayed', ''])
  })

  it('sections, filters and states exactly as the entry tabs do', () => {
    const rows = [
      receipt({ entryNumber: 1, ageDays: 30, isMine: false }),
      receipt({ entryNumber: 2, ageDays: 12, isMine: true }),
      receipt({ entryNumber: 3, ageDays: 4, isMine: false }),
    ]
    const lane = buildCashLane({ rows, failed: false, mineOnly: false })
    expect(lane.view.kind).toBe('rows')
    if (lane.view.kind !== 'rows') throw new Error('unreachable')
    expect(lane.view.sections.map((s) => s.which)).toEqual(['mine', 'theirs'])
    // The server's order inside each section, untouched — 30 before 4.
    expect(lane.view.sections[1].rows.map((r) => r.entryNumber)).toEqual([1, 3])
    // …and the signpost claims the comparison because it IS true (30 > 12).
    expect(lane.view.sections[1].signpost).toEqual({
      kind: 'olderThanYours',
      oldestAgeDays: 30,
      yoursOldestAgeDays: 12,
    })

    // 🚩 **The three that must never collapse into each other**, on this tab too: a
    // shelf with nothing on it is good news, a list I narrowed myself is my own doing,
    // and a door that refused is neither.
    expect(buildCashLane({ rows: [], failed: false, mineOnly: false }).view.kind).toBe('empty')
    expect(buildCashLane({ rows, failed: false, mineOnly: true }).view.kind).toBe('rows')
    expect(
      buildCashLane({ rows: [rows[0]], failed: false, mineOnly: true }).view.kind,
    ).toBe('filtered')
    expect(buildCashLane({ rows: undefined, failed: true, mineOnly: false }).view.kind).toBe(
      'failed',
    )
  })

  it('a tab the wire did not rank IGNORES the chip rather than emptying under it', () => {
    // The chip is one piece of state across three tabs, but the receipts door always
    // sends `isMine` while the entry tabs wait on §6 for it. Pressed on Cash waiting
    // and carried to an unranked Owing, a filter that still applied would draw
    // *"nothing matches these filters"* with no chip on screen to clear.
    const unranked = [row({ entryNumber: 1, ageDays: 20 }), row({ entryNumber: 2, ageDays: 3 })]
    const lane = buildOpenLane({ rows: unranked, failed: false, tab: 'owing', mineOnly: true })

    expect(lane.ranked).toBe(false)
    expect(lane.view.kind).toBe('rows')
    expect(drawn(lane.view).map((r) => r.entryNumber)).toEqual([1, 2])
  })

  it('counts on its own terms — unknown when refused, and capped at 500 rather than 2,000', () => {
    // ⚠️ `null`, never `0`: *"Cash waiting 0"* off a refused door says every prepared
    // receipt has been collected, which is the one thing this tab may not say.
    expect(tallyCashLane({ rows: undefined, failed: true })).toEqual({
      count: null,
      capReached: false,
    })
    expect(tallyCashLane({ rows: SETTLEMENT_UNCOLLECTED, failed: false }).count).toBe(
      SETTLEMENT_UNCOLLECTED.length,
    )
    // 🔑 The rare-event cap, and the lane's population cap, are different numbers about
    // different questions — so the two banners can never be about the same answer.
    const many = Array.from({ length: CASH_LANE_LIMIT }, (_, i) =>
      receipt({ entryNumber: i + 1, ageDays: 1 }),
    )
    expect(tallyCashLane({ rows: many, failed: false }).capReached).toBe(true)
    expect(CASH_LANE_LIMIT).toBeLessThan(OPEN_LANE_LIMIT)
  })
})

describe('lane: the same entry may appear owing and waiting', () => {
  it('keeps both rows — two true sentences about one entry, and two phone calls', () => {
    // A partly-consumed entry: the branch still owes the remainder AND a receipt for
    // part of it is prepared and uncollected.
    const entry = row({ entryNumber: 1611, ageDays: 159, amount: 100, remaining: 40, isMine: true })
    const waiting = receipt({ entryNumber: 1611, ageDays: 6, amount: 60, isMine: true })

    const owing = buildOpenLane({ rows: [entry], failed: false, tab: 'owing', mineOnly: false })
    const cash = buildCashLane({ rows: [waiting], failed: false, mineOnly: false })

    expect(drawn(owing.view).map((r) => r.entryNumber)).toEqual([1611])
    expect(drawn(cash.view).map((r) => r.entryNumber)).toEqual([1611])
    // 🚩 …and they say **different** things about it: what is still open versus what is
    // waiting to be fetched, on two different clocks. Reconciling them into one row
    // would lose one of the two calls.
    expect(drawn(owing.view)[0].remainingAmount).toBe(40)
    expect(drawn(cash.view)[0].amount).toBe(60)
    expect(drawn(owing.view)[0].ageDays).not.toBe(drawn(cash.view)[0].ageDays)
  })

  it('does not deduplicate at estate scale either — every shared entry survives on both', () => {
    // The fixture mints each receipt against a real open entry, so the overlap is the
    // ordinary case rather than a contrived one.
    const openNumbers = new Set(SETTLEMENT_OPEN_LANE.map((e) => e.entryNumber))
    const shared = SETTLEMENT_UNCOLLECTED.filter((r) => openNumbers.has(r.entryNumber))
    expect(shared.length).toBe(SETTLEMENT_UNCOLLECTED.length)

    const cash = buildCashLane({ rows: SETTLEMENT_UNCOLLECTED, failed: false, mineOnly: false })
    expect(drawn(cash.view).length).toBe(SETTLEMENT_UNCOLLECTED.length)

    // …and the entry lane is untouched by any of it: the two doors never meet, and the
    // Owing count is still the estate's own.
    const owing = buildOpenLane({
      rows: SETTLEMENT_OPEN_LANE,
      failed: false,
      tab: 'owing',
      mineOnly: false,
    })
    expect(owing.counts.owing).toBe(
      SETTLEMENT_OPEN_LANE.filter((e) => e.entryKind === 'SHORTAGE').length,
    )
  })
})
