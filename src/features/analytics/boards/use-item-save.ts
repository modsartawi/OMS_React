import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { AnalyticsBoard, AnalyticsItem, AnalyticsItemDefinition, AnalyticsLabel, AnalyticsReport } from '@/core/models/analytics'
import { useSession } from '@/core/session'
import type { AnalyticsAccess } from '@/core/models/analytics'
import { ANALYTICS_ACCESS_KEY, analyticsAccessQuery, canAuthorAnalytics, canCurateAnalytics, canViewAnalytics, needsAuthor, withoutAuthor } from './access'
import { ANALYTICS_ITEMS_KEY, analyticsApi, analyticsBoardKey, analyticsItemKey, analyticsReportKey } from './api'
import { itemActions, type ItemActions, type ItemActor } from './item-actions'
import { saveRefusal, type EditingItem, type SaveRefusal } from './item-save'

/** Who is acting, for `itemActions`: the session's user and the probe's grants (the gate's cached answer). */
export function useItemActor(): ItemActor {
  const userId = useSession((s) => s.userId)
  const access = useQuery(analyticsAccessQuery())
  return { userId, canView: canViewAnalytics(access.data), canAuthor: canAuthorAnalytics(access.data), canCurate: canCurateAnalytics(access.data) }
}

/** How a save goes: a new Personal item (775), in place with `baseRevision`, or as my copy (776). */
export type SaveHow = 'create' | 'in-place' | 'copy'

/** What an editor saves, whichever the kind. */
export interface ItemContent {
  title: AnalyticsLabel
  subtitle: AnalyticsLabel
  definition: AnalyticsItemDefinition
}

export interface ItemSave {
  /** The tier's actions for this actor (`./item-actions`). */
  actions: ItemActions
  save: (how: SaveHow, content: ItemContent) => void
  pending: boolean
  /** How the pending or last save went. */
  how: SaveHow | null
  error: unknown
  /** The error read in the tiers' terms (403 → copy, 405 → who/when), else `null`. */
  refusal: SaveRefusal | null
  reset: () => void
  /** 405's "reload": the item as it is now on the server, read fresh (a board or a report through its own reader). */
  reload: () => Promise<AnalyticsItem | AnalyticsBoard | AnalyticsReport>
}

/**
 * The save path every analytics editor shares (ticket 776; the view editor 775, the board editor 777, the report
 * designer 828). Kind-
 * agnostic: `create` posts `Analytics/Item`, `in-place` PUTs with `baseRevision` the revision the editor
 * opened, `copy` posts `…/Copy` from that revision. On success the store's lists and the item are re-read and
 * `onSaved` gets the saved item (for a copy, the new one).
 */
export function useItemSave({
  kind,
  editing,
  onSaved,
}: {
  kind: 'view' | 'board' | 'report'
  editing: EditingItem | null
  onSaved: (item: AnalyticsItem, how: SaveHow) => void
}): ItemSave {
  const queryClient = useQueryClient()
  const actions = itemActions(editing, useItemActor())

  const mutation = useMutation({
    mutationFn: ({ how, content }: { how: SaveHow; content: ItemContent }): Promise<AnalyticsItem> => {
      if (how === 'create' || !editing) return analyticsApi.create({ kind, ...content })
      if (how === 'in-place') return analyticsApi.update(editing.id, { ...content, baseRevision: editing.revision })
      return analyticsApi.copy(editing.id, { revision: editing.revision, ...content })
    },
    onSuccess: (item, { how }) => {
      void queryClient.invalidateQueries({ queryKey: ANALYTICS_ITEMS_KEY })
      // The saved view is the answer: the view page opens on it at its new revision, not on a stale cache.
      if (kind === 'view') queryClient.setQueryData(analyticsItemKey(item.id), item)
      for (const id of new Set([item.id, editing?.id].filter((x): x is string => !!x && !(kind === 'view' && x === item.id)))) {
        void queryClient.invalidateQueries({ queryKey: analyticsItemKey(id) })
        void queryClient.invalidateQueries({ queryKey: analyticsBoardKey(id) })
        void queryClient.invalidateQueries({ queryKey: analyticsReportKey(id) })
      }
      onSaved(item, how)
    },
    // 822: `ANALYTICS-415` from a stale probe drops the author grant from the cached probe, so the builder's actions
    // hide from then on; the refusal's words are the caller's (`./wire`).
    onError: (err) => {
      if (needsAuthor(err)) queryClient.setQueryData<AnalyticsAccess>(ANALYTICS_ACCESS_KEY, withoutAuthor)
    },
  })

  return {
    actions,
    save: (how, content) => mutation.mutate({ how, content }),
    pending: mutation.isPending,
    how: mutation.variables?.how ?? null,
    error: mutation.error,
    refusal: mutation.error ? saveRefusal(mutation.error) : null,
    reset: mutation.reset,
    reload: () => {
      if (!editing) return Promise.reject(new Error('reload: no item is being edited'))
      const id = editing.id
      if (kind === 'report') return queryClient.fetchQuery({ queryKey: analyticsReportKey(id), queryFn: () => analyticsApi.report(id), staleTime: 0 })
      return kind === 'board'
        ? queryClient.fetchQuery({ queryKey: analyticsBoardKey(id), queryFn: () => analyticsApi.board(id), staleTime: 0 })
        : queryClient.fetchQuery({ queryKey: analyticsItemKey(id), queryFn: () => analyticsApi.item(id), staleTime: 0 })
    },
  }
}
