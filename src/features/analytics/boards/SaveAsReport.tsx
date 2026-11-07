import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import { FileText } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { reportEditHref } from '@/core/analytics-routes'
import { apiErrorMessage } from '@/core/api'
import type { AnalyticsAccess, AnalyticsBoard, AnalyticsItem, AnalyticsModel } from '@/core/models/analytics'
import Button from '@/core/ui/Button'
import { fsi } from '@/core/util/bidi'
import { ANALYTICS_ACCESS_KEY, needsAuthor, withoutAuthor } from './access'
import { ANALYTICS_ITEMS_KEY, analyticsApi } from './api'
import { boardToReport } from './board-to-report'

/**
 * "Save as report" on a board (ticket 830): creates a Personal report from the board (`./board-to-report`) and
 * opens it in the designer. Shown to an author who may edit or copy the board; it waits until the board's
 * views have been read, since their definitions are copied inline. An `ANALYTICS-415` hides it from then on.
 */
export default function SaveAsReport({ board, views, pending, model }: { board: AnalyticsBoard; views: ReadonlyMap<string, AnalyticsItem>; pending: boolean; model: AnalyticsModel }) {
  const { t } = useTranslation('boards')
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const save = useMutation({
    mutationFn: () => {
      const { create, missing } = boardToReport(board, views, model)
      return analyticsApi.create(create).then((item) => ({ item, missing }))
    },
    onSuccess: ({ item, missing }) => {
      void queryClient.invalidateQueries({ queryKey: ANALYTICS_ITEMS_KEY })
      toast.success(t('board.saveAsReport.done'), missing.length ? { description: t('board.saveAsReport.leftOut', { count: missing.length, n: fsi(missing.length) }) } : undefined)
      navigate(reportEditHref(item.id))
    },
    onError: (err) => {
      if (needsAuthor(err)) queryClient.setQueryData<AnalyticsAccess>(ANALYTICS_ACCESS_KEY, withoutAuthor)
      toast.error(apiErrorMessage(err, t('board.saveAsReport.failed')))
    },
  })
  return (
    <Button variant="secondary" disabled={pending || save.isPending} onClick={() => save.mutate()} data-analytics-board-save-report>
      <FileText className="size-4" aria-hidden />
      {t('board.saveAsReport.action')}
    </Button>
  )
}
