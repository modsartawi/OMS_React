/**
 * The general master's page, pure (BackOffice spec 3185, door 3191; oms ticket 647). The general master (tier 4) is
 * listed by `GET IdfPriority/masters` as `{ masterId: 'general', kind: 'general' }` but has no versions: its items
 * are read from `GET IdfPriority/general/items?search=&idf=&page=&pageSize=` (643's row and page shapes, `items.ts`)
 * and edited one at a time (648) or by upload (649); 650's change log is a tab.
 *
 * 🧭 The address, shared by the page's tabs:
 *   - `?tab` — the tab on show; `items` is the default and leaves the address. 650 appends `'changes'` to
 *     `IDF_GENERAL_TABS` and its own `changes` field to `IdfGeneralQuery`.
 *   - each tab owns its own keys and **only the tab on show writes them**: Items writes 643's `q`, `idf`, `page`;
 *     650's Change log may reuse `idf` / `page` (plus `item`, `user`, `from`, `to`) without colliding, because a tab
 *     switch (`switchGeneralTab`) drops the other tab's keys and opens the new tab at its defaults.
 */
import { readItemsQuery, writeItemsQuery, type IdfItemsQuery } from './items'

export const IDF_GENERAL_TABS = ['items'] as const // 650 · append 'changes'
export type IdfGeneralTab = (typeof IDF_GENERAL_TABS)[number]

export interface IdfGeneralQuery {
  tab: IdfGeneralTab
  /** The Items tab's query (643's `q`, `idf`, `page`); its defaults while another tab shows. */
  items: IdfItemsQuery
  // 650 · changes: the Change log tab's query
}

const NO_ITEMS: IdfItemsQuery = { q: '', idf: '', page: 1 }

function readTab(value: string | null): IdfGeneralTab {
  return (IDF_GENERAL_TABS as readonly string[]).includes(value ?? '') ? (value as IdfGeneralTab) : 'items'
}

export function readGeneralQuery(params: URLSearchParams): IdfGeneralQuery {
  const tab = readTab(params.get('tab'))
  return { tab, items: tab === 'items' ? readItemsQuery(params) : NO_ITEMS }
}

/** Only the tab on show writes its keys; the default tab leaves `tab` out. */
export function writeGeneralQuery(q: IdfGeneralQuery): URLSearchParams {
  const out = new URLSearchParams()
  if (q.tab !== 'items') out.set('tab', q.tab)
  if (q.tab === 'items') writeItemsQuery(q.items, out)
  // 650 · if (q.tab === 'changes') write the change log's keys onto `out`
  return out
}

/** Stable, module-level readers for `useUrlQuery` on the General page. */
export const generalFromParams = (p: URLSearchParams) => readGeneralQuery(p)
export const generalToParams = (q: IdfGeneralQuery) => writeGeneralQuery(q)

/** Opening a tab starts it at its defaults and drops the other tab's keys; the tab on show is left as it is. */
export function switchGeneralTab(q: IdfGeneralQuery, tab: IdfGeneralTab): IdfGeneralQuery {
  return q.tab === tab ? q : { tab, items: NO_ITEMS }
}
