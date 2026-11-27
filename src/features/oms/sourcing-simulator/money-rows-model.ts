/**
 * The money of a plan (ticket 965, BackOffice spec 4354 §6; 4281 decision 26; BackOffice 4363, 4386), and how
 * deliveries go at each shipment's store.
 *
 * The money is a table: a column per shipment and one for the plan; a row for the customer's fee, one per part of the
 * company's cost, the company's cost, then the plan's own parts of the balanced sum. Every figure is the server's, with
 * its source. The plan column holds only the totals sent (`totals`, `sum`): a part is never added up across shipments
 * (4281 decision 28). The banner names the figures that stand on an assumption (spec §6: "a banner lists the assumed
 * ones a run used").
 *
 * The store record (spec §6 "the store record cost"): per shipment, its store's record for its mode, a row per measure
 * against like stores, with the deliveries behind it and its cost or credit. "How deliveries go at this store" — never
 * a word that blames the store (spec story 91).
 */
import type { AdvisePlan } from '@/core/models/sourcing-run'

/** The parts of the company's cost, in the server's money order (`MoneyRowCodes.Order`). A part not listed follows, in the order sent. */
export const COST_PARTS = ['DELIVERY_RATE', 'HANDLING', 'NO_STOCK', 'NO_STOCK_STORE', 'STORE_RECORD', 'SLOT_LOAD', 'SLOT_TIMING'] as const

/** The plan's own parts of the balanced sum, under the company's cost, each read off `sum` (`RecordSum`). */
const PLAN_PARTS = [
  ['waiting', 'waiting'],
  ['cover', 'cover'],
  ['split', 'splitPenalty'],
] as const

export interface MoneyCell {
  amount: number
  source: string | null
}

export interface MoneyRow {
  /** `fee`, a cost part's code, `companyCost`, `waiting`, `cover`, `split` or `balanced`. */
  key: string
  kind: 'fee' | 'part' | 'companyCost' | 'plan'
  /** One per shipment, in the plan's order; null where the shipment has no such figure. */
  cells: (MoneyCell | null)[]
  plan: MoneyCell | null
}

export interface MoneyTable {
  columns: { no: number; store: string }[]
  rows: MoneyRow[]
  /** The rows standing on an assumption: `fee` and cost part codes, in table order. */
  assumed: string[]
}

export function moneyRows(plan: AdvisePlan): MoneyTable {
  const ships = plan.shipments
  const none = () => ships.map(() => null)
  const sent = new Set(ships.flatMap((s) => (s.costParts ?? []).map((c) => c.part)))
  const known: string[] = [...COST_PARTS]
  const parts = [...known.filter((p) => sent.has(p)), ...[...sent].filter((p) => !known.includes(p))]

  const rows: MoneyRow[] = [
    { key: 'fee', kind: 'fee', cells: ships.map((s) => ({ amount: s.fee, source: s.feeSource })), plan: { amount: plan.totals.fee, source: null } },
    ...parts.map(
      (part): MoneyRow => ({
        key: part,
        kind: 'part',
        cells: ships.map((s) => {
          const c = s.costParts?.find((x) => x.part === part)
          return c ? { amount: c.amount, source: c.source } : null
        }),
        plan: null,
      }),
    ),
    { key: 'companyCost', kind: 'companyCost', cells: ships.map((s) => ({ amount: s.companyCost, source: null })), plan: { amount: plan.totals.companyCost, source: null } },
  ]
  if (plan.sum) {
    const sum = plan.sum
    for (const [k, part] of PLAN_PARTS) rows.push({ key: k, kind: 'plan', cells: none(), plan: { amount: sum[part], source: null } })
    rows.push({ key: 'balanced', kind: 'plan', cells: none(), plan: { amount: sum.total, source: null } })
  }
  const assumed = rows.filter((r) => r.cells.some((c) => c?.source === 'ASSUMED')).map((r) => r.key)
  return { columns: ships.map((s) => ({ no: s.no, store: s.store })), rows, assumed }
}

export interface RecordRow {
  /** `LATE`, `RETURNED`, `CANCELLED`, `NEVER_READY`, `READY_LATE`, `CALLOUT_IGNORED`. */
  measure: string
  /** The steadied rate the cost is worked on. */
  rate: number
  likeStores: number
  /** The rate expected of the store: the like-store rate, or slot timing's shifted one for "late". */
  expected: number
  bad: number
  count: number
  /** The failure price, riyals. */
  price: number
  source: string
  cost: number
  /** Ran on the neutral default (no counted delivery: costs nothing) or switched off. */
  neutral: boolean
}

export interface StoreRecordView {
  no: number
  store: string
  storeName: string
  mode: string
  /** The shipment carries a store record (BackOffice 4386: absent for a mode with none, or the figures not read). */
  read: boolean
  /** The shipment's store record cost, as sent. */
  cost: number | null
  rows: RecordRow[]
}

export function storeRecords(plan: AdvisePlan): StoreRecordView[] {
  return plan.shipments.map((s) => {
    const record = s.storeRecord
    return {
      no: s.no,
      store: s.store,
      storeName: s.storeName,
      mode: s.mode,
      read: !!record,
      cost: record?.cost ?? s.costParts?.find((c) => c.part === 'STORE_RECORD')?.amount ?? null,
      rows: (record?.lines ?? []).map((m) => ({
        measure: m.measure,
        rate: m.steadiedRate,
        likeStores: m.likeRate,
        expected: m.expectedRate,
        bad: m.badEndings,
        count: m.deliveries,
        price: m.failurePrice,
        source: m.source,
        cost: m.cost,
        neutral: m.source === 'NEUTRAL_DEFAULT' || m.source === 'SWITCHED_OFF',
      })),
    }
  })
}
