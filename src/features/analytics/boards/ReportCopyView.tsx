import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Copy } from 'lucide-react'
import type { AnalyticsItem, AnalyticsModel } from '@/core/models/analytics'
import Button from '@/core/ui/Button'
import Field from '@/core/ui/Field'
import Select from '@/core/ui/Select'
import { fsi } from '@/core/util/bidi'
import { analyticsApi, analyticsItemKey, analyticsItemsKey } from './api'
import { HOME_TIER_ORDER } from './home'
import { viewTitleOf } from './ViewChart'

/**
 * "Copy a saved view" in "Add to this section" (spec 819 §E, ticket 829; 801 §2): the views I can read
 * (`Analytics/Items`, Certified first, then Shared, then mine — as the board editor lists them), and the one
 * picked read whole (`Analytics/Item/{id}`) so its definition and revision are copied, never referenced.
 */
export default function ReportCopyView({
  model,
  lang,
  section,
  onCopy,
}: {
  model: AnalyticsModel
  lang: string
  section: string
  onCopy: (view: AnalyticsItem) => void
}) {
  const { t } = useTranslation('boards')
  const client = useQueryClient()
  const [pick, setPick] = useState('')
  const [busy, setBusy] = useState(false)
  const list = useQuery({
    queryKey: analyticsItemsKey({ kind: 'view' }),
    queryFn: () => analyticsApi.items({ kind: 'view' }),
    retry: false,
  })
  const groups = useMemo(() => {
    const views = (list.data ?? []).filter((i) => i.kind === 'view')
    return HOME_TIER_ORDER.map((tier) => ({
      tier,
      views: views.filter((v) => v.tier === tier),
    })).filter((g) => g.views.length > 0)
  }, [list.data])

  const copy = () => {
    if (!pick) return
    setBusy(true)
    client
      .fetchQuery({
        queryKey: analyticsItemKey(pick),
        queryFn: () => analyticsApi.item(pick),
        staleTime: 0,
      })
      .then((item) => {
        onCopy(item)
        setPick('')
      })
      .catch(() => toast.error(t('designer.copyView.failed')))
      .finally(() => setBusy(false))
  }

  return (
    <div className="flex min-w-0 flex-wrap items-end gap-2" data-designer-copy-view={section}>
      <Field label={t('designer.copyView.label')} className="min-w-0 flex-1">
        <Select value={pick} onChange={(e) => setPick(e.target.value)} data-designer-copy-pick={section}>
          <option value="">{t(list.isLoading ? 'designer.copyView.loading' : list.isError ? 'designer.copyView.loadFailed' : 'designer.copyView.pick')}</option>
          {groups.map((g) => (
            <optgroup key={g.tier} label={t(`home.tier.${g.tier}`)}>
              {g.views.map((v) => (
                <option key={v.id} value={v.id}>
                  {fsi(viewTitleOf(v, model, lang, t))}
                </option>
              ))}
            </optgroup>
          ))}
        </Select>
      </Field>
      <Button variant="outlined" disabled={!pick || busy} onClick={copy} data-designer-copy-go={section}>
        <Copy className="size-3.5" aria-hidden />
        {t(busy ? 'designer.copyView.copying' : 'designer.copyView.copy')}
      </Button>
    </div>
  )
}
