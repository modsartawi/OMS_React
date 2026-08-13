import type {
  SettlementAssignment,
  SettlementFleetRow,
  SettlementLedgerRow,
  SettlementOrphanRow,
  SettlementUncollectedRow,
  SettlementWorklistResult,
} from '@/core/models/settlement'
import { accountHeadline } from './account-projection'
import { SETTLEMENT_ACCOUNTS } from './settlement-fixture'

/**
 * **The estate** — ticket 270's fixture, and the one the drive serves over the
 * fleet, worklist and ledger doors.
 *
 * 🔑 **Its size is the whole point, and it is the real size.** 269's six hostile
 * branches prove the *account*; they cannot prove the *door*, because every claim
 * the door makes is about what happens when there are 1394 branches and 1255 of
 * them belong to nobody. The prototype's own fixture said 1000 and spec 267 §Further
 * Notes corrects it: **1394 branches, 1255 unassigned** (`.issues/267`), so those
 * are the denominators here.
 *
 * | population | count | why |
 * |---|---|---|
 * | branches | **1394** | the estate |
 * | unassigned | **1255** | the carve-out's constituency — 90% of the estate is on nobody's *mine* |
 * | mine | **24** | one accountant's own branches ∪ their one-level reports |
 * | somebody else's | **115** | reachable through *all* and through any search, never counted as mine |
 * | ageing entries, estate-wide | **140** | of which **47** are in scope — the prototype's own numbers |
 * | orphan consumptions | **4** | the four that were actually *wrong*, and sank into 131 ageing ones on the untriaged list |
 *
 * 🚩 **The six hostile branches keep their identity inside it** — their aggregate
 * rows are *computed from their own accounts* (`accountHeadline`), never retyped, so
 * the fleet and the account cannot disagree about a branch. And **0331, the orphan
 * branch, is deliberately `unassigned`**: it is the carve-out on screen rather than
 * only in a test. Under a naive *mine* scope its 150.000 would be on nobody's
 * screen.
 *
 * ⚠️ **Not one Arabic string is retyped here.** The six branches' names come from
 * `settlement-fixture.ts` by import; the 1388 generated branches are English-named
 * by construction. A retyped Arabic string looks right and is a different sequence
 * of code points (`csv.test.ts`'s ruling), and this file has no business minting new
 * ones.
 *
 * 🚩 **Generated deterministically** — a small LCG, seeded — because a drive that
 * asserts *"47 entries open longer than 30 days"* against `Math.random()` asserts
 * nothing, and a fixture that changed shape per run would make a failure
 * unreproducible.
 */

export const ESTATE_TOTAL = 1394
export const ESTATE_UNASSIGNED = 1255
export const ESTATE_MINE = 24
export const ESTATE_OTHER = ESTATE_TOTAL - ESTATE_UNASSIGNED - ESTATE_MINE

/** Entries open longer than the server's threshold: estate-wide, and in scope. */
export const AGEING_TOTAL = 140
export const AGEING_IN_SCOPE = 47
/** The server's own threshold, rendered but never computed here (the ticket's own
 *  boundary: no ageing rule is invented on this screen). */
export const AGEING_THRESHOLD_DAYS = 30

/** A 32-bit LCG (Numerical Recipes' constants). Deterministic, tiny, and good
 *  enough to scatter a fixture — it is not doing cryptography, it is making sure
 *  branch 0913 has the same balance on every run. */
function lcg(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 0x100000000
  }
}

const CITIES_SAR = [
  'Riyadh',
  'Jeddah',
  'Dammam',
  'Makkah',
  'Madinah',
  'Khobar',
  'Abha',
  'Tabuk',
  'Buraydah',
  'Hail',
]
/** Bahrain — the footprint's 3-decimal half (D10). A branch in one of these draws
 *  its fils, and the door has to render two precisions on one screen. */
const CITIES_BHD = ['Manama', 'Muharraq', 'Riffa']

