import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import type { AnalyticsAccess, AnalyticsBoard, AnalyticsItem } from '@/core/models/analytics'
import { ANALYTICS_ACCESS_KEY } from './access'
import { ANALYTICS_ITEMS_KEY, analyticsApi, analyticsBoardKey, analyticsItemKey } from './api'
import { itemActions } from './item-actions'
import { certifiedCopyOf, needsCurator, tierActionsOf, type TierActionKey } from './item-tier'
import { useItemActor } from './use-item-save'

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
  const list = useQuery({ queryKey: ANALYTICS_ITEMS_KEY, queryFn: () => analyticsApi.items(), retry: false })
  const copy = certifiedCopyOf(list.data, item.id)
  const actions = tierActionsOf(itemActions({ owner: item.owner, tier: item.tier, certifiedCopy: !!copy }, actor).actions)

  const reread = (id: string) => {
    void queryClient.invalidateQueries({ queryKey: analyticsItemKey(id) })
    void queryClient.invalidateQueries({ queryKey: analyticsBoardKey(id) })
  }

  const mutation = useMutation({
    mutationFn: async (key: TierActionKey): Promise<AnalyticsItem | null> => {
      const revision = { revision: item.revision }
      if (key === 'share') return analyticsApi.share(item.id, revision)
      if (key === 'unshare') return analyticsApi.unshare(item.id, revision)
      if (key === 'certify' || key === 'certifyRevision') return analyticsApi.certify(item.id, revision)
      if (key === 'uncertify') return analyticsApi.uncertify(item.id)
      await analyticsApi.remove(item.id)
      return null
    },
    onSuccess: (answer, key) => {
      void queryClient.invalidateQueries({ queryKey: ANALYTICS_ITEMS_KEY })
      toast.success(t(`tierActions.done.${key}`))
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
      if (needsCurator(err)) {
        queryClient.setQueryData<AnalyticsAccess>(ANALYTICS_ACCESS_KEY, (prev) => (prev ? { ...prev, canCurate: false } : prev))
      }
    },
  })

  return {
    actions,
    /** The Certified copy of this item, when one exists. */
    certifiedCopy: copy,
    run: (key: TierActionKey) => mutation.mutate(key),
    pending: mutation.isPending,
    error: mutation.error,
    reset: mutation.reset,
  }
}
