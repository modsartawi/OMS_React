import type { SettlementOpenLaneRow, SettlementUncollectedRow } from '@/core/models/settlement'
import { SETTLEMENT_BRANCHES } from './fleet-fixture'

/**
 * **The estate's open position** — ticket 285's fixture, and what the drive serves
 * over `Settlement/Ledger?status=OPEN&sort=age`.
 *
 * 🔑 **Its size is the whole point, and it is the estate's own.** The lane's every
 * claim is about what happens when there are ~1,400 open entries and 1,255 of the
 * branches behind them belong to nobody: that ranking yours first pushes the estate's
 * oldest entry below the fold, that the signpost is the only thing that says so, and
 * that *mine only* narrows a list rather than being the list. Six hostile branches
 * cannot prove any of it. The branches come from `fleet-fixture.ts` — the module the
 * vitest suites already pin — so the lane, the fleet, the picker and the six accounts
 * cannot disagree about who serves a branch.
 *
 * 🚩 **It plays the SERVER, which is why it emits the three fields §6 has not built
 * yet.** `servedBy`, `isMine` and `ageDays` are optional on the wire and absent from
 * the live door today (`SettlementOpenLaneRow`); a fixture that also omitted them
 * could only ever drive the degraded rendering, and the arrangement this ticket is
 * about would be unproven. The drive turns them off explicitly to reach that path
 * (`sort=age` with §6 simulated absent), which is the honest way round.
 *
 * ⚠️ **`postedAt` is derived FROM `ageDays`, never the other way round** — the same
 * direction the door subtracts in, so the number and the date on a row can never tell
 * an accountant two different stories (spec 282 story 5). `LANE_TODAY` is frozen for
 * the same reason the estate's generator is seeded: a drive asserting *"the oldest is
 * 162 days"* against a real clock asserts nothing, and its failures would not
 * reproduce.
 *
 * 🚩 Not one Arabic string is minted here. Every branch name arrives by import.
 */

/**
 * The day this fixture's server believes it is.
 *
 * ⚠️ **A fixture constant and never a client rule.** Nothing in `src/features/**`
 * outside this file may read it: the whole design of the lane is that the browser
 * owns no clock, and a screen that reached for this would be re-creating exactly the
 * defect spec 282 D5 moved to the server.
 */
export const LANE_TODAY = '2026-08-15'

/** Deterministic scatter — `fleet-fixture.ts`'s own LCG, seeded differently so the
 *  two fixtures do not correlate branch-for-branch. */
function lcg(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 0x100000000
  }
}

/** Bahrain — the footprint's 3-decimal half. A lane spanning both currencies is what
 *  makes *no column is totalled* a rule with teeth rather than a note. */
const CITIES_BHD = new Set(['Manama', 'Muharraq', 'Riffa'])

/** `LANE_TODAY` minus n days, as the local wall clock every timestamp on this
 *  contract wears. Built by arithmetic on a UTC midnight so a runner's own timezone
 *  cannot shift a row's date by one and break the age/date agreement. */
