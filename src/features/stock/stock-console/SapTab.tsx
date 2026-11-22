import { useCallback, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import type { StockConsoleSapDay, StockConsoleSapMovements } from '@/core/models/stock-console'
import Button from '@/core/ui/Button'
import Ltr from '@/core/ui/Ltr'
import { formatDateTime, formatDay } from '@/core/util/date-format'
import { sapLinesQuery, sapMovementsQuery } from './api'
import HowRead from './HowRead'
import { HOW_SAP } from './how-sections'
import ListGrid from './ListGrid'
import Loading from './Loading'
import { SAP_URL, SAP_WINDOW, closeLines, goToMovementsPage, movementsView, openLines } from './movements'
import PagedList from './PagedList'
import RefusalBanner from './RefusalBanner'
import { buildSapDayColumns, buildSapLineColumns, sapDayRowId, sapLineRowId } from './sap-columns'
import { useMovements, type Movements } from './use-movements'
import WindowBar from './WindowBar'

/**
 * A store's SAP movements tab (oms 945, spec 4157 stories 43–48). Nothing is read on opening: SAP is asked only by
 * **Read SAP**, for at most 5 entry days (yesterday and today to begin with). Above the answer, where our SAP feed stands
 * for the store; then SAP's documents by entry day and movement type. A row opens its lines below, paged, each marked
 * against our copy. "SAP is not connected on this host" and "SAP could not be reached" are their own sentences
 * (`./refusals`), never an empty list.
 */
export default function SapTab({ store }: { store: string }) {
  const { t } = useTranslation('stock-console')
  const movements = useMovements(SAP_URL, SAP_WINDOW)
  const { state, decision } = movements
  const read = useQuery(sapMovementsQuery(store, decision))
  const answer = read.isError ? undefined : read.data
  const view = movementsView(decision, {
    isPending: read.isPending,
    isError: read.isError,
    error: read.error,
    rows: answer?.days.length,
  })

  const openHref = useCallback(
    (row: StockConsoleSapDay) => `?${SAP_URL.toParams(openLines(state, row)).toString()}`,
    [state],
  )
  const columns = useMemo(
    () => buildSapDayColumns(t, openHref, { day: state.sapDay, type: state.sapType }),
    [t, openHref, state.sapDay, state.sapType],
  )
  const opened = state.sapDay !== '' && state.sapType !== ''

  return (
    <div className="flex min-w-0 flex-col gap-3" data-sap-tab={store} data-sap-view={view.kind}>
      <WindowBar ns="sap" movements={movements} read={read} />
      {view.kind === 'loading' && <Loading label={t('sap.loading')} />}
      {view.kind === 'refused' && <RefusalBanner error={read.error} />}
      {answer && (view.kind === 'empty' || view.kind === 'rows') && <SapPlace answer={answer} />}
      {view.kind === 'empty' && (
        <p className="py-6 text-center text-sm text-muted-foreground" data-list-empty="sap">
          {t('sap.empty')}
        </p>
      )}
      {view.kind === 'rows' && answer && (
        <ListGrid rows={answer.days} columns={columns} rowId={sapDayRowId} name="sap-days" />
      )}
      {view.kind === 'rows' && opened && <SapLines store={store} movements={movements} />}
      <HowRead section="sap" paragraphs={HOW_SAP} />
    </div>
  )
}

/** Where our SAP feed stands for the store — so "SAP has nothing new" reads apart from "we are behind" — and the read's time. */
function SapPlace({ answer }: { answer: StockConsoleSapMovements }) {
  const { t } = useTranslation('stock-console')
  const time = (at: string | null) => (at ? <Ltr>{formatDateTime(at)}</Ltr> : t('store.never'))
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-md border border-border/60 px-3 py-2 text-sm" data-sap-place="">
      <span className="flex flex-wrap gap-x-2">
        <span className="text-muted-foreground">{t('sap.place')}</span>
        <span className="font-mono">{time(answer.place.sapPlace)}</span>
      </span>
      <span className="flex flex-wrap gap-x-2">
        <span className="text-muted-foreground">{t('sap.lastAttempt')}</span>
        <span className="font-mono">{time(answer.place.lastAttempt)}</span>
      </span>
      {answer.readAt && (
        <span className="ms-auto text-xs text-muted-foreground">
          <Trans t={t} i18nKey="sap.readAt" values={{ at: formatDateTime(answer.readAt) }} components={{ t: <Ltr /> }} />
        </span>
      )}
    </div>
  )
}

/** An opened row's lines, read from SAP a page at a time, each with our mark. */
function SapLines({ store, movements }: { store: string; movements: Movements }) {
  const { t, i18n } = useTranslation('stock-console')
  const { state, decision, update } = movements
  const read = useQuery(sapLinesQuery(store, decision, state))
  const page = read.isError ? undefined : read.data
  const view = movementsView(decision, { isPending: read.isPending, isError: read.isError, error: read.error, rows: page?.total })
  const columns = useMemo(() => buildSapLineColumns(t, i18n.language, store), [t, i18n.language, store])

  return (
    <section className="flex min-w-0 flex-col gap-2 rounded-md border border-border/60 p-3" data-sap-lines={`${state.sapDay}|${state.sapType}`}>
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-medium">
          <Trans
            t={t}
            i18nKey="sap.lines.title"
            values={{ day: formatDay(state.sapDay), type: state.sapType }}
            components={{ v: <Ltr /> }}
          />
        </h3>
        <Button variant="text" className="ms-auto" onClick={() => update(closeLines)} data-sap-lines-close="">
          {t('sap.lines.close')}
        </Button>
      </div>
      {view.kind === 'loading' && <Loading label={t('sap.lines.loading')} />}
      {view.kind === 'refused' && <RefusalBanner error={read.error} />}
      {view.kind === 'empty' && (
        <p className="py-6 text-center text-sm text-muted-foreground" data-list-empty="sap-lines">
          {t('sap.lines.empty')}
        </p>
      )}
      {view.kind === 'rows' && page && (
        <PagedList
          name="sap-lines"
          rows={page.rows}
          total={page.total}
          page={state.page}
          busy={read.isFetching || read.isPlaceholderData}
          onPage={(n) => update((s) => goToMovementsPage(s, n))}
          columns={columns}
          rowId={sapLineRowId}
        />
      )}
    </section>
  )
}
