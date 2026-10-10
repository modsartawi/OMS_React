import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import type { StoreCounter } from '@/core/models/sync-console'
import { storeCountersQuery } from './api'
import { buildCounterColumns } from './store-columns'
import TabGrid from './TabGrid'

/** A counter's row id: its line, object and direction together. */
const counterId = (c: StoreCounter) => `${c.lineNumber}-${c.objectId}-${c.bound}`

/**
 * The Counters tab (ticket 446): every counter of the store with the action-log head
 * and the lag the door computed. A pull counter has no log head or lag (`null`), and
 * is drawn blank rather than as a `0` that would read as "caught up".
 */
export default function CountersTab({ code }: { code: string }) {
  const { t } = useTranslation('sync-console')
  const counters = useQuery(storeCountersQuery(code))
  const columns = useMemo(() => buildCounterColumns(t), [t])
  return (
    <TabGrid
      rows={counters.data?.items}
      columns={columns}
      rowId={counterId}
      pending={counters.isPending}
      error={counters.error}
      failed={t('counters.failed')}
      empty={t('counters.empty')}
      loading={t('counters.loading')}
      data="counters"
    />
  )
}
