import { useCallback, useEffect, useMemo, useState } from 'react'
import { useUrlQuery } from '@/core/ui/use-url-query'
import { localToday, type LocalDate } from '@/core/util/date-window'
import {
  pressRead,
  windowOf,
  windowRead,
  type DayWindow,
  type MovementsState,
  type MovementsUrl,
  type WindowRead,
  type WindowSpec,
} from './movements'

/** A movements tab's window, as `WindowBar` draws it: the address's state, the two day boxes, and the button. */
export interface Movements {
  spec: WindowSpec
  state: MovementsState
  /** The reader's local day, taken once while the tab is open. */
  today: LocalDate
  /** Whether the tab reads, and which window — or why not (`windowRead`). */
  decision: WindowRead
  /** The day boxes as typed: drafts until the button. */
  boxes: DayWindow
  setBox: (box: keyof DayWindow, value: string) => void
  /** The button. False when it asks the window already shown: the address does not change, so the caller re-reads. */
  press: () => boolean
  /** Any other change to the address (a SAP row opened or closed, a page). */
  update: (change: (prev: MovementsState) => MovementsState) => void
}

/**
 * A movements tab's window in the address (`./movements`, pure and tested) with the day boxes as drafts beside it. The
 * boxes start on the address's window, or the default; they reset when the address changes from outside (Back, a
 * pasted link). Pass module-level `url` and `spec`.
 */
export function useMovements(url: MovementsUrl, spec: WindowSpec): Movements {
  const today = useMemo(() => localToday(), [])
  const { query, update, changedFromOutside } = useUrlQuery(url.fromParams, url.toParams)
  const [boxes, setBoxes] = useState<DayWindow>(() => windowOf(query, spec, today))

  useEffect(() => {
    if (changedFromOutside()) setBoxes(windowOf(query, spec, today))
  }, [query, changedFromOutside, spec, today])

  const setBox = useCallback((box: keyof DayWindow, value: string) => setBoxes((b) => ({ ...b, [box]: value })), [])

  const press = () => {
    const next = pressRead(query, boxes)
    if (url.toParams(next).toString() === url.toParams(query).toString()) return false
    update((prev) => pressRead(prev, boxes))
    return true
  }

  return { spec, state: query, today, decision: windowRead(query, spec, today), boxes, setBox, press, update }
}
