import { useId, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { History, RotateCcw, Undo2 } from 'lucide-react'
import { apiErrorMessage } from '@/core/api'
import { formatClock, formatDay } from '@/core/charts/format'
import i18n from '@/core/i18n'
import type { AnalyticsItem, AnalyticsLabel, AnalyticsTier } from '@/core/models/analytics'
import Button from '@/core/ui/Button'
import Ltr from '@/core/ui/Ltr'
import SideSheet from '@/core/ui/SideSheet'
import SideSheetHeader from '@/core/ui/SideSheetHeader'
import { formatPair, fsi } from '@/core/util/bidi'
import { saysIn } from '@/core/rules/sentence'
import { ANALYTICS_ITEMS_KEY, analyticsApi, analyticsBoardKey, analyticsItemKey, analyticsReportKey, analyticsRevisionsKey } from './api'
import { mayEditItem, revisionList, type RevisionRow } from './revisions'
import { useItemActor } from './use-item-save'
import { analyticsErrorWords } from './wire'

/** The last revert, so it can be undone: back to the revision that was showing before it. */
interface LastRevert {
  to: number
  now: number
  undo: number
}

/** What the history needs of an item: which one, the revision showing, its standing (who may edit) and its title. */
export interface HistoryItem {
  id: string
  revision: number
  owner: string
  tier: AnalyticsTier
  title?: AnalyticsLabel
}

/**
 * An item's history (spec 766 story 63, ticket 779), kind-agnostic: the view page, the board page, and (spec 819
 * stories 15 and 91) the report page and the report designer each put `<ItemHistory>` in their header. Only someone who may edit the item (776's tier rule, `./revisions`
 * `mayEditItem`) sees the "History" button. The sheet lists the last 20 revisions newest first, who and when,
 * the one being viewed marked; any other can be reverted to. A revert writes a NEW revision, so the note after it
 * offers "Undo", which is just a revert back to the revision that was showing. Audience changes and reassigns are
 * listed as events (826). `onReverted` tells the host a revert (or its undo) landed — the designer re-reads its draft.
 */
export default function ItemHistory({
  item,
  kind,
  onReverted,
  may: mayOverride,
}: {
  item: HistoryItem
  kind: 'view' | 'board' | 'report'
  onReverted?: () => void
  /** 890: who may edit a SQL item is its own rule (`./sql-editor` `sqlItemActions`), not the tier's. */
  may?: boolean
}) {
  const { t } = useTranslation('boards')
  const [open, setOpen] = useState(false)
  const byTier = mayEditItem(item, useItemActor())
  const may = mayOverride ?? byTier
  if (!may) return null
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)} data-analytics-history-open>
        <History className="size-3.5" aria-hidden />
        {t('history.open')}
      </Button>
      {open && <HistorySheet item={item} kind={kind} onReverted={onReverted} onClose={() => setOpen(false)} />}
    </>
  )
}

