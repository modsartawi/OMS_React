import { describe, expect, it } from 'vitest'
import type {
  SettlementChase,
  SettlementLastChase,
  SettlementOpenLaneRow,
  SettlementUncollectedRow,
} from '@/core/models/settlement'
import { CASH_LANE_LIMIT, OPEN_LANE_LIMIT } from './cap'
import { LANE_TODAY, SETTLEMENT_OPEN_LANE, SETTLEMENT_UNCOLLECTED } from './open-lane-fixture'
import {
  applyChase,
  buildCashLane,
  buildOpenLane,
  chaseCell,
  chaseTargetForEntry,
  chaseTargetForReceipt,
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
  /** ⚠️ Three cases, and `undefined` is one of them — omitting the key is the wire
   *  **not carrying the field**, which is a different answer from `null`. */
  lastChase?: SettlementLastChase | null
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
    ...('lastChase' in o ? { lastChase: o.lastChase } : {}),
  }
}

/** A note the server wrote, with the server's own stamp and name on it. */
function chased(note: string, entryNumber = 0): SettlementLastChase {
  return { note, chasedByName: 'Ayed Al-Qahtani', chasedAt: '2026-08-13T10:04:00', entryNumber }
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
  lastChase?: SettlementLastChase | null
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
    ...('lastChase' in o ? { lastChase: o.lastChase } : {}),
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

/* ── ticket 287: the chase note's tri-state ───────────────────────────────────── */

describe('lane: an absent chase field is not a claim that nobody was chased', () => {
  it('answers three different cases for the three things the wire can say', () => {
    // 🚩 The whole ticket, in one assertion. `undefined` is *the door is not built*,
    // `null` is *the door answered and nobody has rung this branch*, and an object is
    // the note. Collapsing the first two would state, confidently, that nobody has
    // chased any of 1,394 branches.
    expect(chaseCell({})).toEqual({ kind: 'unavailable' })
    expect(chaseCell({ lastChase: null })).toEqual({ kind: 'never' })
    expect(chaseCell({ lastChase: chased('promised Sunday', 143) })).toEqual({
      kind: 'chased',
      at: '2026-08-13T10:04:00',
      by: 'Ayed Al-Qahtani',
      note: 'promised Sunday',
    })
  })

  it('hides the column outright when the answer never mentioned a chase', () => {
    // 285's and 286's own rows, untouched: §7 is a dependency of its own and both
    // doors answer without it today.
    expect(lane().chased).toBe(false)
    expect(
      buildCashLane({
        rows: [receipt({ entryNumber: 9, ageDays: 2 })],
        failed: false,
        mineOnly: false,
      }).chased,
    ).toBe(false)
  })

  it('draws the column as soon as the answer mentions one — even if nobody has been chased', () => {
    // ⚠️ A door that answers `null` for every branch has still ANSWERED. The column is
    // drawn and says *never chased*, which is a true statement about those branches;
    // drawing nothing would lose a fact the server took the trouble to send.
    const answered = [
      row({ entryNumber: 11, ageDays: 162, isMine: false, lastChase: null }),
      row({ entryNumber: 20, ageDays: 140, isMine: true, lastChase: null }),
    ]
    const built = buildOpenLane({ rows: answered, failed: false, tab: 'owing', mineOnly: false })

    expect(built.chased).toBe(true)
    expect(drawn(built.view).map((r) => chaseCell(r).kind)).toEqual(['never', 'never'])
  })

  it('carries the note through to the row that shows it, with the server’s name and stamp', () => {
    const built = buildOpenLane({
      rows: [
        row({
          entryNumber: 11,
          ageDays: 162,
          isMine: true,
          lastChase: chased('promised Sunday', 11),
        }),
        row({ entryNumber: 20, ageDays: 140, isMine: true, lastChase: null }),
      ],
      failed: false,
      tab: 'owing',
      mineOnly: false,
    })

    expect(drawn(built.view).map((r) => chaseCell(r).kind)).toEqual(['chased', 'never'])
  })

  it('reads both answered cases off the estate, with one note per BRANCH', () => {
    // 🔑 At estate scale, because the claim is about branches rather than rows: a note
    // belongs to a branch, so a branch with four open entries shows the same sentence
    // four times and never *never chased* on three of them.
    const cells = SETTLEMENT_OPEN_LANE.map((r) => chaseCell(r).kind)
    expect(cells).toContain('never')
    expect(cells).toContain('chased')
    expect(cells).not.toContain('unavailable')

    for (const branch of new Set(SETTLEMENT_OPEN_LANE.map((r) => r.storeId))) {
      const notes = new Set(
        SETTLEMENT_OPEN_LANE.filter((r) => r.storeId === branch).map((r) =>
          JSON.stringify(r.lastChase),
        ),
      )
      expect(notes.size).toBe(1)
    }

    // …and the receipts door tells the same story about the same branch: one table,
    // one act, whichever tab is asking.
    for (const receiptRow of SETTLEMENT_UNCOLLECTED) {
      const entryRow = SETTLEMENT_OPEN_LANE.find((r) => r.storeId === receiptRow.storeId)!
      expect(receiptRow.lastChase).toEqual(entryRow.lastChase)
    }
  })

  it('says nothing about chases on a failed read — there is no answer to read a case out of', () => {
    // The refusal is answered first, as it is for every other flag on this lane: a
    // door that did not answer did not answer about chases either.
    expect(buildOpenLane({ rows: undefined, failed: true, tab: 'owing', mineOnly: false }).chased)
      .toBe(false)
    expect(buildCashLane({ rows: undefined, failed: true, mineOnly: false }).chased).toBe(false)
  })
})

describe('lane: the never-chased filter is offered only when the answer knows', () => {
  const answered = [
    row({ entryNumber: 11, ageDays: 162, isMine: false, lastChase: null }),
    row({ entryNumber: 12, ageDays: 159, isMine: true, lastChase: chased('rang, no answer') }),
    row({ entryNumber: 20, ageDays: 140, isMine: true, lastChase: null }),
  ]

  it('narrows to the branches nobody has spoken to, in the server’s order', () => {
    const built = buildOpenLane({
      rows: answered,
      failed: false,
      tab: 'owing',
      mineOnly: false,
      neverChasedOnly: true,
    })

    // Yours first, then the estate's — the arrangement is untouched by the filter,
    // which narrows the sections rather than replacing them.
    expect(drawn(built.view).map((r) => r.entryNumber)).toEqual([20, 11])
    // 🚩 …while the TAB still counts the estate. A filter narrows what is drawn, never
    // what is claimed to exist.
    expect(built.counts.owing).toBe(3)
  })

  it('is IGNORED by a tab whose answer never mentioned a chase, rather than emptying it', () => {
    // ⚠️ The chip is one piece of state across three tabs while *whether it can be
    // offered* is a per-tab fact — the same defect `/code-review` found on *Mine only*
    // in 286. A reader pressing it on a chase-aware tab and switching to one the door
    // answered without would otherwise read *"nothing matches these filters"* with no
    // chip on screen to clear.
    const built = buildOpenLane({
      rows: SERVER_ORDER,
      failed: false,
      tab: 'owing',
      mineOnly: false,
      neverChasedOnly: true,
    })

    expect(built.chased).toBe(false)
    // Every SHORTAGE of the answer, arranged as ever — yours (20, 31) above the
    // estate's (11, 21) — and not one row dropped by a filter over a fact nobody sent.
    expect(drawn(built.view).map((r) => r.entryNumber)).toEqual([20, 31, 11, 21])
  })

  it('empties by MY OWN filter rather than by the estate having nothing owing', () => {
    const built = buildOpenLane({
      rows: [row({ entryNumber: 12, ageDays: 159, isMine: true, lastChase: chased('rang') })],
      failed: false,
      tab: 'owing',
      mineOnly: false,
      neverChasedOnly: true,
    })

    expect(built.view.kind).toBe('filtered')
  })

  it('applies on the cash tab too — same table, same act, a different person on the phone', () => {
    const built = buildCashLane({
      rows: [
        receipt({ entryNumber: 900, ageDays: 12, isMine: true, lastChase: null }),
        receipt({
          entryNumber: 901,
          ageDays: 6,
          isMine: true,
          lastChase: chased('collector passes Wednesday'),
        }),
      ],
      failed: false,
      mineOnly: false,
      neverChasedOnly: true,
    })

    expect(built.chased).toBe(true)
    expect(drawn(built.view).map((r) => r.entryNumber)).toEqual([900])
  })

  it('composes with “mine only” — two narrowings of one list, not two lists', () => {
    const built = buildOpenLane({
      rows: answered,
      failed: false,
      tab: 'owing',
      mineOnly: true,
      neverChasedOnly: true,
    })

    expect(drawn(built.view).map((r) => r.entryNumber)).toEqual([20])
  })
})

describe('lane: a chase names the branch it belongs to, and what the call was about', () => {
  it('names the ENTRY from an entry row and the RECEIPT from a waiting one', () => {
    // 🔑 A note belongs to the BRANCH either way — `storeId` rides on both — and the
    // subject only says what the call happened to be about.
    expect(
      chaseTargetForEntry(row({ entryNumber: 1611, ageDays: 159, storeId: '0611', servedBy: 'Ayed' })),
    ).toMatchObject({
      storeId: '0611',
      subject: 'ENTRY',
      subjectId: 'E1611',
      entryNumber: 1611,
      servedBy: 'Ayed',
    })

    expect(chaseTargetForReceipt(receipt({ entryNumber: 1611, ageDays: 6, storeId: '0611' }))).toMatchObject({
      storeId: '0611',
      subject: 'RECEIPT',
      // ⚠️ The special-receipt document head office has no row for — carried as a
      // LABEL and never joined (contract 278 §1).
      subjectId: 'SR-1611',
      entryNumber: 1611,
    })
  })

  it('carries the newest note along, so the dialog shows what was last said before dialling', () => {
    expect(
      chaseTargetForEntry(
        row({ entryNumber: 1611, ageDays: 159, lastChase: chased('promised Sunday', 1611) }),
      ).last,
    ).toEqual({
      kind: 'chased',
      at: '2026-08-13T10:04:00',
      by: 'Ayed Al-Qahtani',
      note: 'promised Sunday',
    })
  })
})

describe('lane: a note the server accepted lands on every row of that branch', () => {
  const written: SettlementChase = {
    chaseId: '01J9CHASE',
    storeId: '0611',
    subject: 'ENTRY',
    subjectId: 'E11',
    chasedByStaffId: '30117',
    ...chased('promised Sunday', 11),
  }

  it('rewrites the branch’s rows from the SERVER’s chase, and leaves other branches alone', () => {
    // 🔑 One phone call about four open entries is ONE note — so the row the
    // accountant chased from is not the only one that changes.
    const rows = [
      row({ entryNumber: 11, ageDays: 162, storeId: '0611', lastChase: null }),
      row({ entryNumber: 12, ageDays: 159, storeId: '0611', lastChase: null }),
      row({ entryNumber: 13, ageDays: 140, storeId: '0142', lastChase: null }),
    ]

    const after = applyChase(rows, written)
    expect(after.map((r) => chaseCell(r).kind)).toEqual(['chased', 'chased', 'never'])
    // ⚠️ **The SERVER's stamp and the SERVER's name**, never the text that was typed
    // or a clock the browser owns.
    expect(after[0].lastChase).toEqual(chased('promised Sunday', 11))
  })

  it('leaves an answer that never carried the field exactly as it was', () => {
    // ⚠️ Writing a note onto rows the door said nothing about would MINT the column —
    // the screen would start drawing *never chased* for 1,393 other branches off the
    // back of one accepted write.
    const rows = [row({ entryNumber: 11, ageDays: 162, storeId: '0611' })]

    expect(applyChase(rows, written)).toBe(rows)
    expect(applyChase(rows, written)[0].lastChase).toBeUndefined()
  })
})