const NAMES = [
  'Al-Andalus',
  'Al-Faisaliyah',
  'Al-Hamra',
  'Al-Malaz',
  'Al-Muruj',
  'Al-Olaya',
  'Al-Rabwah',
  'Al-Safa',
  'Al-Shifa',
  'Al-Yasmin',
  'Gharnatah',
  'Ishbiliyah',
  'Nadd Al-Hamar',
  'Qurtubah North',
  'Rawabi',
  'Sultanah',
  'Takhassusi',
  'Wadi Laban',
]

/** The six, and what the estate says about each — city, who owns it, how many of
 *  its entries are ageing. Everything else on their rows is read off their own
 *  accounts, so a change there moves both. */
const HOSTILE: Record<string, { city: string; assignment: SettlementAssignment; ageing: number }> = {
  // Mine, and the branch a reader lands on first.
  '0142': { city: 'Riyadh', assignment: 'mine', ageing: 1 },
  '0207': { city: 'Riyadh', assignment: 'mine', ageing: 0 },
  // 🔑 The orphan branch is UNASSIGNED, on purpose. See the docblock.
  '0331': { city: 'Jeddah', assignment: 'unassigned', ageing: 4 },
  // Somebody else's — and it is where the cash is waiting.
  '0455': { city: 'Dammam', assignment: 'other', ageing: 3 },
  '0512': { city: 'Riyadh', assignment: 'mine', ageing: 0 },
  '0688': { city: 'Muharraq', assignment: 'unassigned', ageing: 2 },
}

/** Spread a total across n branches without ever inventing a fraction: add one at
 *  a time to a pseudo-random branch, `target` times. The sum is exact by
 *  construction, which is what lets the drive assert 47 rather than *about* 47. */
function spread(target: number, count: number, rand: () => number): number[] {
  const out = new Array<number>(count).fill(0)
  if (count <= 0) return out
  for (let i = 0; i < target; i++) out[Math.floor(rand() * count)]++
  return out
}

