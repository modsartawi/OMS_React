import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useLocation, useSearchParams } from 'react-router'

/**
 * A screen's query kept in the URL (graduated from the Material search's pattern at ticket 463,
 * the SAP export fleet's second use of it; the Material search keeps its own copy until a ticket
 * moves it, so a shipped screen is not reworked under another slice). The query is READ from the address every render and
 * every change is WRITTEN back to it — replace, not push, so Back leaves the screen rather than
 * stepping through each filter tweak.
 *
 * ⚠️ A write reaches the address only once the router's navigation lands, which is async: two
 * quick changes composed against the rendered query would each start from the SAME old URL and
 * the second would undo the first. So every change is an UPDATER applied to the latest query
 * written, and the echoes still awaited are remembered so that only a change from outside (Back,
 * a pasted link) resets it. The echoes are settled per LANDED navigation (the location's key), so
 * a burst whose last write returns to the URL already shown still clears them.
 *
 * A page that keeps a draft beside the URL asks `changedFromOutside()` from its own effect on the
 * query: the hook's effect is declared first, so it has already settled this render's change and
 * recorded whether it was an echo of the page's own write (keep the draft — keys typed while it was
 * landing are in it) or a change from outside (reset the draft). Asking "is an echo still awaited?"
 * there would always answer no: the settle has just cleared it.
 *
 * `fromParams` / `toParams` must be stable (module-level functions): they are the screen's pure,
 * tested reading of its URL. `toParams(fromParams(url))` is the canonical form compared.
 */
export function useUrlQuery<Q>(
  fromParams: (params: URLSearchParams) => Q,
  toParams: (query: Q) => URLSearchParams,
): { query: Q; update: (change: (prev: Q) => Q) => void; changedFromOutside: () => boolean } {
  const [params, setParams] = useSearchParams()
  const { key } = useLocation()
  const query = useMemo(() => fromParams(params), [fromParams, params])
  const queryString = toParams(query).toString()

  const latest = useRef(query)
  const echoes = useRef<string[]>([])
  const outside = useRef(true)
  useEffect(() => {
    const mine = echoes.current.indexOf(queryString)
    outside.current = mine < 0
    if (mine >= 0) echoes.current.splice(0, mine + 1)
    else {
      echoes.current = []
      latest.current = query
    }
    // `key` is a dependency on purpose: a navigation that lands on the same query string must
    // still settle the echoes written before it.
  }, [key, queryString, query])

  const update = useCallback(
    (change: (prev: Q) => Q) => {
      const prev = latest.current
      const next = change(prev)
      const qs = toParams(next).toString()
      if (qs === toParams(prev).toString()) return
      latest.current = next
      echoes.current.push(qs)
      setParams(new URLSearchParams(qs), { replace: true })
    },
    [setParams, toParams],
  )

  const changedFromOutside = useCallback(() => outside.current, [])
  return { query, update, changedFromOutside }
}
