import { useCallback, useEffect, useState } from 'react'
import { useUrlQuery } from '@/core/ui/use-url-query'
import {
  choose,
  clearSearch,
  emptyBoxes,
  goToPage,
  listUrl,
  sameSearch,
  submitSearch,
  type ListSpec,
  type SearchBoxes,
  type SearchState,
} from './search'

/** A list's search, as `SearchFrame` draws it: the address's state, the boxes being typed, and what the frame does. */
export interface ListSearch {
  spec: ListSpec
  /** What the address says — what the list reads (`listQuery(…, state, …)`). */
  state: SearchState
  /** The boxes as typed: drafts until Search. */
  boxes: SearchBoxes
  setBox: (box: keyof SearchBoxes, value: string) => void
  /** The list's own drafts (Takes' day, 942), by the spec's `extras` names. */
  extras: Record<string, string>
  setExtra: (name: string, value: string) => void
  /** Search, or Enter in a box. False when it is the search already shown: the address does not change, so the
   *  caller re-reads (`SearchFrame` does). */
  search: () => boolean
  clear: () => void
  choose: (change: { filter?: string; sort?: string }) => void
  goToPage: (page: number) => void
}

const boxesOf = (s: SearchState): SearchBoxes => ({ item: s.item, batch: s.batch, gs1: s.gs1 })

/**
 * The search-first frame's state in the address (`./search`, pure and tested) with the boxes as drafts beside it. The
 * boxes reset when the address changes from outside (Back, a pasted link) and are kept while the page's own write lands.
 * Pass a module-level `spec`.
 */
export function useListSearch(spec: ListSpec): ListSearch {
  const { fromParams, toParams } = listUrl(spec)
  const { query, update, changedFromOutside } = useUrlQuery(fromParams, toParams)
  const [boxes, setBoxes] = useState<SearchBoxes>(() => boxesOf(query))
  const [extras, setExtras] = useState<Record<string, string>>(() => query.extras)

  useEffect(() => {
    if (!changedFromOutside()) return
    setBoxes(boxesOf(query))
    setExtras(query.extras)
  }, [query, changedFromOutside])

  const setBox = useCallback((box: keyof SearchBoxes, value: string) => setBoxes((b) => ({ ...b, [box]: value })), [])
  const setExtra = useCallback((name: string, value: string) => setExtras((e) => ({ ...e, [name]: value })), [])

  return {
    spec,
    state: query,
    boxes,
    setBox,
    extras,
    setExtra,
    search: () => {
      if (sameSearch(query, submitSearch(query, boxes, extras), spec)) return false
      update((q) => submitSearch(q, boxes, extras))
      return true
    },
    clear: () => {
      setBoxes(emptyBoxes())
      setExtras({})
      update((q) => clearSearch(q, spec))
    },
    choose: (change) => update((q) => choose(q, change, spec)),
    goToPage: (page) => update((q) => goToPage(q, page)),
  }
}
