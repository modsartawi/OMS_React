/**
 * The map tab (ticket 964, BackOffice spec 4354 §19, §12; SIMT decisions 4–5): what the Google map panel draws for a run,
 * and the two tables under it. Pure.
 *
 * - Every plan's stores at once (or, by the switch, the selected plan's), each a point coloured by the mode it ships by.
 * - With the customer's point: a leg from each store to the customer per mode, in the mode's colour, the pick-up leg
 *   dashed, labelled with the store and its distance as the server sent it; the 5 km and 10 km rings; the customer's pin.
 * - A dotted line joins the stores of one plan, labelled with the straight line between them.
 * - Without the point (withheld, spec 4354 §12): no pin, no rings, no legs, and no straight line to the customer is worked
 *   out — every km in the table is the server's. The stores and the distances between them tell nothing of the customer
 *   and stay.
 *
 * Store points are the middle level's `inputs.stores[]`. A store's straight line to the customer and the distance between
 * two stores are not on the wire (4281 sends one km per store): they are the ground distance between the points.
 */
import { kmBetween, type MapLine, type MapPoint, type MapRing } from '@/core/map/map-drawing'
import type { MapPin } from '@/core/map/map-panel'
import type { AdviseInputStore, AdviseReply, CustomerPointWithheld, DeliveryMode, PlanGoal } from '@/core/models/sourcing-run'
import { formatPair } from '@/core/util/bidi'

/** The words the model puts on the map, in the screen's language. */
export interface MapWords {
  mode(code: string): string
  /** A distance, km to one decimal. */
  km(km: number): string
  /** A ring's words ("5 km"). */
  ring(km: number): string
  /** The pin's name. */
  customer: string
}

/** Every plan shown, or the plan picked in the tab strip. */
export type MapScope = 'all' | 'plan'

/** One row of the first table: a store as one shipment of one plan ships from it. */
export interface MapStoreRow {
  store: string
  storeName: string
  mode: DeliveryMode | string
  goal: PlanGoal
  shipmentNo: number
  /** To the customer, as the server sent it. */
  km: number | null
  kmKind: string | null
  /** The ground distance to the customer; null without the customer's point or the store's. */
  straightKm: number | null
}

/** One row of "between the stores": a pair of stores shown, in a straight line. */
export interface MapBetweenRow {
  from: string
  fromName: string
  to: string
  toName: string
  km: number
}

/** Why no customer is drawn: the server's reason, or `NOT_ASKED` when the reply holds no point and gives no reason. */
export type MapWithheld = CustomerPointWithheld | 'NOT_ASKED' | string

export interface MapPlansView {
  customer: { lon: number; lat: number } | null
  /** Null when the customer is drawn. */
  withheld: MapWithheld | null
  rows: MapStoreRow[]
  between: MapBetweenRow[]
  /** Stores shown with no location: in the table, not on the map. */
  unplaced: string[]
  points: MapPoint[]
  /** The dotted lines between one plan's stores first (beneath), then the legs. */
  lines: MapLine[]
  rings: MapRing[]
  pin: MapPin | null
}

/** Each mode's colour token (`src/app/global.css`, "the simulator's map"). */
export const MODE_INK: Record<string, string> = {
  DAWAA_NOW: '--map-mode-dawaa-now',
  SLOT: '--map-mode-slot',
  CARRIER_SAME_DAY: '--map-mode-carrier',
  CARRIER_NEXT_DAY: '--map-mode-carrier',
  BEYOND_BORDER: '--map-mode-carrier',
  PICK_UP: '--map-mode-pick-up',
}
const modeInk = (mode: string) => MODE_INK[mode] ?? '--map-same'

/** The customer's pin colour. */
export const CUSTOMER_INK = '--map-customer'
/** The rings' and the dotted lines' colour. */
const MEASURE_INK = '--map-ring'
/** The rings round the customer, in km (spec 4354 §19). */
export const RING_KMS = [5, 10] as const

const storesOf = (reply: AdviseReply): AdviseInputStore[] => (reply.inputs as { stores?: AdviseInputStore[] } | null | undefined)?.stores ?? []

