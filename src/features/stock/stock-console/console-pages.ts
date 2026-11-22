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

export const CONSOLE_PAGES: readonly ConsolePage[] = [{ to: STOCK_CONSOLE_PATH, key: 'stores' }]

const STORE_PAGES = `${STOCK_CONSOLE_PATH}/store/`

/**
 * Whether a link is lit at `pathname`. Stores is lit on the list and on every store's and item's page (they open from
 * it); any other link on its own address and below it.
 */
export function consolePageActive(page: ConsolePage, pathname: string): boolean {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
  if (page.key === 'stores') return path === STOCK_CONSOLE_PATH || path.startsWith(STORE_PAGES)
  return path === page.to || path.startsWith(`${page.to}/`)
}
