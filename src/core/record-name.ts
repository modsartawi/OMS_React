import { useEffect } from 'react'
import { useLocation } from 'react-router'
import { create } from 'zustand'

/**
 * The name of the record a page is open on, for the top bar's crumb (spec 4182, oms 951).
 *
 * The crumb reads the record off the route's params, which is right for a document or a member number but not for a
 * route whose param is a slug — `/analytics/help/start` is the article "Start here", not record `start`. Such a page
 * names its record here (`useRecordName`), for the address it is open on; the crumb prefers that name, as free text,
 * over the raw param. The shell and the page never import each other, so they meet in `core`.
 */
export interface RecordName {
  /** The address the name belongs to: a name never outlives the page that gave it. */
  pathname: string
  name: string
}

export const useRecordNameStore = create<{ named: RecordName | null }>(() => ({ named: null }))

/** The address without a trailing slash, as the crumb's own menu match reads it. */
const bare = (pathname: string): string => (pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname)

/** The name given for `pathname`, or null when none is (or it was given for another address). */
export function recordNameFor(named: RecordName | null, pathname: string): string | null {
  return named && named.name.trim() && bare(named.pathname) === bare(pathname) ? named.name : null
}

/** Names the record this page is open on (null: not known yet), for as long as the page is open at this address. */
export function useRecordName(name: string | null | undefined): void {
  const { pathname } = useLocation()
  useEffect(() => {
    if (!name) return
    const named = { pathname, name }
    useRecordNameStore.setState({ named })
    return () => {
      if (useRecordNameStore.getState().named === named) useRecordNameStore.setState({ named: null })
    }
  }, [pathname, name])
}
