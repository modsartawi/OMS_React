import { useMemo, useRef, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { AgGridReact } from 'ag-grid-react'
import type { GridApi } from 'ag-grid-community'
import { Download, Loader2 } from 'lucide-react'

// Side-effect import: registers the AG Grid Community modules in this lazy chunk.
import '@/core/ag-grid-setup'
import { apiErrorCode, apiErrorMessage, isBareDenial } from '@/core/api'
import { SERVING_LIST_ERRORS, type ServingListChangeRow } from '@/core/models/serving-list'
import { notify } from '@/core/services/notify'
import { OMS_GRID_HEADER_HEIGHT, OMS_GRID_ROW_HEIGHT, omsGridTheme } from '@/core/theme/ag-grid-theme'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import { fsi } from '@/core/util/bidi'
import { gridSheet, writeWorkbook, xlsxFileName } from '@/core/util/grid-xlsx'
import { formatFigure } from '@/core/util/number-format'
import { changesQuery } from './api'
import { changeActionKey } from './change-row'
import { HISTORY_DEFAULT_COL_DEF, buildHistoryColumns } from './history-columns'
import {
  CHANGES_MAX_TAKE,
  CHANGES_TAKE,
  EMPTY_CHANGES_FILTER,
  actionOptions,
  canShowMore,
  filterChanges,
  isFilteredChanges,
  nextTake,
  type ChangesFilter,
} from './history-filter'
import { DeniedCard, NotFoundCard } from './StateCards'
import Field from '@/core/ui/Field'
import Input from '@/core/ui/Input'
import Select from '@/core/ui/Select'

export interface HistoryTabProps {
  servingListId: string
}

/** A long log is one read (no cursor), paged by the grid. */
const HISTORY_PAGE_SIZE = 50

/**
 * The History tab (oms ticket 571, BackOffice spec 3042 stories 39-40): `GET ServingListWeb/Lists/{id}/Changes?take=`,
 * every change newest first — when, who, the action in words, the store, a create's / rename's names, the
 * note. The log is append-only and read-only: there is no undo here.
 *
 * - The filters (action, store code) are client-side, over the rows read, held in local state.
 * - "Show more" asks again with a larger `take` (200 at a time, the door's 1000 at most): there is no cursor.
 * - Export writes the grid as it stands (filtered, sorted) through `core/util/grid-xlsx`.
 * - An unknown id (`SVL-00001`) reads "This serving list does not exist"; a bare 403 "You do not have access".
 */
export default function HistoryTab({ servingListId }: HistoryTabProps) {
  const { t } = useTranslation('serving-lists')
  const [take, setTake] = useState(CHANGES_TAKE)
  const [filter, setFilter] = useState<ChangesFilter>(EMPTY_CHANGES_FILTER)
  const changes = useQuery(changesQuery(servingListId, take))
  const columns = useMemo(() => buildHistoryColumns(t), [t])
  const grid = useRef<GridApi<ServingListChangeRow> | null>(null)

  const all = changes.data
  const rows = useMemo(() => (all ? filterChanges(all, filter) : []), [all, filter])
  const options = useMemo(() => actionOptions(all ?? []), [all])

  const unknownList = changes.isError && apiErrorCode(changes.error) === SERVING_LIST_ERRORS.UnknownList
  const refused = changes.isError && isBareDenial(changes.error)
  // A larger `take` keeps the shown rows (placeholder) while it reads; the button waits for it.
  const growing = changes.isFetching && changes.isPlaceholderData

  async function exportXlsx() {
    const api = grid.current
    if (!api) return
    try {
      const sheet = gridSheet(api, t('history.export.sheet'), { asText: (id) => id === 'storeCode' || id === 'changedBy' })
      await writeWorkbook([sheet], xlsxFileName(t('history.export.fileName')))
      notify.success(t('history.export.done'), t('history.export.doneDetail', { count: sheet.count, n: fsi(formatFigure(sheet.count)) }))
    } catch {
      notify.error(t('history.export.failed'), t('history.export.failedDetail'))
    }
  }

  let body: ReactNode
  if (unknownList) {
    body = <NotFoundCard servingListId={servingListId} />
  } else if (refused) {
    body = <DeniedCard hook="history-denied" />
  } else if (changes.isError) {
    body = <ErrorBanner className="p-3" message={apiErrorMessage(changes.error, t('history.failed'))} />
  } else if (!all) {
    body = (
      <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground" role="status">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        {t('history.loading')}
      </div>
    )
  } else if (all.length === 0) {
    body = (
      <p className="rounded-md border border-border/60 py-6 text-center text-sm text-muted-foreground" data-history-empty="list">
        {t('history.empty')}
      </p>
    )
  } else {
    const more = canShowMore(all.length, take)
    body = (
      <div className="flex min-w-0 flex-col gap-2">
        <p className="text-xs text-muted-foreground" data-history-count={rows.length} data-history-total={all.length}>
          {isFilteredChanges(filter) ? (
            <Trans
              t={t}
              i18nKey="history.matching"
              count={all.length}
              values={{ n: formatFigure(rows.length), total: formatFigure(all.length) }}
              components={{ v: <Ltr /> }}
            />
          ) : (
            <Trans t={t} i18nKey="history.count" count={all.length} values={{ n: formatFigure(all.length) }} components={{ v: <Ltr /> }} />
          )}
        </p>
        {rows.length === 0 ? (
          <p className="rounded-md border border-border/60 py-6 text-center text-sm text-muted-foreground" data-history-empty="filtered">
            {t('history.noMatch')}
          </p>
        ) : (
          <div className="overflow-hidden rounded-md border border-border/60" data-history-grid="">
            <AgGridReact<ServingListChangeRow>
              theme={omsGridTheme}
              rowData={rows}
              columnDefs={columns}
              defaultColDef={HISTORY_DEFAULT_COL_DEF}
              getRowId={({ data }) => data.changeId}
              rowHeight={OMS_GRID_ROW_HEIGHT}
              headerHeight={OMS_GRID_HEADER_HEIGHT}
              domLayout="autoHeight"
              tooltipShowDelay={500}
              animateRows={false}
              suppressColumnVirtualisation
              pagination
              paginationPageSize={HISTORY_PAGE_SIZE}
              paginationPageSizeSelector={false}
              onGridReady={(e) => (grid.current = e.api)}
            />
          </div>
        )}
        <div className="flex flex-wrap items-center gap-3">
          {more && (
            <Button variant="secondary" disabled={growing} onClick={() => setTake(nextTake(take))} data-history-more="">
              {growing && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
              {t('history.showMore')}
            </Button>
          )}
          {take >= CHANGES_MAX_TAKE && all.length >= CHANGES_MAX_TAKE && (
            <p className="text-xs text-muted-foreground" data-history-at-max="">
              <Trans t={t} i18nKey="history.atMax" values={{ n: formatFigure(CHANGES_MAX_TAKE) }} components={{ v: <Ltr /> }} />
            </p>
          )}
          <p className="text-xs text-muted-foreground">{t('history.readOnly')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-w-0 flex-col gap-3" data-history-tab="">
      <div className="flex flex-wrap items-end gap-2">
        <Filters filter={filter} options={options} onChange={setFilter} />
        <Button variant="ghost" className="ms-auto" disabled={rows.length === 0} onClick={() => void exportXlsx()} data-history-export="">
          <Download className="h-3.5 w-3.5" aria-hidden />
          {t('history.export.button')}
        </Button>
      </div>
      {body}
    </div>
  )
}

/** Client-side, so each change applies at once (no Apply): the rows are already read. */
function Filters({ filter, options, onChange }: { filter: ChangesFilter; options: string[]; onChange: (f: ChangesFilter) => void }) {
  const { t } = useTranslation('serving-lists')
  return (
    <div className="flex flex-wrap items-end gap-2" data-history-filters="">
      <Field label={t('history.filters.action')}>
        <Select value={filter.action} onChange={(e) => onChange({ ...filter, action: e.target.value })} data-filter="action">
          <option value="">{t('history.filters.any')}</option>
          {options.map((a) => {
            const key = changeActionKey(a)
            return (
              <option key={a} value={a}>
                {/* A native option is a string-only sink: an unknown action's raw value takes `fsi`. */}
                {key ? t(key) : fsi(a)}
              </option>
            )
          })}
        </Select>
      </Field>
      <Field label={t('history.filters.store')}>
        <Input
          type="search"
          value={filter.store}
          onChange={(e) => onChange({ ...filter, store: e.target.value })}
          placeholder={t('history.filters.storePlaceholder')}
          dir="ltr"
          wrapperClassName="w-36 font-mono"
          data-filter="store"
        />
      </Field>
      {isFilteredChanges(filter) && (
        <Button type="button" variant="text" onClick={() => onChange(EMPTY_CHANGES_FILTER)} data-filter-clear="">
          {t('history.filters.clear')}
        </Button>
      )}
    </div>
  )
}