export function mapPlans(reply: AdviseReply, { scope, goal, words }: { scope: MapScope; goal: PlanGoal | null; words: MapWords }): MapPlansView {
  const plans = scope === 'all' ? reply.plans : reply.plans.filter((p) => p.goal === goal)
  const read = new Map(storesOf(reply).map((s) => [s.store, s]))
  const cp = reply.customerPoint
  const customer = cp ? { lon: cp.lng, lat: cp.lat } : null
  const placeOf = (store: string) => {
    const p = read.get(store)?.point
    return p ? { lon: p.lng, lat: p.lat } : null
  }

  const rows: MapStoreRow[] = []
  // Each store shown, in the order it first appears, with each mode it ships by and that mode's km.
  const used = new Map<string, { name: string; modes: Map<string, number | null> }>()
  for (const p of plans) {
    for (const s of p.shipments) {
      const at = placeOf(s.store)
      rows.push({
        store: s.store,
        storeName: s.storeName,
        mode: s.mode,
        goal: p.goal,
        shipmentNo: s.no,
        km: s.km,
        kmKind: s.kmKind,
        straightKm: customer && at ? kmBetween(at, customer) : null,
      })
      const u = used.get(s.store) ?? { name: s.storeName, modes: new Map<string, number | null>() }
      if (!u.modes.has(s.mode)) u.modes.set(s.mode, s.km)
      used.set(s.store, u)
    }
  }

  const unplaced = [...used.keys()].filter((s) => !placeOf(s))
  const placed = [...used.entries()].filter(([s]) => placeOf(s)).map(([store, u]) => ({ store, ...u, at: placeOf(store)! }))

  const points: MapPoint[] = placed.map((s) => ({
    id: s.store,
    lon: s.at.lon,
    lat: s.at.lat,
    ink: modeInk([...s.modes.keys()][0]),
    card: {
      title: formatPair(s.store, s.name),
      subtitle: '',
      figures: [...s.modes.entries()].map(([mode, km]) => ({ label: words.mode(mode), value: km === null ? '' : words.km(km) })),
    },
  }))

  const between: MapBetweenRow[] = placed.flatMap((a, i) =>
    placed.slice(i + 1).map((b) => ({ from: a.store, fromName: a.name, to: b.store, toName: b.name, km: kmBetween(a.at, b.at) })),
  )

  // The dotted line between one plan's stores, each pair once however many plans share it.
  const dotted = new Map<string, MapLine>()
  for (const p of plans) {
    const stores = [...new Set(p.shipments.map((s) => s.store))].filter((s) => placeOf(s))
    stores.forEach((a, i) =>
      stores.slice(i + 1).forEach((b) => {
        const id = `between:${a}:${b}`
        if (dotted.has(id) || dotted.has(`between:${b}:${a}`)) return
        const from = placeOf(a)!
        const to = placeOf(b)!
        dotted.set(id, { id, from, to, tone: MEASURE_INK, dash: 'dotted', label: words.km(kmBetween(from, to)) })
      }),
    )
  }

  const legs: MapLine[] = customer
    ? placed.flatMap((s) =>
        [...s.modes.entries()].map(([mode, km]) => ({
          id: `leg:${s.store}:${mode}`,
          from: s.at,
          to: customer,
          tone: modeInk(mode),
          ...(mode === 'PICK_UP' ? { dash: 'dashed' as const } : {}),
          label: km === null ? s.store : formatPair(s.store, words.km(km)),
        })),
      )
    : []

  return {
    customer,
    withheld: customer ? null : (reply.customerPointWithheld ?? 'NOT_ASKED'),
    rows,
    between,
    unplaced,
    points,
    lines: [...dotted.values(), ...legs],
    rings: customer ? RING_KMS.map((km) => ({ id: `ring-${km}`, centre: customer, km, tone: MEASURE_INK, label: words.ring(km) })) : [],
    pin: customer ? { ...customer, ink: CUSTOMER_INK, label: words.customer } : null,
  }
}
