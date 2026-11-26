/**
 * The plans as one table (ticket 962, BackOffice spec 4354 §19, SIMT decision 1): a row per measure, a column per plan.
 * Pure. Every figure is the server's, as rounded: nothing is added up here (4281 decision 28). Company's net is not a
 * row: no field carries it and no reader may compute it.
 */
import type { AdvisePlan, AdviseReply, Bilingual, DeliveryMode, PlanGoal } from '@/core/models/sourcing-run'

/** The rows, in the order the table shows them. */
export const PLAN_MEASURES = ['promise', 'deliveries', 'storesAndModes', 'fee', 'companyCost', 'waiting', 'balanced'] as const
export type PlanMeasure = (typeof PLAN_MEASURES)[number]

export interface PlanColumn {
  goal: PlanGoal
  label: Bilingual
  /** The other goals the same plan answers, drawn as "also …" tags. */
  tags: PlanGoal[]
  fallback: boolean
  bestFound: boolean
  trialSet: boolean
}

export interface ShipmentBrief {
  no: number
  store: string
  storeName: string
  mode: DeliveryMode | string
}

export type PlanCell =
  | { kind: 'text'; text: Bilingual }
  | { kind: 'count'; value: number }
  | { kind: 'shipments'; shipments: ShipmentBrief[] }
  /** `null`: the reply's level does not carry the figure. `perShipment`: the parts the total is sent with. */
  | { kind: 'money'; value: number | null; perShipment?: number[] }

export interface PlanRow {
  measure: PlanMeasure
  cells: PlanCell[]
}

export interface PlansTable {
  columns: PlanColumn[]
  rows: PlanRow[]
}

export const planColumn = (p: AdvisePlan): PlanColumn => ({
  goal: p.goal,
  label: p.label,
  tags: [...p.alsoGoals],
  fallback: p.fallback,
  bestFound: p.bestFound,
  trialSet: p.trialSet,
})

const cellOf = (measure: PlanMeasure, p: AdvisePlan): PlanCell => {
  switch (measure) {
    case 'promise':
      return { kind: 'text', text: { en: p.promise.en, ar: p.promise.ar } }
    case 'deliveries':
      return { kind: 'count', value: p.totals.shipments }
    case 'storesAndModes':
      return { kind: 'shipments', shipments: p.shipments.map((s) => ({ no: s.no, store: s.store, storeName: s.storeName, mode: s.mode })) }
    case 'fee':
      return { kind: 'money', value: p.totals.fee, perShipment: p.shipments.map((s) => s.fee) }
    case 'companyCost':
      return { kind: 'money', value: p.totals.companyCost, perShipment: p.shipments.map((s) => s.companyCost) }
    case 'waiting':
      return { kind: 'money', value: p.sum?.waiting ?? null }
    case 'balanced':
      return { kind: 'money', value: p.sum?.total ?? null }
  }
}

/** The table of a reply's shown plans, in the order the reply sends them. */
export function plansTable(reply: Pick<AdviseReply, 'plans'>): PlansTable {
  return {
    columns: reply.plans.map(planColumn),
    rows: PLAN_MEASURES.map((measure) => ({ measure, cells: reply.plans.map((p) => cellOf(measure, p)) })),
  }
}
