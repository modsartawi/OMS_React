import type {
  DeliverectAccount,
  DeliverectLinkedFilter,
  DeliverectStoreRow,
  DeliverectStoresQuery,
} from '@/core/models/deliverect'

// The Deliverect stores page's pure rules (spec 2615, ticket 477): the link state, which optional
// blocks the grid draws, the URL ⇄ query mapping, the account choices, and the onboard warning.
// Pure: no React, no `t`.

/** A store is **linked** once Deliverect's registration gave it a location; until then it is onboarded, not linked. */
export type StoreLinkState = 'linked' | 'notLinked'

/** Linked = `deliverectLocationId` is non-null (contract § Stores). */
export function storeState(row: Pick<DeliverectStoreRow, 'deliverectLocationId'>): StoreLinkState {
  return row.deliverectLocationId !== null && row.deliverectLocationId !== undefined ? 'linked' : 'notLinked'
}

/**
 * Which optional blocks the grid draws a column for. `sync` is `null` on every row until
 * BackOffice 2624 ships and `status` until 2625 does: a column appears once ANY row carries its
 * block, and is absent while none does (480 and 481 fill them in).
 */
export function optionalColumns(rows: readonly Pick<DeliverectStoreRow, 'sync' | 'status'>[]): {
  sync: boolean
  status: boolean
} {
  return {
    sync: rows.some((r) => r.sync != null),
    status: rows.some((r) => r.status != null),
  }
}

/** The door's three `linked` values, in the order the filter offers them. */
export const LINKED_FILTERS: readonly DeliverectLinkedFilter[] = ['any', 'yes', 'no']

/** The page's query, read from its URL. An unknown `linked` reads as the contract's default, `any`. */
export function storesFromParams(params: URLSearchParams): DeliverectStoresQuery {
  const linked = params.get('linked')
  const text = (key: string) => {
    const v = params.get(key)?.trim()
    return v ? v : null
  }
  return {
    account: text('account'),
    linked: LINKED_FILTERS.includes(linked as DeliverectLinkedFilter) ? (linked as DeliverectLinkedFilter) : 'any',
    q: text('q'),
  }
}

/** The query as URL params — and, as written, the door's own params: `any` is the default and is left out. */
export function storesToParams(query: DeliverectStoresQuery): URLSearchParams {
  const out = new URLSearchParams()
  if (query.account) out.set('account', query.account)
  if (query.linked !== 'any') out.set('linked', query.linked)
  if (query.q) out.set('q', query.q)
  return out
}

/**
 * The account keys offered by the account filter and by the onboard / move field's suggestions,
 * sorted and distinct.
 *
 * - With the `Accounts` read: its keys.
 * - Without it (a 403 — the contract puts that door behind `canManageTerms`, HITL-477 — or any
 *   failure): the distinct `accountKey`s of the store rows seen so far.
 *
 * Either way the keys in `also` (the current filter value) are kept, so a filtered list never
 * hides the value it is filtered by.
 */
export function accountChoices(
  accounts: readonly DeliverectAccount[] | undefined,
  rowKeys: readonly string[],
  also: readonly (string | null)[] = [],
): string[] {
  const keys = accounts ? accounts.map((a) => a.accountKey) : rowKeys
  return [...new Set([...keys, ...also].filter((k): k is string => !!k))].sort((a, b) => a.localeCompare(b))
}

/**
 * The onboard's warning (contract § Stores, POST): a store on the direct HungerStation rail comes
 * back with `onDirectHungerStation: true` and the envelope `message` carries the server's warning.
 * It is a WARNING, never a refusal — the store IS onboarded. `null` when there is nothing to warn
 * about; `message` is `null` when the server sent no words (the page then says it in its own).
 */
export function onboardWarning(
  row: Pick<DeliverectStoreRow, 'storeCode' | 'onDirectHungerStation'> | null,
  message: string | null | undefined,
): { storeCode: string; message: string | null } | null {
  if (row?.onDirectHungerStation !== true) return null
  const words = message?.trim()
  return { storeCode: row.storeCode, message: words ? words : null }
}
