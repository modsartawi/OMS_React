/**
 * The home's state in its URL (oms 947): the map filter (`?filter=`) and the pharmacy whose scorecard panel is open
 * (`?store=`), beside 946's `?lang=`. In the URL so a brief link (`homeHref({ store })`) opens the same panel a map
 * point does, and Back closes it.
 */
import { CC_FILTERS, type CcFilter } from '@/core/models/command-center'

/** The URL's filter; anything unknown is all issues. */
export const filterOf = (params: URLSearchParams): CcFilter => {
  const value = params.get('filter')
  return (CC_FILTERS as readonly string[]).includes(value ?? '') ? (value as CcFilter) : 'all'
}

/** The same URL under another filter; all issues is the default and names nothing. */
export const withFilter = (params: URLSearchParams, filter: CcFilter): URLSearchParams => {
  const next = new URLSearchParams(params)
  if (filter === 'all') next.delete('filter')
  else next.set('filter', filter)
  return next
}

/** The same URL with a pharmacy's scorecard open, or (null) closed. */
export const withStore = (params: URLSearchParams, storeCode: string | null): URLSearchParams => {
  const next = new URLSearchParams(params)
  if (storeCode) next.set('store', storeCode)
  else next.delete('store')
  return next
}