function HistorySheet({ item, kind, onReverted, onClose }: { item: HistoryItem; kind: 'view' | 'board' | 'report'; onReverted?: () => void; onClose: () => void }) {
  const { t } = useTranslation('boards')
  const lang = i18n.language
  const titleId = useId()
  const queryClient = useQueryClient()
  const [last, setLast] = useState<LastRevert | null>(null)
  const revisions = useQuery({ queryKey: analyticsRevisionsKey(item.id), queryFn: () => analyticsApi.revisions(item.id), staleTime: 0, retry: false })

  const revert = useMutation({
    mutationFn: (revision: number) => analyticsApi.revert(item.id, { revision }),
    onSuccess: (saved, revision) => {
      // The revision that was showing is what "Undo" goes back to.
      setLast({ to: revision, now: saved.revision, undo: item.revision })
      // A view's answer is the item at its new revision; a board or a report is re-read through its own reader.
      if (kind === 'view') queryClient.setQueryData<AnalyticsItem>(analyticsItemKey(item.id), saved)
      else void queryClient.invalidateQueries({ queryKey: kind === 'board' ? analyticsBoardKey(item.id) : analyticsReportKey(item.id) })
      onReverted?.()
      void queryClient.invalidateQueries({ queryKey: analyticsRevisionsKey(item.id) })
      void queryClient.invalidateQueries({ queryKey: ANALYTICS_ITEMS_KEY })
      toast.success(t('history.reverted', { revision: fsi(String(revision)) }))
    },
    onError: (err) => toast.error(analyticsErrorWords(err, t('history.revertFailed'), t)),
  })

  const rows = revisions.data ? revisionList(revisions.data, item.revision) : []
  const title = saysIn(item.title, lang)

  return (
    <SideSheet onClose={onClose} width="w-[28rem]" aria-labelledby={titleId} data-analytics-history>
      <SideSheetHeader
        titleId={titleId}
        eyebrow={t('history.eyebrow')}
        title={title ? <bdi>{title}</bdi> : t(`history.untitled.${kind}`)}
        hint={t('history.hint')}
        closeLabel={t('history.close')}
        onClose={onClose}
      />
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
        {last && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border/60 bg-muted/40 p-3 text-sm" role="status" data-analytics-revert-done={last.now}>
            <span className="min-w-0 flex-1">
              <Trans
                t={t}
                i18nKey="history.revertedNote"
                values={{ to: String(last.to), now: String(last.now) }}
                components={{ to: <Ltr />, now: <Ltr /> }}
              />
            </span>
            <Button variant="secondary" onClick={() => revert.mutate(last.undo)} disabled={revert.isPending} data-analytics-revert-undo={last.undo}>
              <Undo2 className="size-3.5" aria-hidden />
              {t('history.undo')}
            </Button>
          </div>
        )}
        {revisions.error ? (
          <p className="text-sm text-destructive" role="alert" data-analytics-history-failed>
            {apiErrorMessage(revisions.error, t('history.loadFailed'))}
          </p>
        ) : !revisions.data ? (
          <p className="text-sm text-muted-foreground" role="status">
            {t('history.loading')}
          </p>
        ) : (
          <ol className="flex flex-col divide-y divide-border/60" data-analytics-revisions>
            {rows.map((r, i) => (
              <RevisionLine key={r.event ? `${r.event}:${i}` : r.revision} row={r} lang={lang} pending={revert.isPending} onRevert={() => revert.mutate(r.revision)} />
            ))}
          </ol>
        )}
      </div>
    </SideSheet>
  )
}

function RevisionLine({ row, lang, pending, onRevert }: { row: RevisionRow; lang: string; pending: boolean; onRevert: () => void }) {
  const { t } = useTranslation('boards')
  const at = row.at ? formatPair(formatDay(row.at, lang), formatClock(row.at, lang)) : ''
  return (
    <li
      className="flex items-center gap-3 py-2"
      data-analytics-revision={row.event ? undefined : row.revision}
      data-analytics-history-event={row.event}
      data-viewing={row.viewing ? 'true' : 'false'}
      aria-current={row.viewing ? 'true' : undefined}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-sm font-medium">
          {/* 826: an audience change or a reassign is written to the history, but is not a revision. */}
          {row.event === 'audience' ? (
            t('history.event.audience')
          ) : row.event === 'reassign' ? (
            row.owner ? (
              <Trans t={t} i18nKey="history.event.reassignTo" values={{ owner: row.owner }} components={{ owner: <Ltr /> }} />
            ) : (
              t('history.event.reassign')
            )
          ) : (
            <Trans t={t} i18nKey="history.revision" values={{ revision: String(row.revision) }} components={{ n: <Ltr /> }} />
          )}
          {row.viewing && (
            <span className="ms-2 rounded-full bg-accent px-2 py-0.5 text-xs font-normal" data-analytics-revision-viewing>
              {t('history.viewing')}
            </span>
          )}
        </span>
        <span className="text-xs text-muted-foreground" data-analytics-revision-who>
          {row.by && at ? (
            <Trans t={t} i18nKey={row.event ? 'history.event.byAt' : 'history.byAt'} values={{ by: row.by, at }} components={{ by: <bdi />, at: <Ltr /> }} />
          ) : row.by ? (
            <Trans t={t} i18nKey={row.event ? 'history.event.by' : 'history.by'} values={{ by: row.by }} components={{ by: <bdi /> }} />
          ) : (
            at && <Ltr>{at}</Ltr>
          )}
        </span>
        {row.revertedFrom != null && (
          <span className="text-xs text-muted-foreground" data-analytics-revision-reverted-from={row.revertedFrom}>
            <Trans t={t} i18nKey="history.revertedFrom" values={{ revision: String(row.revertedFrom) }} components={{ n: <Ltr /> }} />
          </span>
        )}
      </div>
      {row.canRevert && (
        <Button variant="secondary" onClick={onRevert} disabled={pending} data-analytics-revert={row.revision}>
          <RotateCcw className="size-3.5" aria-hidden />
          {t('history.revert')}
        </Button>
      )}
    </li>
  )
}
