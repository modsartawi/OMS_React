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
import type { AdvisePlan, AdviseReply } from '@/core/models/sourcing-run'

/** The parts of the company's cost, in the order spec §6 lists them. A part not listed follows, in the order sent. */
export const COST_PARTS = ['DELIVERY_RATE', 'HANDLING', 'STORE_RECORD', 'NO_STOCK', 'SLOT_LOAD', 'SLOT_TIMING'] as const

/** The plan's own parts of the balanced sum, under the company's cost. */
const PLAN_PARTS = ['waiting', 'cover', 'split'] as const

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
    for (const k of PLAN_PARTS) rows.push({ key: k, kind: 'plan', cells: none(), plan: { amount: sum[k], source: null } })
    rows.push({ key: 'balanced', kind: 'plan', cells: none(), plan: { amount: sum.total, source: null } })
  }
  const assumed = rows.filter((r) => r.cells.some((c) => c?.source === 'ASSUMED')).map((r) => r.key)
  return { columns: ships.map((s) => ({ no: s.no, store: s.store })), rows, assumed }
}

export interface RecordRow {
  measure: string
  rate: number
  likeStores: number
  count: number
  source: string
  cost: number | null
  /** Ran on the neutral default (the like-store rate, costing nothing: 4386). */
  neutral: boolean
}

export interface StoreRecordView {
  no: number
  store: string
  storeName: string
  mode: string
  /** The run read this store (it is in `inputs.stores`). */
  read: boolean
  /** The shipment's store record cost, as sent in its cost parts. */
  cost: number | null
  rows: RecordRow[]
}

export function storeRecords(plan: AdvisePlan, reply: AdviseReply): StoreRecordView[] {
  const stores = reply.inputs?.stores ?? []
  return plan.shipments.map((s) => {
    const input = stores.find((x) => x.store === s.store)
    const measures = input?.record?.[s.mode] ?? {}
    return {
      no: s.no,
      store: s.store,
      storeName: s.storeName,
      mode: s.mode,
      read: !!input,
      cost: s.costParts?.find((c) => c.part === 'STORE_RECORD')?.amount ?? null,
      rows: Object.entries(measures).map(([measure, m]) => ({
        measure,
        rate: m.rate,
        likeStores: m.likeStores,
        count: m.count,
        source: m.source,
        cost: m.cost ?? null,
        neutral: m.source === 'NEUTRAL_DEFAULT',
      })),
    }
  })
}
