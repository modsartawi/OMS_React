/**
 * "What happened" on a replay (ticket 964, BackOffice spec 4354 §16, SIMT decision 7, CMP 93): the store and mode routing
 * chose, when the order was delivered, late or not, the fee — a dashed card beside the plans, or the table's last column —
 * and one sentence against the Recommended plan. Pure.
 *
 * The comparison is an estimate, never "would have been better" (spec 4354 §16): a replay plans on today's figures at the
 * order's hour, so the plan's promise is read as the time from planning to its last shipment, and the order's as the
 * time from its first delivery coming in to its last delivered. The minutes between two wall-clock times are worked out
 * here.
 *
 * The wire is BackOffice 4381's `whatHappened[]`: one row per real delivery (its store, mode, lines, when it came in and
 * was delivered, late or not, the fee paid). SERVER GAP (spec 4354) — it sends no totals, no store name and no minutes
 * late: the count is how many deliveries came, the fee paid is their fees added (each a fact, never an assumed rate), a
 * store is named by the reply's own name for it or its code, and a late delivery says only that it was late.
 */
import type { AdviseReply, DeliveryMode } from '@/core/models/sourcing-run'
import type { PlanMeasure, ShipmentBrief } from './plans-table-model'
import { storeNames } from './stock-per-line-model'

export interface HappenedDelivery {
  delivery: string
  store: string
  /** The reply's own name for the store; empty when it gives none. */
  storeName: string
  /** Null when no mode reads the delivery's type. */
  mode: DeliveryMode | string | null
  cameInAt: string
  deliveredAt: string | null
  late: boolean | null
  fee: number
}

/** The sentence against the Recommended plan, by how the two times stand. Minutes are whole. */
export type HappenedAgainst =
  | {
      kind: 'sooner' | 'later' | 'same'
      /** From planning to the plan's last shipment. */
      planMinutes: number
      /** From the order being placed to its last delivery. */
      happenedMinutes: number
      /** How far apart the two are, never negative. */
      apartMinutes: number
      planDeliveries: number
      deliveries: number
      planFee: number
      fee: number
    }
  | { kind: 'notDelivered'; planMinutes: number; planDeliveries: number; deliveries: number; planFee: number; fee: number }

export interface WhatHappenedCard {
  orderNumber: string
  deliveries: HappenedDelivery[]
  /** How many deliveries came, and the fee paid for them. */
  count: number
  fee: number
  /** The last delivery's time, as sent; null while any delivery is not delivered. */
  deliveredAt: string | null
  /** Whether any delivery was late. */
  late: boolean
  /** Null when the run shows no Recommended plan. */
  against: HappenedAgainst | null
}

/** A local wall-clock time `yyyy-MM-dd HH:mm:ss` as minutes on one count (no zone: both ends are local). */
function minutesOf(at: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/.exec(at)
  if (!m) return null
  const [, y, mo, d, h, mi, s] = m
  return Date.UTC(+y, +mo - 1, +d, +h, +mi, +(s ?? 0)) / 60000
}

const minutesBetween = (from: string | null | undefined, to: string | null | undefined): number | null => {
  const a = from ? minutesOf(from) : null
  const b = to ? minutesOf(to) : null
  return a === null || b === null ? null : Math.round(b - a)
}

/** The card for a replay reply; null when the reply has none to show (a hand-built cart, a point moved by hand). */
export function whatHappened(reply: AdviseReply): WhatHappenedCard | null {
  const wh = reply.whatHappened
  // CMP 93: a replay whose customer's pin was moved by hand drops the card; only the order's own replay shows it.
  if (reply.kind !== 'REPLAY' || !wh) return null
  const names = storeNames(reply)
  const deliveries: HappenedDelivery[] = wh.map((d) => ({
    delivery: d.deliveryNo,
    store: d.store,
    storeName: names.get(d.store) ?? '',
    mode: d.mode ?? null,
    cameInAt: d.cameInAt,
    deliveredAt: d.deliveredAt ?? null,
    late: d.late ?? null,
    fee: d.fee,
  }))
  const count = deliveries.length
  // Facts only: the fees the customer paid (no total is sent).
  const fee = Math.round(deliveries.reduce((a, d) => a + d.fee, 0) * 1000) / 1000
  const cameIn = deliveries.length > 0 ? deliveries.map((d) => d.cameInAt).reduce((a, b) => (minutesOf(b)! < minutesOf(a)! ? b : a)) : null
  const delivered = deliveries.length > 0 && deliveries.every((d) => d.deliveredAt !== null)
  const deliveredAt = delivered ? deliveries.map((d) => d.deliveredAt as string).reduce((a, b) => (minutesOf(b)! > minutesOf(a)! ? b : a)) : null
  const rec = reply.plans.find((p) => p.goal === 'BALANCED')
  let against: HappenedAgainst | null = null
  const planMinutes = rec ? minutesBetween(reply.plannedFor, rec.promise.by) : null
  if (rec && planMinutes !== null) {
    const base = { planMinutes, planDeliveries: rec.totals.shipments, deliveries: count, planFee: rec.totals.fee, fee }
    const happenedMinutes = minutesBetween(cameIn, deliveredAt)
    if (happenedMinutes === null) against = { kind: 'notDelivered', ...base }
    else {
      const apart = happenedMinutes - planMinutes
      against = {
        kind: apart > 0 ? 'sooner' : apart < 0 ? 'later' : 'same',
        planMinutes,
        happenedMinutes,
        apartMinutes: Math.abs(apart),
        planDeliveries: base.planDeliveries,
        deliveries: base.deliveries,
        planFee: base.planFee,
        fee: base.fee,
      }
    }
  }
  return {
    orderNumber: reply.orderNumber ?? '',
    deliveries,
    count,
    fee,
    deliveredAt,
    late: deliveries.some((d) => d.late === true),
    against,
  }
}

/** A cell of the plans table's last column, "What happened". */
export type HappenedCell =
  | { kind: 'delivered'; at: string | null; late: boolean }
  | { kind: 'count'; value: number }
  | { kind: 'shipments'; shipments: ShipmentBrief[] }
  | { kind: 'money'; value: number; perShipment: number[] }
  /** The order carries no such figure: the company's cost of a real delivery, its price of waiting, its balanced total. */
  | { kind: 'notRecorded' }

/** The last column of the plans table, a cell per measure (SIMT decision 7: "or the last column of the table"). */
export function happenedCells(card: WhatHappenedCard): Record<PlanMeasure, HappenedCell> {
  return {
    promise: { kind: 'delivered', at: card.deliveredAt, late: card.late },
    deliveries: { kind: 'count', value: card.count },
    storesAndModes: { kind: 'shipments', shipments: card.deliveries.map((d, i) => ({ no: i + 1, store: d.store, storeName: d.storeName, mode: d.mode ?? '' })) },
    fee: { kind: 'money', value: card.fee, perShipment: card.deliveries.map((d) => d.fee) },
    companyCost: { kind: 'notRecorded' },
    waiting: { kind: 'notRecorded' },
    balanced: { kind: 'notRecorded' },
  }
}
