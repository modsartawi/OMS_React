import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { StockConsoleScan } from '@/core/models/stock-console'
import { scanQuery } from './api'
import { applyScan, scanCode, scanFrameRead, scannedList } from './scan'
import ScanChips from './ScanChips'
import type { SearchState } from './search'
import type { FrameQuery, SearchFrameProps } from './SearchFrame'
import type { ListSearch } from './use-list-search'

/** A list's GS1 box, as `useScan` hands it to the list and its frame. */
export interface ListScan {
  /** The state the list reads — pass it to the list's query in place of `search.state`. */
  state: SearchState
  /** The scan's answer for the address's code, once read (the Batches expiry mark compares against it). */
  answer: StockConsoleScan | null
  /** The frame's GS1 props: the box, the chips above the rows, and the list's read with the scan's in front of it. */
  frame: (read: FrameQuery) => Pick<SearchFrameProps, 'gs1' | 'read' | 'aboveRows' | 'stopped'>
}

/**
 * The third box of the search-first frame (oms 944, spec 4157 "GS1"), for any list of the console. Search with the
 * GS1 box filled reads `StockConsole/Scan`, then the list searches the item and the vendor batch it answered; the item
 * and batch boxes are filled from it and shown. The code stays in the address with the other boxes.
 *
 * ```tsx
 * const search = useListSearch(SPEC)
 * const scan = useScan(search)
 * const read = useQuery(xQuery(store, scan.state))
 * <SearchFrame … {...scan.frame(read)}>
 * ```
 */
export function useScan(search: ListSearch): ListScan {
  const code = scanCode(search.state)
  const scan = useQuery(scanQuery(code))
  const answer = code !== '' ? (scan.data ?? null) : null
  const { setBox } = search

  // The GS1 box wins: once it answered, the item and batch boxes show what it searches. A code we do not know leaves
  // them as they are. Again on each address change, since the boxes reset to the address's when it changes from outside.
  useEffect(() => {
    if (!answer) return
    const read = applyScan(answer)
    if (!read.search) return
    setBox('item', read.item)
    setBox('batch', read.batch)
  }, [answer, search.state, setBox])

  return {
    state: scannedList(search.state, answer ?? undefined),
    answer,
    frame: (read) => {
      const withScan = scanFrameRead(search.state, scan, read)
      return {
        gs1: true,
        read: withScan,
        stopped: withScan.stopped,
        aboveRows: answer ? <ScanChips scan={answer} /> : undefined,
      }
    },
  }
}
