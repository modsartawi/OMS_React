import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { itemMovementsQuery } from './api'
import HowRead from './HowRead'
import { HOW_MOVEMENTS } from './how-sections'
import type { ItemTabProps } from './ItemTabPanels'
import Loading from './Loading'
import { LEDGER_URL, LEDGER_WINDOW, goToMovementsPage, movementsView } from './movements'
import { buildLedgerColumns, ledgerRowId } from './movements-columns'
import PagedList from './PagedList'
import RefusalBanner from './RefusalBanner'
import { useMovements } from './use-movements'
import WindowBar from './WindowBar'

/**
 * An item's Movements tab (oms 945, spec 4157 stories 60–61): our own ledger's lines for the item at the store. Nothing
 * is read on opening — the ledger is the largest table — only by **Read**, for at most 7 days (the last 7 to begin
 * with). Newest first, 25 a page: time, feed, movement type, quantity, batch, document, and the effect on each counter.
 */
export default function MovementsTab({ store, item }: ItemTabProps) {
  const { t } = useTranslation('stock-console')
  const movements = useMovements(LEDGER_URL, LEDGER_WINDOW)
  const { state, decision, update } = movements
  const read = useQuery(itemMovementsQuery(store, item, decision, state.page))
  const page = read.isError ? undefined : read.data
  const view = movementsView(decision, { isPending: read.isPending, isError: read.isError, error: read.error, rows: page?.total })
  const columns = useMemo(() => buildLedgerColumns(t), [t])

  return (
    <div className="flex min-w-0 flex-col gap-3" data-movements-tab={item} data-movements-view={view.kind}>
      <WindowBar ns="movements" movements={movements} read={read} />
      {view.kind === 'loading' && <Loading label={t('movements.loading')} />}
      {view.kind === 'refused' && <RefusalBanner error={read.error} />}
      {view.kind === 'empty' && (
        <p className="py-6 text-center text-sm text-muted-foreground" data-list-empty="movements">
          {t('itemTabs.empty.movements')}
        </p>
      )}
      {view.kind === 'rows' && page && (
        <PagedList
          name="movements"
          rows={page.rows}
          total={page.total}
          page={state.page}
          busy={read.isFetching || read.isPlaceholderData}
          onPage={(n) => update((s) => goToMovementsPage(s, n))}
          columns={columns}
          rowId={ledgerRowId}
        />
      )}
      <HowRead section="movements" paragraphs={HOW_MOVEMENTS} />
    </div>
  )
}
