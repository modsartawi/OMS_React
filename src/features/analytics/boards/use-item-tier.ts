import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import type { AnalyticsAccess, AnalyticsAudienceWrite, AnalyticsBoard, AnalyticsItem } from '@/core/models/analytics'
import { ANALYTICS_ACCESS_KEY, needsAuthor, withoutAuthor } from './access'
import { ANALYTICS_ITEMS_KEY, analyticsApi, analyticsBoardKey, analyticsItemKey, analyticsItemsKey, analyticsRevisionsKey } from './api'
import { itemActions } from './item-actions'
import { certifiedCopyOf, needsCurator, tierActionsOf, type TierActionKey } from './item-tier'
import { useItemActor } from './use-item-save'

/**
 * One tier write. 826: Share and narrow carry the audience the dialog chose (a Shared item's owner changes its
 * audience through the same Share action), and a reassign names the new owner.
 */
export type TierWrite =
  | { key: 'share' | 'narrow'; audience: AnalyticsAudienceWrite }
  | { key: 'reassign'; owner: string }
  | { key: Exclude<TierActionKey, 'share' | 'narrow' | 'reassign'> }

/** The toast's key: an audience change on a Shared item (826) says so, not "shared with everyone". */
const doneKey = (w: TierWrite, tier: AnalyticsItem['tier']): string =>
  w.key === 'share' ? (tier === 'personal' ? ('everyone' in w.audience ? 'share' : 'shareChosen') : 'audience') : w.key

/**
 * The tier's actions on an open view or board (ticket 778): what this actor may do (`./item-actions`, with the
 * certified copy found in `Analytics/Items`), and the doors behind them. On success the list and the item are
 * re-read, so the home regroups and the badge follows; a delete goes home. An `ANALYTICS-402` from a stale probe
 * marks the cached probe as not curating, so the curator's actions hide from then on (§C), and the caller shows
 * the reason from `error`.
 */
export function useItemTier(item: AnalyticsItem | AnalyticsBoard) {
  const { t } = useTranslation('boards')
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const actor = useItemActor()
  // Its Certified copy, if any, is a Certified item of its kind (the store's list, narrowed by §C's kind and tier).
  const certified = { kind: item.kind, tier: 'certified' } as const
  const list = useQuery({ queryKey: analyticsItemsKey(certified), queryFn: () => analyticsApi.items(certified), retry: false })
  const copy = certifiedCopyOf(list.data, item.id)
  const actions = tierActionsOf(itemActions({ owner: item.owner, tier: item.tier, certifiedCopy: !!copy }, actor).actions)

  const reread = (id: string) => {
    void queryClient.invalidateQueries({ queryKey: analyticsItemKey(id) })
    void queryClient.invalidateQueries({ queryKey: analyticsBoardKey(id) })
  }

  const mutation = useMutation({
    mutationFn: async (w: TierWrite): Promise<AnalyticsItem | null> => {
      const { key } = w
      const revision = { revision: item.revision }
      // 826: a Personal item is shared with its audience; a Shared one's audience changes through the Audience door
      // (the owner's, or a curator's narrowing), which is not a revision and never raises `ANALYTICS-405`.
      if (w.key === 'share' && item.tier === 'personal') return analyticsApi.share(item.id, { ...revision, audience: w.audience })
      if (w.key === 'share' || w.key === 'narrow') return analyticsApi.setAudience(item.id, { audience: w.audience })
      if (w.key === 'reassign') return analyticsApi.reassign(item.id, { owner: w.owner })
      if (key === 'unshare') return analyticsApi.unshare(item.id, revision)
      if (key === 'certify' || key === 'certifyRevision') return analyticsApi.certify(item.id, revision)
      if (key === 'uncertify') return analyticsApi.uncertify(item.id)
      await analyticsApi.remove(item.id)
      return null
    },
    onSuccess: (answer, w) => {
      const { key } = w
      void queryClient.invalidateQueries({ queryKey: ANALYTICS_ITEMS_KEY })
      // 826: an audience change and a reassign are written to the item's history.
      void queryClient.invalidateQueries({ queryKey: analyticsRevisionsKey(item.id) })
      toast.success(t(`tierActions.done.${doneKey(w, item.tier)}`))
      if (key === 'delete') {
        navigate('/analytics')
        queryClient.removeQueries({ queryKey: analyticsItemKey(item.id) })
        queryClient.removeQueries({ queryKey: analyticsBoardKey(item.id) })
        return
      }
      reread(item.id)
      if (answer && answer.id !== item.id) reread(answer.id)
    },
    onError: (err) => {
      // 822: `ANALYTICS-415` (needs the author grant) hides every author's action next time.
      if (needsAuthor(err)) queryClient.setQueryData<AnalyticsAccess>(ANALYTICS_ACCESS_KEY, withoutAuthor)
      if (needsCurator(err)) {
        queryClient.setQueryData<AnalyticsAccess>(ANALYTICS_ACCESS_KEY, (prev) => (prev ? { ...prev, canCurate: false } : prev))
      }
    },
  })

  return {
    actions,
    /** The Certified copy of this item, when one exists. */
    certifiedCopy: copy,
    /** A one-click action (unshare, certify, uncertify, delete). */
    run: (key: Exclude<TierActionKey, 'share' | 'narrow' | 'reassign'>) => mutation.mutate({ key }),
    /** 826: a dialog's write (share or narrow with an audience, reassign with an owner); `done` on success. */
    write: (w: TierWrite, done?: () => void) => mutation.mutate(w, { onSuccess: () => done?.() }),
    pending: mutation.isPending,
    error: mutation.error,
    reset: mutation.reset,
  }
}