function postedDaysAgo(ageDays: number, hour: number, minute: number): string {
  const day = new Date(`${LANE_TODAY}T00:00:00Z`)
  day.setUTCDate(day.getUTCDate() - ageDays)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${day.toISOString().slice(0, 10)}T${pad(hour)}:${pad(minute)}:00`
}

function buildOpenLane(): SettlementOpenLaneRow[] {
  const rand = lcg(0x282285)
  const rows: SettlementOpenLaneRow[] = []
  let entryNumber = 1000

  for (const branch of SETTLEMENT_BRANCHES) {
    // 🚩 Skewed hard towards the recent (`^2.2`), because a real estate's open
    // position is mostly this month's — which is what makes the handful of 150-day
    // rows at the top of the list the work, and what an evenly-spread fixture would
    // hide by making every row look equally old.
    const ageDays = Math.floor(Math.pow(rand(), 2.2) * 163)
    const amount = Math.round((5 + rand() * 4000) * 1000) / 1000
    // A third of branches have paid something — the fact that tells a branch that is
    // engaging from one that is ignoring you, and the reason `of X` exists at all.
    const paid = rand() < 0.35 ? Math.round(amount * rand() * 1000) / 1000 : 0
    const kind = rand() < 0.72 ? 'SHORTAGE' : 'SURPLUS'

    rows.push({
      settlementEntryId: `01J9OPEN${branch.storeId}${++entryNumber}`,
      entryNumber,
      storeId: branch.storeId,
      storeName: branch.storeName,
      entryKind: kind,
      amount,
      remainingAmount: Math.round((amount - paid) * 1000) / 1000,
      reason: `Settlement difference ${branch.storeId}`,
      status: 'OPEN',
      batchId: '',
      postedByStaffId: '30117',
      postedByName: 'هدى القحطاني / Huda Al-Qahtani',
      postedAt: postedDaysAgo(ageDays, 9 + Math.floor(rand() * 9), Math.floor(rand() * 60)),
      closedByStaffId: '',
      closedAt: '',
      closedReason: '',
      currencyKey: CITIES_BHD.has(branch.city) ? 'BHD' : 'SAR',
      // ⚠️ **Blank for the 1,255 branches paired to nobody**, never a placeholder
      // name — the row must be able to say *nobody assigned* in words.
      servedBy: branch.servedBy,
      isMine: branch.isMine,
      ageDays,
    })
  }

  // 🔑 **The door's order, and the drive's whole subject: oldest first, tie-broken by
  // entry number so the order is TOTAL.** Two entries posted the same day are common
  // at estate scale, and a comparator that left them unordered would let a refetch
  // reshuffle the page under the reader's cursor — and, because the answer is capped,
  // change which rows survived the cap.
  return rows.sort((a, b) => b.ageDays! - a.ageDays! || a.entryNumber - b.entryNumber)
}

/** `GET Settlement/Ledger?status=OPEN&sort=age` — the estate's open entries, in the
 *  server's order. */
export const SETTLEMENT_OPEN_LANE: SettlementOpenLaneRow[] = buildOpenLane()

/* ── cash waiting: the receipts nobody collected (ticket 286) ─────────────────── */

/**
 * **The estate's uncollected special receipts** — what the drive serves over
 * `Settlement/Uncollected`.
 *
 * 🚩 **37 of them against 1,394 open entries, and the ratio is the claim.** A prepared
 * receipt nobody has fetched is a **rare event** — a collector's round that did not
 * happen — which is why its cap is 500 and not the lane's 2,000 (`cap.ts`). A fixture
 * that made it a population would quietly justify the wrong cap.
 *
 * 🔑 **Every receipt is minted against a REAL open entry from the lane above**, which
 * is how the ticket's second claim becomes drivable rather than asserted: a
 * partly-consumed entry appears on **Owing and here at once**, and nothing may
 * deduplicate them. Two true sentences about the same money — *"the branch still owes
 * 40"* and *"a receipt for 60 is prepared and nobody has been to fetch it"* — going to
 * two different people.
 *
 * ⚠️ **The ages are the RECEIPT's, counted from `preparedAt`, and they are short.** A
 * receipt waits days or weeks; an unpaid shortage waits months. Deriving these from
 * the entry's own age would have made the third tab a copy of the first with a
 * different header, and the substitution this ticket exists for would be unproven.
 *
 * ⚠️ `servedBy` is the door's own field and reads as the **collector** here. The
 * fixture has no second roster to draw one from — the estate's assignment is the only
 * one that exists — so it carries the branch's, blank included. What it proves is the
 * rendering (a name, or *nobody assigned* in words), not the identity behind it.
 */
function buildUncollected(): SettlementUncollectedRow[] {
  const rand = lcg(0x282286)
  const rows: SettlementUncollectedRow[] = []

  // Spread across the lane rather than taken off its head: the oldest ENTRIES are not
  // the ones whose receipts are oldest, and a fixture that sampled the top would have
  // the two tabs agreeing about their order by accident.
  for (let i = 0; i < SETTLEMENT_OPEN_LANE.length && rows.length < 37; i += 37) {
    const entry = SETTLEMENT_OPEN_LANE[i]
    // 🚩 Skewed short (`^1.6` over 40 days), because that is what a waiting receipt
    // is: a visit that did not happen recently, not a debt nobody has chased since
    // March.
    const ageDays = Math.floor(Math.pow(rand(), 1.6) * 40)
    rows.push({
      settlementConsumptionId: `01J9CASH${entry.storeId}${entry.entryNumber}`,
      // Present — and being present is what tells a prepared receipt from an orphan,
      // whose `documentId` is blank by definition.
      documentId: `SR-${entry.entryNumber}`,
      storeId: entry.storeId,
      storeName: entry.storeName,
      servedBy: entry.servedBy ?? '',
      isMine: entry.isMine ?? false,
      // 🔑 The same handle the other two tabs quote — joined off the entry, exactly as
      // the door does it.
      entryNumber: entry.entryNumber,
      entryKind: entry.entryKind,
      // ⚠️ The receipt's WHOLE amount and never the entry's remaining: a receipt is
      // collected or it is not.
      amount: Math.round((20 + rand() * 900) * 1000) / 1000,
      currencyKey: entry.currencyKey,
      preparedAt: postedDaysAgo(ageDays, 8 + Math.floor(rand() * 10), Math.floor(rand() * 60)),
      ageDays,
    })
  }

  // The door's order, and the same total one the lane uses: oldest first, tie-broken
  // by entry number so a refetch cannot reshuffle the page under the reader.
  return rows.sort((a, b) => b.ageDays - a.ageDays || a.entryNumber - b.entryNumber)
}

/** `GET Settlement/Uncollected` — the estate's waiting receipts, in the server's
 *  order. */
export const SETTLEMENT_UNCOLLECTED: SettlementUncollectedRow[] = buildUncollected()