function buildEstate(): {
  fleet: SettlementFleetRow[]
  ledger: SettlementLedgerRow[]
  orphans: SettlementOrphanRow[]
  uncollected: SettlementUncollectedRow[]
} {
  const rand = lcg(0x267270)
  const fleet: SettlementFleetRow[] = []
  const ledger: SettlementLedgerRow[] = []

  // ── The six, aggregated from their own accounts ───────────────────────────
  for (const [storeId, meta] of Object.entries(HOSTILE)) {
    const account = SETTLEMENT_ACCOUNTS[storeId]
    const headline = accountHeadline(account.entries)
    fleet.push({
      storeId,
      storeName: account.storeName,
      city: meta.city,
      assignment: meta.assignment,
      currencyKey: account.currencyKey,
      openCount: headline.openCount,
      shortageTotal: headline.shortageTotal,
      surplusTotal: headline.surplusTotal,
      signedPosition: headline.signedPosition,
      movedSinceCutoff: account.consumptions.length,
      hasOrphan: storeId === '0331',
      hasUncollectedReceipt: storeId === '0455',
      ageingCount: meta.ageing,
    })
    for (const entry of account.entries)
      ledger.push({ ...entry, storeName: account.storeName, currencyKey: account.currencyKey })
  }

  // ── …and the 1388 that make it an estate ──────────────────────────────────
  const generated: SettlementFleetRow[] = []
  const taken = new Set(Object.keys(HOSTILE))
  const quota: Record<SettlementAssignment, number> = {
    mine: ESTATE_MINE - Object.values(HOSTILE).filter((h) => h.assignment === 'mine').length,
    unassigned:
      ESTATE_UNASSIGNED - Object.values(HOSTILE).filter((h) => h.assignment === 'unassigned').length,
    other: ESTATE_OTHER - Object.values(HOSTILE).filter((h) => h.assignment === 'other').length,
  }
  const roster: SettlementAssignment[] = [
    ...Array<SettlementAssignment>(quota.mine).fill('mine'),
    ...Array<SettlementAssignment>(quota.other).fill('other'),
    ...Array<SettlementAssignment>(quota.unassigned).fill('unassigned'),
  ]

  let code = 100
  for (const assignment of roster) {
    while (taken.has(String(code).padStart(4, '0'))) code++
    const storeId = String(code).padStart(4, '0')
    taken.add(storeId)
    code++

    const bahrain = rand() < 0.04
    const city = bahrain
      ? CITIES_BHD[Math.floor(rand() * CITIES_BHD.length)]
      : CITIES_SAR[Math.floor(rand() * CITIES_SAR.length)]
    // A branch that owes nothing is the ORDINARY case — roughly two in three carry
    // no open entry at all. A fixture where every branch had money would make the
    // worklist look like the estate, which is the failure this screen is built
    // against.
    //
    // ⚠️ An ASSIGNED branch is denser, and not arbitrarily: an ageing entry is an
    // *open* entry, so the 47 in scope have to fit inside the open entries of two
    // dozen branches. It is also the truer picture — finance assigns an accountant
    // to the branches that have work on them, not to a random 24 of 1394.
    const openCount =
      assignment === 'mine'
        ? 2 + Math.floor(rand() * 4)
        : rand() < 0.34
          ? 1 + Math.floor(rand() * 3)
          : 0
    generated.push({
      storeId,
      storeName: `${NAMES[Math.floor(rand() * NAMES.length)]} Pharmacy`,
      city,
      assignment,
      currencyKey: bahrain ? 'BHD' : 'SAR',
      openCount,
      shortageTotal: 0,
      surplusTotal: 0,
      signedPosition: 0,
      movedSinceCutoff: 0,
      hasOrphan: false,
      hasUncollectedReceipt: false,
      ageingCount: 0,
    })
  }

  // Ageing, spread to hit the two totals EXACTLY — 47 in scope, 140 estate-wide.
  const hostileAgeing = (assignment: SettlementAssignment) =>
    Object.values(HOSTILE)
      .filter((h) => h.assignment === assignment)
      .reduce((sum, h) => sum + h.ageing, 0)
  const withOpen = (assignment: SettlementAssignment) =>
    generated.filter((r) => r.assignment === assignment && r.openCount > 0)

  const mineOpen = withOpen('mine')
  const otherOpen = withOpen('other')
  const unassignedOpen = withOpen('unassigned')
  const outOfScope = AGEING_TOTAL - AGEING_IN_SCOPE - hostileAgeing('other') - hostileAgeing('unassigned')
  const shares: [SettlementFleetRow[], number][] = [
    [mineOpen, AGEING_IN_SCOPE - hostileAgeing('mine')],
    [otherOpen, Math.floor(outOfScope * 0.2)],
    [unassignedOpen, outOfScope - Math.floor(outOfScope * 0.2)],
  ]
  for (const [rows, target] of shares) {
    const counts = spread(target, rows.length, rand)
    rows.forEach((row, i) => {
      row.ageingCount = Math.min(counts[i], row.openCount)
    })
    // The `min` above can lose a few to branches with fewer open entries than the
    // spread handed them; hand the remainder to the branches that can hold it, so
    // the totals stay exact.
    let short = target - rows.reduce((sum, r) => sum + r.ageingCount, 0)
    for (const row of rows) {
      if (short <= 0) break
      const room = row.openCount - row.ageingCount
      const take = Math.min(room, short)
      row.ageingCount += take
      short -= take
    }
  }

  // Money and entries for every generated branch that has an open one, so the
  // ledger is estate-scale rather than a list of six.
  let entryNumber = 1000
  for (const row of generated) {
    for (let i = 0; i < row.openCount; i++) {
      const kind = rand() < 0.62 ? 'SHORTAGE' : 'SURPLUS'
      const amount = Math.round((25 + rand() * 1800) * 100) / 100
      entryNumber++
      ledger.push({
        settlementEntryId: `01J9GEN${row.storeId}${i}`,
        entryNumber,
        storeId: row.storeId,
        entryKind: kind,
        amount,
        remainingAmount: amount,
        reason: `Monthly audit difference ${row.storeId}`,
        status: 'OPEN',
        batchId: '',
        postedByStaffId: '30117',
        postedByName: SETTLEMENT_ACCOUNTS['0142'].entries[0].postedByName,
        postedAt: `2026-0${1 + Math.floor(rand() * 7)}-1${Math.floor(rand() * 9)}T09:30:00`,
        closedByStaffId: '',
        closedAt: '',
        closedReason: '',
        storeName: row.storeName,
        currencyKey: row.currencyKey,
      })
      if (kind === 'SHORTAGE') row.shortageTotal += amount
      else row.surplusTotal += amount
    }
    row.shortageTotal = Math.round(row.shortageTotal * 1000) / 1000
    row.surplusTotal = Math.round(row.surplusTotal * 1000) / 1000
    row.signedPosition = Math.round((row.shortageTotal - row.surplusTotal) * 1000) / 1000
  }

  fleet.push(...generated)

  // ── The two enumerated lanes ──────────────────────────────────────────────
  //
  // 🔑 FOUR orphans, at four branches, of which the first is 0331's own — the same
  // consumption the account renders in words (269's rule 1), now with a Repair
  // button beside it. Two of the four are at branches nobody is assigned to, which
  // is the carve-out's whole argument in two rows.
  const orphanBranches = [
    fleet.find((r) => r.storeId === '0331')!,
    generated.find((r) => r.assignment === 'unassigned' && r.openCount > 0)!,
    generated.find((r) => r.assignment === 'mine' && r.openCount > 0)!,
    generated.find((r) => r.assignment === 'other' && r.openCount > 0)!,
  ]
  const orphanSource = SETTLEMENT_ACCOUNTS['0331'].consumptions[0]
  const orphans: SettlementOrphanRow[] = orphanBranches.map((row, i) => ({
    settlementConsumptionId:
      i === 0 ? orphanSource.settlementConsumptionId : `01J9GENORPH${row.storeId}`,
    settlementEntryId: i === 0 ? orphanSource.settlementEntryId : `01J9GEN${row.storeId}0`,
    entryNumber: i === 0 ? SETTLEMENT_ACCOUNTS['0331'].entries[0].entryNumber : 1000 + i,
    storeId: row.storeId,
    storeName: row.storeName,
    currencyKey: row.currencyKey,
    amount: i === 0 ? orphanSource.amount : Math.round((300 + i * 1400) * 100) / 100,
    ageDays: [4, 11, 2, 26][i],
    consumedAt: i === 0 ? orphanSource.consumedAt : `2026-07-2${i}T22:${40 + i}:00`,
  }))

  // Cash waiting: 0455's own last receipt — the branch prepared it, no collector
  // came. They never expire and are never auto-voided, so AGE is all this lane owes.
  const uncollectedBranches = [
    fleet.find((r) => r.storeId === '0455')!,
    generated.find((r) => r.assignment === 'unassigned' && r.openCount > 1)!,
    generated.filter((r) => r.assignment === 'mine' && r.openCount > 0)[1]!,
  ]
  const uncollected: SettlementUncollectedRow[] = uncollectedBranches.map((row, i) => ({
    documentId: i === 0 ? 'SR04550013' : `SR${row.storeId}0007`,
    documentNumber: i === 0 ? 'SR-0455-0013' : `SR-${row.storeId}-0007`,
    storeId: row.storeId,
    storeName: row.storeName,
    currencyKey: row.currencyKey,
    amount: i === 0 ? 200 : Math.round((150 + i * 940) * 100) / 100,
    ageDays: [3, 19, 8][i],
    preparedAt: `2026-08-0${2 + i}T18:${10 + i}:00`,
  }))

  return { fleet, ledger, orphans, uncollected }
}

const ESTATE = buildEstate()

/** `GET Settlement/Fleet?scope=all` — 1394 aggregated rows, the six among them. */
export const SETTLEMENT_FLEET: SettlementFleetRow[] = ESTATE.fleet

/** `GET Settlement/Worklist` — the two enumerated lanes, estate-wide by construction. */
export const SETTLEMENT_WORKLIST: SettlementWorklistResult = {
  orphans: ESTATE.orphans,
  uncollected: ESTATE.uncollected,
  ageingThresholdDays: AGEING_THRESHOLD_DAYS,
}

/** `GET Settlement/Ledger` — every entry in the estate, flat. The door filters it. */
export const SETTLEMENT_LEDGER: SettlementLedgerRow[] = ESTATE.ledger
