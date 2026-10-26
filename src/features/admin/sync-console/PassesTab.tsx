import { useEffect, useMemo, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import GridPager from '@/core/ui/GridPager'
import { clampToLastPageWhenCurrentPageEmpties, showsPager } from '@/core/ui/pager'
import Input from '@/core/ui/Input'
import type { StorePass } from '@/core/models/sync-console'
import { storePassesQuery } from './api'
import { PASSES_PAGE_SIZE, clampPassesFrom, passesFromBound } from './store-helpers'
import { buildPassColumns } from './store-columns'
import PassDetailModal from './PassDetailModal'
import TabGrid from './TabGrid'

const passId = (p: StorePass) => p.processId

/**
 * The Passes tab (ticket 446): the store's passes since `from`, newest first, paged
 * by the door at 50. `from` opens on 7 days ago and cannot go past the 30 days the
 * door keeps (`passesFromBound`, `clampPassesFrom`, from today's LOCAL date), so the
 * door's `BAD_DATE` is never provoked. Clicking a pass opens its detail.
 */
export default function PassesTab({ code }: { code: string }) {
  const { t } = useTranslation('sync-console')
  // Today is read on every render and every edit, so a tab left open past midnight
  // moves its 30-day bound with the calendar instead of offering a day the door now refuses.
  const bound = passesFromBound(new Date())
  // `from` is what is asked; `draft` is what the box holds while someone types in it.
  const [from, setFrom] = useState(bound.initial)
  const [draft, setDraft] = useState(bound.initial)
  const [page, setPage] = useState(1)
  const [opened, setOpened] = useState<StorePass | null>(null)

  const passes = useQuery({ ...storePassesQuery(code, from, page), placeholderData: keepPreviousData })
  const columns = useMemo(() => buildPassColumns(t, setOpened), [t])
  // As on the Fleet table: a failed read draws none of the previous date's rows.
  const shown = passes.isError ? undefined : passes.data
  const total = shown?.total ?? 0

  // As on the Fleet table: a later read can shrink the list under an inner page (passes
  // age out of the window), and an emptied inner page falls back to the new last page.
  const settled = shown && !passes.isPlaceholderData ? shown : undefined
  useEffect(() => {
    if (!settled) return
    const last = clampToLastPageWhenCurrentPageEmpties({
      page: settled.page,
      rowCount: settled.items.length,
      totalMatches: settled.total,
      pageSize: PASSES_PAGE_SIZE,
    })
    if (last !== settled.page) setPage((p) => (p === settled.page ? last : p))
  }, [settled])

  const ask = (day: string) => {
    setDraft(day)
    if (day !== from) {
      setFrom(day)
      setPage(1)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {t('passes.from')}
          <Input
            type="date"
            value={draft}
            min={bound.min}
            max={bound.max}
            // A date inside the window is asked at once (the picker's own choice). One
            // outside it is held until the box is left, so typing a year digit by digit
            // (0002, 0020, …) is not snapped to the bound under the keyboard.
            onChange={(e) => {
              const typed = e.target.value
              if (typed !== '' && clampPassesFrom(typed, new Date()) === typed) ask(typed)
              else setDraft(typed)
            }}
            onBlur={() => ask(clampPassesFrom(draft, new Date()))}
            data-passes-from=""
          />
        </label>
        <span className="text-xs text-muted-foreground">{t('passes.fromHint')}</span>
        {/* The previous date's rows stay drawn while the new ones load: say so. */}
        {passes.isPlaceholderData && (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground" role="status" data-passes-loading="">
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
            {t('passes.loading')}
          </span>
        )}
      </div>
      <TabGrid
        rows={shown?.items}
        columns={columns}
        rowId={passId}
        pending={passes.isPending}
        error={passes.error}
        failed={t('passes.failed')}
        empty={t(page > 1 ? 'passes.emptyPage' : 'passes.empty')}
        loading={t('passes.loading')}
        data="passes"
      />
      {/* Drawn beside an empty or failed inner page too: it is the only way back from one. */}
      {((shown && showsPager(total, PASSES_PAGE_SIZE)) || page > 1) && (
        <div className="overflow-hidden rounded-md border border-border/60">
          <GridPager
            page={page}
            pageSize={PASSES_PAGE_SIZE}
            totalMatches={total}
            busy={passes.isPlaceholderData}
            onPage={setPage}
          />
        </div>
      )}
      <PassDetailModal pass={opened} onClose={() => setOpened(null)} />
    </div>
  )
}
