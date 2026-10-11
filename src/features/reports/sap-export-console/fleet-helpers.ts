/**
 * The fleet page's tiles and refusals (BackOffice spec 2579, ticket 463). Pure, pinned by
 * `fleet-helpers.test.ts`.
 *
 * 🚩 The tiles are the door's counts as sent: nothing here adds, derives or re-judges one.
 */
import type { DoubleSendRow, FleetSummary, Label } from '@/core/models/sap-export'
import { labelToken, type LabelToken } from './label-helpers'

export type FleetTileKey = keyof FleetSummary['tiles']

/** What a tile does when clicked. */
export type FleetTileAction =
  /** Toggles the fleet list's `label` filter. */
  | { kind: 'label'; label: Label }
  /** Opens another view of the console. */
  | { kind: 'link'; href: string }
  /** A count only: the fleet door has no filter for it. */
  | { kind: 'none' }

export interface FleetTile {
  key: FleetTileKey
  count: number
  labelKey: string
  /** The tile's accent, through the console's label tokens (`./label-helpers`). */
  token: LabelToken
  /** A zero count: drawn without its accent, so only a problem catches the eye. */
  quiet: boolean
  action: FleetTileAction
}

/** The rollup is refreshed every 10 minutes (spec 2579); older than this, its numbers may be stale. */
export const STALE_AFTER_MINUTES = 30

/** The double-send list's two flags (`GET SapExport/DoubleSends?flag=`): X1 double-sent, X1p pending. */
export type DoubleSendFlag = DoubleSendRow['flag']
export const DOUBLE_SEND_FLAGS: readonly DoubleSendFlag[] = ['X1', 'X1p']

/** The double-send list (ticket 465) with one flag, the contract's `flag` parameter. */
export const doubleSendsHref = (flag: DoubleSendFlag): string => `/reports/sap-export/double-sends?flag=${flag}`

/**
 * Each tile, in the ticket's order. The three store tiles take their label's token, read from the
 * one ruling in `./label-helpers` (held for inventory is info, never red); the double sends are
 * danger (spec story 26); a broken store-day and a stalled legacy store are both money that is not
 * on its way, so danger too.
 */
const storeTile = (key: FleetTileKey, label: Label): { key: FleetTileKey; token: LabelToken; action: FleetTileAction } => ({
  key,
  token: labelToken(label).token,
  action: { kind: 'label', label },
})

const TILES: readonly { key: FleetTileKey; token: LabelToken; action: FleetTileAction }[] = [
  storeTile('storesBehind', 'behind'),
  storeTile('storesStuck', 'stuck'),
  storeTile('storesHeldForInventory', 'heldForInventory'),
  { key: 'doubleSent', token: 'danger', action: { kind: 'link', href: doubleSendsHref('X1') } },
  { key: 'doubleSendPending', token: 'danger', action: { kind: 'link', href: doubleSendsHref('X1p') } },
  { key: 'accountingBreaks', token: 'danger', action: { kind: 'none' } },
  { key: 'legacyStalled', token: 'danger', action: { kind: 'none' } },
]

/** Every tile field of `Fleet/Summary`, in the tiles' order. */
export const FLEET_TILE_KEYS: readonly FleetTileKey[] = TILES.map((t) => t.key)

/**
 * Whether the rollup stamp is older than `STALE_AFTER_MINUTES` at `now`. The stamp is local
 * wall-clock with no offset, which `Date` reads as local — never append a `Z` (the estate and its
 * readers share one wall clock, `no-utc-time`). A stamp that does not parse is stale. A rollup that
 * never computed (`null`) is not: it has no numbers to be stale, and the page says so instead.
 */
export function isStale(computedAt: string | null, now: Date): boolean {
  if (!computedAt) return false
  const at = new Date(computedAt).getTime()
  if (Number.isNaN(at)) return true
  return now.getTime() - at > STALE_AFTER_MINUTES * 60_000
}

/** The tiles, the "as of" stamp (the fleet's OLDEST `computedAt`) and whether to warn it may be stale. */
export function fleetTiles(summary: FleetSummary, now: Date): { tiles: FleetTile[]; computedAt: string | null; stale: boolean } {
  return {
    tiles: TILES.map(({ key, token, action }) => {
      const count = summary.tiles[key]
      return { key, count, labelKey: `fleet.tiles.${key}`, token, quiet: count === 0, action }
    }),
    computedAt: summary.computedAt,
    stale: isStale(summary.computedAt, now),
  }
}

const REFUSALS = ['BAD_FILTER', 'BAD_PAGING'] as const

/** A fleet refusal's own sentence key, or `null` to show the envelope's message. */
export function fleetErrorKey(code: string | null | undefined): string | null {
  return code && (REFUSALS as readonly string[]).includes(code) ? `fleet.errors.${code}` : null
}
