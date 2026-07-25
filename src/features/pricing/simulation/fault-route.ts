import { ApiError, apiErrorCode } from '@/core/api'

/**
 * Where a whole-run failure points (ticket 120, spec 110 story 69).
 *
 * Failures on this screen arrive as **whole-run 400s** — the 098 capture session
 * never produced a per-line `E`, and only a `W` rides a 200. So the banner is the
 * only evidenced failure surface, and the one thing it owes the analyst beyond the
 * server's sentence is *where to go*.
 *
 * The classification is read off the envelope's machine code, never off its English:
 *
 * - The two faults the captures produced **from the basket itself** carry a code —
 *   `INVALID_UOM` (an unknown material) and `INVALID_CONDITION_ITEM_LEVEL` (a manual
 *   condition sent at item number 0, the grid's own default). Both live in the Items
 *   frame now that manual conditions fold into it, so both route there.
 * - The determination fault the session produced — a distribution channel that no
 *   pricing procedure resolves — came back **code-less**. So any other business 400
 *   routes to the run settings.
 * - Anything that is not a business envelope (the HTTP 500 a negative quantity
 *   returns, a network drop) carries **no** route: the fault is not on the screen,
 *   and a banner that pointed somewhere anyway would be guessing out loud.
 */
export type FaultRoute = 'items' | 'settings' | null

/** The coded faults the basket itself produces (098 findings 5 and 6). */
const ITEM_FAULT_CODES = new Set(['INVALID_UOM', 'INVALID_CONDITION_ITEM_LEVEL'])

export function faultRoute(err: unknown): FaultRoute {
  if (!(err instanceof ApiError) || err.kind !== 'business') return null
  const code = apiErrorCode(err)
  return code !== null && ITEM_FAULT_CODES.has(code) ? 'items' : 'settings'
}
