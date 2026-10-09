import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type {
  GridApi,
  IRowNode,
  RowSelectionOptions,
  SelectionChangedEvent,
  SelectionEventSourceType,
} from 'ag-grid-community'
import { notify } from '@/core/services/notify'
import { fsi } from '@/core/util/bidi'
import { SELECTION_CAP, selectionCap } from './control-helpers'
import { figure } from './helpers'

/** Checkboxes only: a click on a row is not a selection, so a link or button in it stays plain. */
export const CHECKBOX_SELECTION: RowSelectionOptions = {
  mode: 'multiRow',
  checkboxes: true,
  headerCheckbox: true,
  enableClickSelection: false,
}

/** The selection changes a person makes; the grid's own (a data refresh, our re-sync) are ignored. */
const USER_SELECTION: ReadonlySet<SelectionEventSourceType> = new Set<SelectionEventSourceType>([
  'checkboxSelected',
  'rowClicked',
  'spaceKey',
  'keyboardSelectAll',
  'uiSelectAll',
  'uiSelectAllFiltered',
  'uiSelectAllCurrentPage',
])

/** Makes the checkboxes show the kept selection — on a new page, after a refresh, after a refusal. */
function showSelection<T>(api: GridApi<T>, selected: readonly string[], idOf: (row: T) => string) {
  const want = new Set(selected)
  const on: IRowNode<T>[] = []
  const off: IRowNode<T>[] = []
  api.forEachNode((n) => {
    if (!n.data) return
    const should = want.has(idOf(n.data))
    if (should !== !!n.isSelected()) (should ? on : off).push(n)
  })
  if (on.length) api.setNodesSelected({ nodes: on, newValue: true, source: 'api' })
  if (off.length) api.setNodesSelected({ nodes: off, newValue: false, source: 'api' })
}

/**
 * A grid's selection of up to 50 rows, kept as ids (not rows) so it outlives a page,
 * a filter and a refresh — the Fleet table's (ticket 447), shared with the Sync
 * pending list's Dismiss (449). The 51st tick and on are refused through 447's ONE
 * cap (`selectionCap`), with its message, and taken back at once.
 *
 * `idOf` must be stable (a module-level function). Spread `gridProps` on the grid.
 */
export function useCappedSelection<T>(idOf: (row: T) => string) {
  const { t } = useTranslation('sync-console')
  const [selected, setSelected] = useState<string[]>([])
  const selectedRef = useRef(selected)
  selectedRef.current = selected
  const gridApi = useRef<GridApi<T> | null>(null)

  // A change of selection (a clear, an answered control) reaches the checkboxes here;
  // a new page or a refresh reaches them through `onRowDataUpdated`.
  useEffect(() => {
    if (gridApi.current) showSelection(gridApi.current, selected, idOf)
  }, [selected, idOf])

  const onSelectionChanged = useCallback(
    (e: SelectionChangedEvent<T>) => {
      if (!USER_SELECTION.has(e.source)) return
      const onPage = new Set<string>()
      e.api.forEachNode((n) => n.data && onPage.add(idOf(n.data)))
      const pagePicked = e.api.getSelectedRows().map(idOf)
      // Off this page the selection stands; on it, the checkboxes say what is wanted.
      const wanted = [...selectedRef.current.filter((c) => !onPage.has(c)), ...pagePicked]
      const next = selectionCap(selectedRef.current, wanted)
      if (next.messageKey) notify.warn(t(next.messageKey, { cap: fsi(figure(SELECTION_CAP)) }))
      selectedRef.current = next.codes
      setSelected(next.codes)
      // A refused tick is un-ticked at once, even when the kept selection did not change.
      if (next.refused > 0) showSelection(e.api, next.codes, idOf)
    },
    [t, idOf],
  )

  const gridProps = {
    onGridReady: (e: { api: GridApi<T> }) => {
      gridApi.current = e.api
      showSelection(e.api, selectedRef.current, idOf)
    },
    onGridPreDestroyed: () => {
      gridApi.current = null
    },
    onRowDataUpdated: (e: { api: GridApi<T> }) => showSelection(e.api, selectedRef.current, idOf),
    onSelectionChanged,
  }

  return { selected, setSelected, gridProps }
}
