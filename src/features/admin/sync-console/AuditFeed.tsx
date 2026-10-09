import { useEffect, useMemo, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import GridPager from '@/core/ui/GridPager'
import { clampToLastPageWhenCurrentPageEmpties, showsPager } from '@/core/ui/pager'
import type { SyncAudit } from '@/core/models/sync-console'
import { auditQueryOptions } from './api'
import { buildAuditColumns } from './audit-columns'
import { AUDIT_PAGE_SIZE, type AuditFilter } from './control-helpers'
import TabGrid from './TabGrid'

const auditId = (a: SyncAudit) => a.id

/**
 * One page of `GET ActionSync/Audit` (ticket 447), newest first, paged by the door at
 * 50 — the fleet-wide Audit page and a store's Audit tab both draw through this. The
 * caller keys it on its filter, so a new filter starts again at page 1.
 */
export default function AuditFeed({ filter, empty }: { filter: AuditFilter; empty: string }) {
  const { t } = useTranslation('sync-console')
  const [page, setPage] = useState(1)
  const audit = useQuery({ ...auditQueryOptions(filter, page), placeholderData: keepPreviousData })
  const columns = useMemo(() => buildAuditColumns(t), [t])
  // As on the Fleet table: a failed read draws none of the previous page's rows.
  const shown = audit.isError ? undefined : audit.data
  const total = shown?.total ?? 0

  // A later read can shrink the feed under an inner page: an emptied page falls back to the last.
  const settled = shown && !audit.isPlaceholderData ? shown : undefined
  useEffect(() => {
    if (!settled) return
    const last = clampToLastPageWhenCurrentPageEmpties({
      page: settled.page,
      rowCount: settled.items.length,
      totalMatches: settled.total,
      pageSize: AUDIT_PAGE_SIZE,
    })
    if (last !== settled.page) setPage((p) => (p === settled.page ? last : p))
  }, [settled])

  return (
    <div className="flex flex-col gap-2">
      <TabGrid
        rows={shown?.items}
        columns={columns}
        rowId={auditId}
        pending={audit.isPending}
        error={audit.error}
        failed={t('audit.failed')}
        empty={page > 1 ? t('audit.emptyPage') : empty}
        loading={t('audit.loading')}
        data="audit"
      />
      {/* Drawn beside an empty or failed inner page too: it is the only way back from one. */}
      {((shown && showsPager(total, AUDIT_PAGE_SIZE)) || page > 1) && (
        <div className="overflow-hidden rounded-md border border-border/60">
          <GridPager
            page={page}
            pageSize={AUDIT_PAGE_SIZE}
            totalMatches={total}
            busy={audit.isPlaceholderData}
            onPage={setPage}
          />
        </div>
      )}
    </div>
  )
}
