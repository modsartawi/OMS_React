/**
 * The promise in parts (ticket 965, BackOffice spec 4354 §7; 4281 decision 26, `shipments[].promiseParts`). One view
 * per shipment of a plan: a Dawaa Now shipment is a bar of four parts (made ready, courier wait, travel, margin, each
 * at its usual figure with its source); a slot shipment names its slot, the slots skipped and why, and its next two
 * slots; pick-up reads its target. Every figure is the server's: the bar's shares lay out its width and are never
 * shown as a figure (4281 decision 28: no reader adds up for itself).
 */
import type { AdvisePlan, AdvisePromiseFigure, AdviseNextSlot } from '@/core/models/sourcing-run'

export type PromisePart = 'madeReady' | 'courierWait' | 'travel' | 'margin'

export interface PromiseSegment {
  part: PromisePart
  minutes: number
  source: string | null
  /** Its share of the bar's width, 0 to 1. Layout only. */
  share: number
}

export interface PromiseLengthener {
  name: string
  band: string
  usual: number
  cautious: number
  /** Moves neither the usual nor the cautious figure (4366: lengtheners only lengthen). */
  addsNothing: boolean
}

export interface PromiseBarView {
  no: number
  store: string
  storeName: string
  mode: string
  /** How the promise is drawn: a bar (Dawaa Now), a slot, pick-up's target, or the sentence alone (the carriers). */
  form: 'bar' | 'slot' | 'pickUp' | 'other'
  /** False at the plans-only level, where a shipment carries no parts. */
  hasParts: boolean
  segments: PromiseSegment[]
  /** The shipment's promise time. */
  by: string
  usualBy: string | null
  pickEnd: string | null
  pickEndRule: string | null
  madeReady: AdvisePromiseFigure | null
  target: number | null
  lengtheners: PromiseLengthener[]
  slot: { code: string; from: string; to: string; source: string } | null
  skipped: { from: string; why: string }[]
  next: AdviseNextSlot[]
  laterCheaper: boolean
  /** The distance, or the travel part, stands on the straight line rather than the road. */
  straightLine: boolean
}

const FORM: Record<string, PromiseBarView['form']> = { DAWAA_NOW: 'bar', SLOT: 'slot', PICK_UP: 'pickUp' }

export function promiseBars(plan: AdvisePlan): PromiseBarView[] {
  return plan.shipments.map((s) => {
    const p = s.promiseParts
    const form = FORM[s.mode] ?? 'other'
    const raw: { part: PromisePart; minutes: number; source: string | null }[] = []
    if (p && form === 'bar') {
      if (p.madeReady) raw.push({ part: 'madeReady', minutes: p.madeReady.usual, source: p.madeReady.source })
      if (p.courierWait) raw.push({ part: 'courierWait', minutes: p.courierWait.usual, source: p.courierWait.source })
      if (p.travel) raw.push({ part: 'travel', minutes: p.travel.usual, source: p.travel.source })
      if (p.margin) raw.push({ part: 'margin', minutes: p.margin.minutes, source: p.margin.source })
    }
    const width = raw.reduce((a, r) => a + Math.max(0, r.minutes), 0)
    const slot = p?.slot ?? null
    return {
      no: s.no,
      store: s.store,
      storeName: s.storeName,
      mode: s.mode,
      form,
      hasParts: !!p,
      segments: raw.map((r) => ({ ...r, share: width > 0 ? Math.max(0, r.minutes) / width : 0 })),
      by: s.promise.by,
      usualBy: p?.usualBy ?? null,
      pickEnd: p?.pickEnd ?? null,
      pickEndRule: p?.pickEndRule ?? null,
      madeReady: p?.madeReady ?? null,
      target: p?.target ?? null,
      lengtheners: (p?.lengtheners ?? []).map((l) => ({ ...l, addsNothing: l.usual === 0 && l.cautious === 0 })),
      slot: slot ? { code: slot.code, from: slot.from, to: slot.to, source: slot.source } : null,
      skipped: slot?.skipped ?? [],
      next: slot?.next ?? [],
      laterCheaper: slot?.laterCheaper === true,
      straightLine: s.kmKind === 'STRAIGHT_LINE' || p?.travel?.source === 'STRAIGHT_LINE',
    }
  })
}

/** The hours and minutes of a local wall-clock time `yyyy-MM-dd HH:mm:ss` (4379: no zone, so no `Date` is made). */
export function wireClock(time: string | null | undefined): string {
  return time ? time.slice(11, 16) : ''
}
