import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import type { GridApi } from 'ag-grid-community'
import { FileSpreadsheet, Loader2 } from 'lucide-react'
import { apiErrorMessage } from '@/core/api'
import type { StockConsoleExpiryFallbackRow } from '@/core/models/stock-console'
import { notify } from '@/core/services/notify'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Field from '@/core/ui/Field'
import Input from '@/core/ui/Input'
import Ltr from '@/core/ui/Ltr'
import ScreenGate from '@/core/ui/ScreenGate'
import { useUrlQuery } from '@/core/ui/use-url-query'
import { fsi } from '@/core/util/bidi'
import { formatDay } from '@/core/util/date-format'
import { localToday } from '@/core/util/date-window'
import { gridSheet, writeWorkbook, xlsxFileName } from '@/core/util/grid-xlsx'
import { formatFigure } from '@/core/util/number-format'
import { canOpenStockConsole } from './access'
import { fallbackListQuery } from './api'
import ConsoleNav from './ConsoleNav'
import {
  FALLBACK_MOST_DAYS,
  FALLBACK_TEXT_COLUMNS,
  fallbackBoxes,
  fallbackListFromParams,
  fallbackListPress,
  fallbackListRead,
  fallbackListToParams,
} from './fallback-list'
import { buildFallbackListColumns, fallbackRowId } from './fallback-list-columns'
import ListGrid from './ListGrid'

/**
 * Expiry fallback takes (BackOffice 4277, spec 4275 "What head office sees", ADR 0146) — `/stock/console/fallback`, a
 * console page behind the console's one grant (`StockConsole:03`). Read-only.
 *
 * Inventory control's list: a store's takes the expiry fallback placed over a range of days (at most 32), by material, the
 * pack's own vendor batch and the batch the door chose, with takes and units, so the counted stock can be moved to its own
 * batch. Nothing is read before Read; a range the server would refuse is stopped here with its sentence. The grid exports
 * to Excel as shown.
 */
export default function FallbackPage() {
  const { t } = useTranslation('stock-console')
  return (
    <ScreenGate can={canOpenStockConsole} ns="stock-console" title={t('title')} subtitle={t('subtitle')}>
      <FallbackList />
    </ScreenGate>
  )
}

function FallbackList() {
  const { t, i18n } = useTranslation('stock-console')
  const { query: state, update, changedFromOutside } = useUrlQuery(fallbackListFromParams, fallbackListToParams)
  // The reader's local day, taken once while the page is open: the boxes' default and the last day allowed.
  const today = useMemo(() => localToday(), [])
  const [boxes, setBoxes] = useState(() => fallbackBoxes(state, today))
  // Review O5: Back or a pasted link resets the boxes to the address; the page's own Read keeps them.
  useEffect(() => {
    if (changedFromOutside()) setBoxes(fallbackBoxes(state, today))
  }, [state, today, changedFromOutside])
  const decision = fallbackListRead(state, today)
  const read = useQuery(fallbackListQuery(decision))
  const data = decision.kind === 'read' ? read.data : undefined
  const store = decision.kind === 'read' ? decision.store : ''
  const columns = useMemo(() => buildFallbackListColumns(t, i18n.language, store), [t, i18n.language, store])
  const gridApi = useRef<GridApi<StockConsoleExpiryFallbackRow> | null>(null)
  const onApi = useCallback((api: GridApi<StockConsoleExpiryFallbackRow> | null) => {
    gridApi.current = api
  }, [])

  // Review O1: Read on the list already shown writes the same address, which reads nothing: re-read it instead.
  const press = () => {
    const { next, same } = fallbackListPress(state, boxes)
    if (same) {
      if (decision.kind === 'read') void read.refetch()
      return
    }
    update(() => next)
  }

  async function exportXlsx() {
    const api = gridApi.current
    if (!api || !data || data.rows.length === 0) return
    try {
      const sheet = gridSheet(api, t('fallback.sheet'), { asText: (colId) => FALLBACK_TEXT_COLUMNS.has(colId) })
      await writeWorkbook(
        [sheet],
        xlsxFileName(`${t('fallback.fileName')}-${data.store}-${formatDay(data.from)}-${formatDay(data.to)}`),
      )
      notify.success(t('fallback.export.done'), t('fallback.export.doneDetail', { count: sheet.count, n: fsi(String(sheet.count)) }))
    } catch {
      notify.error(t('fallback.export.failed'), t('fallback.export.failedDetail'))
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-4" data-console-fallback="">
      <ConsoleNav />
      <p className="text-sm text-muted-foreground">{t('fallback.lead')}</p>
      <form
        className="flex flex-wrap items-end gap-3 rounded-lg border border-border/60 bg-card p-3"
        onSubmit={(e) => {
          e.preventDefault()
          press()
        }}
        data-fallback-form=""
      >
        <Field label={t('fallback.store')}>
          <Input
            type="text"
            value={boxes.store}
            onChange={(e) => setBoxes((b) => ({ ...b, store: e.target.value }))}
            className="w-28"
            data-fallback-box="store"
          />
        </Field>
        <Field label={t('fallback.from')}>
          <Input
            type="date"
            value={boxes.from}
            max={today}
            onChange={(e) => setBoxes((b) => ({ ...b, from: e.target.value }))}
            className="w-fit"
            data-fallback-box="from"
          />
        </Field>
        <Field label={t('fallback.to')}>
          <Input
            type="date"
            value={boxes.to}
            max={today}
            onChange={(e) => setBoxes((b) => ({ ...b, to: e.target.value }))}
            className="w-fit"
            data-fallback-box="to"
          />
        </Field>
        <Button type="submit" variant="secondary" data-fallback-read="">
          {read.isFetching ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
          {t('fallback.read')}
        </Button>
        <Button
          variant="outlined"
          disabled={!data || data.rows.length === 0}
          onClick={() => void exportXlsx()}
          data-fallback-export=""
        >
          <FileSpreadsheet className="h-3.5 w-3.5" aria-hidden />
          {t('fallback.export.button')}
        </Button>
      </form>

      {decision.kind === 'stopped' && (
        <p className="text-sm text-destructive" data-fallback-stopped={decision.problem}>
          {t(`fallback.problem.${decision.problem}`, { most: fsi(String(FALLBACK_MOST_DAYS)) })}
        </p>
      )}
      {decision.kind === 'nothing' && <p className="text-sm text-muted-foreground">{t('fallback.nothingYet')}</p>}
      {decision.kind === 'read' && read.isError && (
        <ErrorBanner className="p-2.5" title={t('fallback.failedTitle')} message={apiErrorMessage(read.error, t('fallback.failed'))} />
      )}
      {decision.kind === 'read' && read.isPending && <p className="text-sm text-muted-foreground">{t('fallback.loading')}</p>}

      {data && (
        <section className="flex min-w-0 flex-col gap-2" data-fallback-list={data.store}>
          <p className="text-sm" data-fallback-totals={`${data.takes}/${data.quantity}`}>
            <Trans
              t={t}
              i18nKey="fallback.totals"
              count={data.takes}
              values={{
                store: data.store,
                from: formatDay(data.from),
                to: formatDay(data.to),
                n: formatFigure(data.takes),
                units: formatFigure(data.quantity),
              }}
              components={{ s: <Ltr />, d: <Ltr />, n: <Ltr /> }}
            />
          </p>
          {data.rows.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground" data-fallback-empty="">
              {t('fallback.empty')}
            </p>
          ) : (
            <ListGrid
              rows={data.rows}
              columns={columns}
              rowId={fallbackRowId}
              name="fallback"
              onApi={onApi}
            />
          )}
        </section>
      )}
    </div>
  )
}
