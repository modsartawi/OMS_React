/**
 * The stock console's top links (oms 940, BackOffice spec 4157 "The web screen") — pure, so which link is lit is pinned
 * by a test. `ConsoleNav` draws them. Order: Stores · Find an item or a batch · Feeds and switches; 940 ships Stores,
 * and 942 (`fleet`) and 943 (`find`, before `fleet`) add theirs. One grant opens the whole console, so no link is gated
 * apart from the page.
 */

export const STOCK_CONSOLE_PATH = '/stock/console'

export interface ConsolePage {
  to: string
  key: string
}

/** Feeds and switches (942): the facts that belong to no store. */
export const FLEET_PATH = `${STOCK_CONSOLE_PATH}/fleet`

/** Find an item or a batch (943): the fleet searched. */
export const FIND_PATH = `${STOCK_CONSOLE_PATH}/find`

export const CONSOLE_PAGES: readonly ConsolePage[] = [
  { to: STOCK_CONSOLE_PATH, key: 'stores' },
  { to: FIND_PATH, key: 'find' },
  { to: FLEET_PATH, key: 'fleet' },
]

const STORE_PAGES = `${STOCK_CONSOLE_PATH}/store/`

/** A store's page (941). Here, not in a column file, so the pure modules (943's Find) can link to it. */
export const storeHref = (plant: string) => `${STORE_PAGES}${encodeURIComponent(plant)}`

/** An item's page at a store (943). */
export const itemHref = (store: string, item: string) => `${storeHref(store)}/item/${encodeURIComponent(item)}`

/**
 * Whether a link is lit at `pathname`. Stores is lit on the list and on every store's and item's page (they open from
 * it); any other link on its own address and below it.
 */
export function consolePageActive(page: ConsolePage, pathname: string): boolean {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
  if (page.key === 'stores') return path === STOCK_CONSOLE_PATH || path.startsWith(STORE_PAGES)
  return path === page.to || path.startsWith(`${page.to}/`)
}
