import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import type { AnalyticsFolder, AnalyticsItem } from '@/core/models/analytics'
import { fsi } from '@/core/util/bidi'
import { ANALYTICS_FOLDERS_KEY, ANALYTICS_ITEMS_KEY, analyticsApi } from './api'
import { fileInList, moveCounts } from './library'
import { analyticsErrorWords } from './wire'

/**
 * 837 (BackOffice 3432): the library's folders and its writes, for the analytics home.
 *
 * - `folders` is `GET Analytics/Folders`. Until 3432 is on the server it is a 404: `available` is then false, and
 *   the home hides the folders (the chips and search still work client-side).
 * - Filing is OPTIMISTIC: every cached Items list and the folder counts move at once; a failure puts them back and
 *   toasts the server's words (`analyticsErrorWords` → `apiErrorMessage`).
 * - Folder writes and Restore re-read the lists when they land.
 */
export function useLibraryFolders() {
  const folders = useQuery({ queryKey: ANALYTICS_FOLDERS_KEY, queryFn: () => analyticsApi.folders(), retry: false, staleTime: 30_000 })
  return { folders: folders.data ?? [], available: folders.isSuccess, loading: folders.isPending, error: folders.error }
}

export function useFileItem() {
  const { t } = useTranslation('boards')
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ item, folderId }: { item: AnalyticsItem; folderId: string | null; folderName?: string }) => analyticsApi.fileItem(item.id, folderId),
    onMutate: async ({ item, folderId }) => {
      await queryClient.cancelQueries({ queryKey: ANALYTICS_ITEMS_KEY })
      await queryClient.cancelQueries({ queryKey: ANALYTICS_FOLDERS_KEY })
      const lists = queryClient.getQueriesData<AnalyticsItem[]>({ queryKey: ANALYTICS_ITEMS_KEY })
      const counts = queryClient.getQueryData<AnalyticsFolder[]>(ANALYTICS_FOLDERS_KEY)
      queryClient.setQueriesData<AnalyticsItem[]>({ queryKey: ANALYTICS_ITEMS_KEY }, (prev) => (prev ? fileInList(prev, item.id, folderId) : prev))
      if (counts) queryClient.setQueryData<AnalyticsFolder[]>(ANALYTICS_FOLDERS_KEY, moveCounts(counts, item.folderId, folderId))
      return { lists, counts }
    },
    onError: (err, _v, saved) => {
      saved?.lists.forEach(([key, data]: [QueryKey, AnalyticsItem[] | undefined]) => queryClient.setQueryData(key, data))
      if (saved?.counts) queryClient.setQueryData(ANALYTICS_FOLDERS_KEY, saved.counts)
      toast.error(analyticsErrorWords(err, t('home.library.move.failed'), t))
    },
    onSuccess: (_a, { folderId, folderName }) => {
      toast.success(folderId ? t('home.library.done.moved', { folder: fsi(folderName ?? '') }) : t('home.library.done.unfiled'))
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ANALYTICS_ITEMS_KEY })
      void queryClient.invalidateQueries({ queryKey: ANALYTICS_FOLDERS_KEY })
    },
  })
}

/** Create, rename (`id` given) or delete a folder. The dialog shows a refusal itself (406 names the field). */
export function useFolderWrites() {
  const { t } = useTranslation('boards')
  const queryClient = useQueryClient()
  const reread = () => {
    void queryClient.invalidateQueries({ queryKey: ANALYTICS_FOLDERS_KEY })
    void queryClient.invalidateQueries({ queryKey: ANALYTICS_ITEMS_KEY })
  }
  const save = useMutation({
    mutationFn: ({ id, name }: { id?: string; name: string }) => (id ? analyticsApi.updateFolder(id, { name }) : analyticsApi.createFolder(name)),
    onSuccess: (_f, { id }) => {
      toast.success(t(id ? 'home.library.done.renamed' : 'home.library.done.created'))
      reread()
    },
  })
  const remove = useMutation({
    mutationFn: (id: string) => analyticsApi.deleteFolder(id),
    onSuccess: () => {
      toast.success(t('home.library.done.deleted'))
      reread()
    },
  })
  return { save, remove }
}

export function useRestoreItem() {
  const { t } = useTranslation('boards')
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => analyticsApi.restore(id),
    onSuccess: () => {
      toast.success(t('home.library.done.restored'))
      void queryClient.invalidateQueries({ queryKey: ANALYTICS_ITEMS_KEY })
      void queryClient.invalidateQueries({ queryKey: ANALYTICS_FOLDERS_KEY })
    },
    onError: (err) => toast.error(analyticsErrorWords(err, t('home.library.restoreFailed'), t)),
  })
}
