/**
 * The seat a simulation prices from (BackOffice spec 4190, ticket 957; glossary: Origin (seat)).
 *
 * **The seat is the origin, and nothing else.** The engine's bonus-buy pass filters by origin
 * prefix and falls back to the plant when the origin is blank, so a call-center order is priced
 * with the plant set to the customer's stock store and the origin set to the web call-center seat,
 * and a Mini POS order with the origin set to the plant followed by `M`. No other header field is
 * stamped (owner decision).
 */

/** The seats offered, in the order the Seat control lists them. */
export const SIM_SEATS = ['store', 'callCenter', 'miniPos', 'custom'] as const
export type SimSeat = (typeof SIM_SEATS)[number]

/**
 * The web call-center seat. Mirrors the server's `CallCenterEngineSession.WebOrigin`
 * (BackOffice `Sartawi.Retail.Data/Modules/Pos/Services/CallCenter/CallCenterEngineSession.cs`) —
 * the origin every web call-center order is priced under. Keep the two in step.
 */
export const CALL_CENTER_ORIGIN = 'C000'

/** The Mini POS seat's suffix: a Mini POS till's origin is its store code followed by `M`. */
const MINI_POS_SUFFIX = 'M'

export interface SeatInputs {
  seat: SimSeat
  plant: string
  /** The Custom seat's typed origin; read only when the seat is Custom. */
  customOrigin: string
}

/**
 * The origin a seat sends, or `null` for none — the engine then takes the plant as the origin.
 * Store till sends none; Mini POS follows the plant as it changes (and names nothing without one);
 * Custom sends its text trimmed, and a blank one sends none.
 */
export function seatOrigin({ seat, plant, customOrigin }: SeatInputs): string | null {
  switch (seat) {
    case 'store':
      return null
    case 'callCenter':
      return CALL_CENTER_ORIGIN
    case 'miniPos': {
      const code = plant.trim()
      return code === '' ? null : `${code}${MINI_POS_SUFFIX}`
    }
    case 'custom':
      return customOrigin.trim() || null
  }
}

/**
 * The seat a sent origin names, read back off the request (the run strip's chips are the request,
 * not a second spelling of it — ticket 113). Since the seat is only the origin, a Custom seat typed
 * as `C000` IS the call center; another plant's Mini POS code reads as Custom.
 */
export function originSeat(origin: string | null, plant: string): SimSeat {
  const code = (origin ?? '').trim()
  if (code === '') return 'store'
  if (code === CALL_CENTER_ORIGIN) return 'callCenter'
  const plantCode = plant.trim()
  if (plantCode !== '' && code === `${plantCode}${MINI_POS_SUFFIX}`) return 'miniPos'
  return 'custom'
}
