import type { SettlementFleetRow, SettlementOrphanRow } from '@/core/models/settlement'
import { accountHeadline } from './account-projection'
import { SETTLEMENT_ACCOUNTS } from './settlement-fixture'

/**
 * **The estate** — ticket 270's fixture, and the one the drive serves over the
 * fleet and orphan doors.
 *
 * ⚠️ **274 narrowed what it EMITS, not how it is built.** The generator still shapes
 * a realistic estate — assignment, city and an ageing spread — because those are what
 * make 1394 rows look like a fleet rather than a list. But the live fleet row carries
 * none of them (`.afk/FINDINGS-274.md` §B3–§B6), so they stay **internal to the
 * generator** and the fixture emits BackOffice spec 1173 D13's row and nothing more.
 * A fixture richer than the wire is exactly how five tickets were built against
 * fields that did not exist.
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

/**
 * A generated branch **plus the generator's own bookkeeping**.
 *
 * 🚩 The four extra fields are what shape a believable estate — and are exactly the
 * four the live door does not send. They never leave this module: `SETTLEMENT_FLEET`
 * emits `SettlementFleetRow`, which is D13's row.
 */
type Seed = SettlementFleetRow & {
  city: string
  assignment: SettlementAssignment
  currencyKey: string
  ageingCount: number
}

/** Internal to the generator only — see `Seed`. */
type SettlementAssignment = 'mine' | 'unassigned' | 'other'

function buildEstate(): {
  fleet: Seed[]
  orphans: SettlementOrphanRow[]
} {
  const rand = lcg(0x267270)
  const fleet: Seed[] = []

  // ── The six, aggregated from their own accounts ───────────────────────────
  for (const [storeId, meta] of Object.entries(HOSTILE)) {
    const account = SETTLEMENT_ACCOUNTS[storeId]
    const headline = accountHeadline(account.entries)
    fleet.push({
      storeId,
      storeName: account.storeName,
      city: meta.city,
      assignment: meta.assignment,
      // 🚩 0688 is the estate's Bahraini branch — three decimals, and the reason
      // §B6's missing `currencyKey` is a money finding rather than a cosmetic one.
      // Held here for the generator only; it is stripped on the way out.
      currencyKey: storeId === '0688' ? 'BHD' : 'SAR',
      openCount: headline.openCount,
      shortageTotal: headline.shortageTotal,
      surplusTotal: headline.surplusTotal,
      signedPosition: headline.signedPosition,
      movedSinceCutoff: account.consumptions.length,
      hasOrphan: storeId === '0331',
      hasUncollectedReceipt: storeId === '0455',
      ageingCount: meta.ageing,
    })
  }

  // ── …and the 1388 that make it an estate ──────────────────────────────────
  const generated: Seed[] = []
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
  const shares: [Seed[], number][] = [
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

  // Money for every generated branch that has an open one, so the estate's figures
  // are estate-scale rather than a list of six.
  //
  // ⚠️ 274: this used to mint a full ledger ROW per open entry, for the cross-estate
  // ledger door. That door does not exist (§B1), so only the branch's two magnitudes
  // are folded — which is all the fleet row ever carried anyway.
  for (const row of generated) {
    for (let i = 0; i < row.openCount; i++) {
      const kind = rand() < 0.62 ? 'SHORTAGE' : 'SURPLUS'
      const amount = Math.round((25 + rand() * 1800) * 100) / 100
      if (kind === 'SHORTAGE') row.shortageTotal += amount
      else row.surplusTotal += amount
    }
    row.shortageTotal = Math.round(row.shortageTotal * 1000) / 1000
    row.surplusTotal = Math.round(row.surplusTotal * 1000) / 1000
    row.signedPosition = Math.round((row.shortageTotal - row.surplusTotal) * 1000) / 1000
  }

  fleet.push(...generated)

  // ── The one enumerated lane ───────────────────────────────────────────────
  //
  // 🔑 FOUR orphans, at four branches, of which the first is 0331's own — the same
  // consumption the account renders in words (269's rule 1), now with a Repair
  // button beside it. Two of the four are at branches nobody is assigned to, which
  // is the carve-out's whole argument in two rows.
  //
  // ⚠️ 274: these are `SettlementConsumption` rows, because that is what
  // `Settlement/Orphans` answers — no `entryNumber`, no `storeName`, no
  // `currencyKey`, no `ageDays` (§B2). The **cash-waiting** lane that stood beside
  // them is gone: no door enumerates it.
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
    storeId: row.storeId,
    amount: i === 0 ? orphanSource.amount : Math.round((300 + i * 1400) * 100) / 100,
    consumedAt: i === 0 ? orphanSource.consumedAt : `2026-07-2${i}T22:${40 + i}:00`,
    consumptionKind: 'CONSUME',
    documentType: 'SPECIAL_RECEIPT',
    // Blank is what MAKES them orphans — the door's own predicate.
    documentId: '',
    documentNumber: '',
  }))

  return { fleet, orphans }
}

const ESTATE = buildEstate()

/**
 * `GET Settlement/Fleet?scope=…` — 1394 aggregated rows, the six among them.
 *
 * 🔑 **Narrowed to D13's row on the way out.** The generator's `city`, `assignment`,
 * `currencyKey` and `ageingCount` are stripped here rather than never generated, so
 * the estate keeps its realistic shape and the fixture keeps the wire's honesty.
 */
export const SETTLEMENT_FLEET: SettlementFleetRow[] = ESTATE.fleet.map(
  ({ city: _city, assignment: _assignment, currencyKey: _currencyKey, ageingCount: _ageing, ...row }) => row,
)

/** `GET Settlement/Orphans` — the wrong-money lane, estate-wide by construction. */
export const SETTLEMENT_ORPHANS: SettlementOrphanRow[] = ESTATE.orphans

/**
 * **What the SERVER knows about each branch's assignment — not what the wire
 * carries.**
 *
 * 🔑 **This exists for the drive's stub, which plays the server's part.** After 274
 * the scope is resolved server-side (`Settlement/Fleet?scope=mine` against map 1153's
 * assignment tables), so a stub that ignored it would let the client send any scope
 * and never notice it was unhandled. The stub filters on this map exactly as the door
 * filters on its own tables — carve-out included.
 *
 * ⚠️ **No screen may import this, and nothing does.** It is deliberately NOT on
 * `SettlementFleetRow`: that field is §B4's finding, and a client reading assignment
 * from a fixture would be re-creating the exact defect this ticket removed. The
 * boundary is the same one the server keeps — it knows the roster, the browser does
 * not.
 */
export const SETTLEMENT_ASSIGNMENT: Record<string, 'mine' | 'unassigned' | 'other'> =
  Object.fromEntries(ESTATE.fleet.map((r) => [r.storeId, r.assignment]))
