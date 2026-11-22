import { useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { TAKE_OUTCOMES } from '@/core/models/stock-console'
import Input from '@/core/ui/Input'
import { localToday } from '@/core/util/date-window'
import { takesQuery } from './api'
import HowRead from './HowRead'
import { HOW_TAKES } from './how-sections'
import ListGrid from './ListGrid'
import type { ListSpec } from './search'
import SearchFrame from './SearchFrame'
import { failedNotSearchable, takesDay } from './takes'
import { buildTakesColumns, takeRowId } from './takes-columns'
import { useListSearch } from './use-list-search'

/** What the Takes list owns in the address: its outcome filter and its day; no sort. */
const TAKES_LIST: ListSpec = { filters: TAKE_OUTCOMES, extras: ['day'], keep: ['tab'] }

/**
 * A store's Takes tab (oms 942, spec 4157 stories 40–42): the search-first frame over
 * `StockConsole/Stores/{store}/Takes`, for one day — today by default, and written to the address with every search,
 * so a shared link reads the same day. With an item or a batch searched, a line says failed calls are left out: they
 * carry no item.
 */
export default function TakesTab({ store }: { store: string }) {
  const { t, i18n } = useTranslation('stock-console')
  const search = useListSearch(TAKES_LIST)
  // The reader's local day, taken once while the tab is open.
  const today = useMemo(() => localToday(), [])
  const read = useQuery(takesQuery(store, search.state, today))
  const columns = useMemo(() => buildTakesColumns(t, i18n.language, store), [t, i18n.language, store])

  // The day box is never empty: the address's day, or today — so Search always writes one.
  const { extras, setExtra, state } = search
  useEffect(() => {
    if (!extras.day) setExtra('day', takesDay(state, today))
  }, [extras.day, setExtra, state, today])

  const leftOut = failedNotSearchable(search.state, read.isError ? undefined : read.data)

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <SearchFrame
        name="takes"
        search={search}
        read={read}
        filterLabel={(f) => t(`takes.filter.${f}`)}
        extraBoxes={
          <Input
            type="date"
            value={extras.day ?? today}
            max={today}
            onChange={(e) => setExtra('day', e.target.value)}
            aria-label={t('takes.day')}
            className="w-fit"
            data-search-box="day"
          />
        }
        aboveRows={
          leftOut && (
            <p className="text-xs text-muted-foreground" data-failed-left-out="">
              {t('takes.failedLeftOut')}
            </p>
          )
        }
        empty={t('takes.empty')}
      >
        <ListGrid rows={read.data?.rows ?? []} columns={columns} rowId={takeRowId} name="takes" />
      </SearchFrame>
      <HowRead section="takes" paragraphs={HOW_TAKES} />
    </div>
  )
}
