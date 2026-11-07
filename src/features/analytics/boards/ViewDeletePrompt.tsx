import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { Trans, useTranslation } from 'react-i18next'
import { ShieldAlert } from 'lucide-react'
import { itemHref } from '@/core/analytics-routes'
import i18n from '@/core/i18n'
import type { AnalyticsItem, AnalyticsUsedBy } from '@/core/models/analytics'
import { saysIn } from '@/core/rules/sentence'
import { fsi } from '@/core/util/bidi'
import { analyticsApi, analyticsUsedByKey } from './api'
import { viewDeleteBlocked, viewInUse } from './item-tier'
import TierBadge from './TierBadge'
import { analyticsRefusal, refusalWords } from './wire'

/**
 * 837 item 4 (BackOffice 3432 §2): the delete prompt of a VIEW asks `UsedBy` first and names the boards that use it.
 *
 * - Only my own Personal or Shared boards: they are named, and Delete is offered (they keep a "view removed" panel).
 * - Any Certified board, someone else's, or one I cannot open (`hidden`): the view cannot be deleted — the boards
 *   are listed (with "n more you cannot open"), the prompt says to copy the view or ask the board's owner, and
 *   Delete is not offered. The same when the delete itself is refused with `ANALYTICS-416` (its `data` is UsedBy's).
 * - `UsedBy` unanswered (a server before 3432 answers 404): the prompt says it could not check, and offers Delete;
 *   the server stays the judge.
 */
export function useViewDeleteCheck(item: Pick<AnalyticsItem, 'id' | 'kind'>, open: boolean, deleteError: unknown) {
  const asks = open && item.kind === 'view'
  const usedBy = useQuery({ queryKey: analyticsUsedByKey(item.id), queryFn: () => analyticsApi.usedBy(item.id), enabled: asks, retry: false, staleTime: 0 })
  const refused = asks ? viewInUse(deleteError) : null
  const shown: AnalyticsUsedBy | null = refused ?? usedBy.data ?? null
  const blocked = asks && (!!refused || (!!usedBy.data && viewDeleteBlocked(usedBy.data)))
  return { asks, usedBy, shown, blocked, checking: asks && usedBy.isPending && !refused }
}

export type ViewDeleteCheck = ReturnType<typeof useViewDeleteCheck>

export default function ViewDeletePrompt({ check, deleteError }: { check: ViewDeleteCheck; deleteError: unknown }) {
  const { t } = useTranslation('boards')
  const k = 'tierActions.confirm.delete.usedBy'
  const { shown, blocked, checking, usedBy } = check
  // Any other refusal of the delete itself is worded here, in the prompt that is still open.
  const otherRefusal = deleteError && !viewInUse(deleteError) ? refusalWords(analyticsRefusal(deleteError, t('tierActions.failed')), t) : null
  const used = !!shown && (shown.boards.length > 0 || shown.hidden > 0)
  return (
    <div className="flex flex-col gap-2 text-sm" data-analytics-view-delete={blocked ? 'blocked' : checking ? 'checking' : used ? 'used' : 'free'}>
      {!blocked && <p>{t('tierActions.confirm.delete.body.view')}</p>}
      {checking && (
        <p className="text-muted-foreground" role="status">
          {t(`${k}.checking`)}
        </p>
      )}
      {!checking && !shown && usedBy.isError && <p className="text-muted-foreground">{t(`${k}.checkFailed`)}</p>}
      {!checking && shown && !used && !blocked && <p className="text-muted-foreground">{t(`${k}.unused`)}</p>}
      {blocked && (
        <p className="flex items-start gap-1.5 font-medium text-attention-800" role="alert">
          <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{t(`${k}.blocked`)}</span>
        </p>
      )}
      {!blocked && used && shown && <p>{t(`${k}.onMine`, { count: shown.boards.length, n: fsi(shown.boards.length) })}</p>}
      {shown && used && (
        <ul className="flex flex-col divide-y divide-border/60 rounded-md border border-border/60" data-analytics-used-by>
          {shown.boards.map((b) => (
            <li key={b.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2" data-analytics-used-by-board={b.id}>
              <Link to={itemHref('board', b.id)} className="min-w-0 flex-1 truncate font-medium text-primary underline underline-offset-2">
                <bdi>{saysIn(b.title, i18n.language) || t('home.untitled')}</bdi>
              </Link>
              <TierBadge tier={b.tier} />
              <span className="text-xs text-muted-foreground">
                <Trans t={t} i18nKey="home.owner" values={{ owner: b.owner }} components={{ owner: <bdi /> }} />
              </span>
            </li>
          ))}
          {shown.hidden > 0 && (
            <li className="px-3 py-2 text-muted-foreground" data-analytics-used-by-hidden={shown.hidden}>
              {t(`${k}.hidden`, { count: shown.hidden, n: fsi(shown.hidden) })}
            </li>
          )}
        </ul>
      )}
      {blocked && <p>{t(`${k}.advice`)}</p>}
      {otherRefusal && (
        <p className="text-xs text-attention-800" role="alert">
          <bdi>{otherRefusal}</bdi>
        </p>
      )}
    </div>
  )
}
