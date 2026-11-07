import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { AnalyticsItem, AnalyticsModel } from '@/core/models/analytics'
import Select from '@/core/ui/Select'
import { fsi } from '@/core/util/bidi'
import { HOME_TIER_ORDER } from './home'
import { viewTitleOf } from './ViewChart'

/**
 * The saved views I can read, as one `Select` grouped by tier in the home's order (Certified, then Shared, then
 * mine): the board editor's "Add a view" (777) and the report designer's "Copy a saved view" (829) both pick
 * through it. Each option's title is model text in a string-only sink, so it is isolated whole (`fsi`).
 */
export default function ViewPicker({
  items,
  value,
  onChange,
  placeholder,
  model,
  lang,
  ...data
}: {
  items: readonly AnalyticsItem[] | undefined
  value: string
  onChange: (id: string) => void
  /** The first, empty option's words (loading, failed, or "pick a view"). */
  placeholder: string
  model: AnalyticsModel
  lang: string
} & { [key: `data-${string}`]: string | undefined }) {
  const { t } = useTranslation('boards')
  const groups = useMemo(() => {
    const views = (items ?? []).filter((i) => i.kind === 'view')
    return HOME_TIER_ORDER.map((tier) => ({ tier, views: views.filter((v) => v.tier === tier) })).filter((g) => g.views.length > 0)
  }, [items])
  return (
    <Select value={value} onChange={(e) => onChange(e.target.value)} {...data}>
      <option value="">{placeholder}</option>
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
  )
}
