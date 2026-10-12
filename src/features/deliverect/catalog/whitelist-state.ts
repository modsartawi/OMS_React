import type {
  DeliverectWhitelistQuery,
  DeliverectWhitelistRow,
  DeliverectWhitelistState,
  DeliverectWhitelistUpdateBody,
} from '@/core/models/deliverect'

/**
 * A whitelist row's state, the writes it offers, and the grid's URL query (ticket 479; contract
 * § Catalog) — pure.
 */

/** The grid's page: the contract's ceiling on `take`. */
export const WHITELIST_PAGE_SIZE = 500

/** The door's `state` filter, in the order the screen offers it; `active` is the door's default. */
export const WHITELIST_STATES: readonly DeliverectWhitelistState[] = ['active', 'disabled', 'deleted', 'any']

export type WhitelistRowState = 'active' | 'disabled' | 'deleted'

/** A row as one state: deleted wins over disabled. */
export function rowState(row: DeliverectWhitelistRow): WhitelistRowState {
  return row.deleted ? 'deleted' : row.disabled ? 'disabled' : 'active'
}

/** A row write — each sent with a reason through `PUT Whitelist/{material}`. */
export type WhitelistAction = 'disable' | 'delete' | 'restore'

/** The writes a row offers: an active row can be disabled or deleted, a disabled one restored or
 *  deleted, a deleted one only restored. */
export function rowActions(row: DeliverectWhitelistRow): WhitelistAction[] {
  const state = rowState(row)
  return state === 'active' ? ['disable', 'delete'] : state === 'disabled' ? ['restore', 'delete'] : ['restore']
}

/**
 * The PUT body for a write. Delete keeps the disabled flag as it is, and restore undoes ONE step: a
 * deleted row comes back as it was before the delete (still disabled if it was), a disabled row is
 * enabled — so a restore never puts on sale a material someone had disabled for its own reason.
 */
export function updateBody(action: WhitelistAction, row: DeliverectWhitelistRow, reason: string): DeliverectWhitelistUpdateBody {
  if (action === 'disable') return { disabled: true, deleted: false, reason }
  if (action === 'delete') return { disabled: row.disabled, deleted: true, reason }
  return row.deleted ? { disabled: row.disabled, deleted: false, reason } : { disabled: false, deleted: false, reason }
}

/** The number a sentence or a cell names, grouped as figures are drawn across the app. */
export const figure = (n: number) => n.toLocaleString('en-US')

/** The grid's query from the URL; anything unreadable falls back to the door's default. */
export function whitelistFromParams(params: URLSearchParams): DeliverectWhitelistQuery {
  const state = params.get('state') as DeliverectWhitelistState | null
  const skip = Number(params.get('skip') ?? '0')
  return {
    q: params.get('q')?.trim() || null,
    state: state !== null && WHITELIST_STATES.includes(state) ? state : 'active',
    skip: Number.isSafeInteger(skip) && skip > 0 ? skip : 0,
    take: WHITELIST_PAGE_SIZE,
  }
}

/** The URL for a query: only what differs from the default is written. */
export function whitelistToParams(query: DeliverectWhitelistQuery): URLSearchParams {
  const params = new URLSearchParams()
  if (query.state !== 'active') params.set('state', query.state)
  if (query.q) params.set('q', query.q)
  if (query.skip > 0) params.set('skip', String(query.skip))
  return params
}
