import type { SettlementOpenLaneRow } from '@/core/models/settlement'
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
