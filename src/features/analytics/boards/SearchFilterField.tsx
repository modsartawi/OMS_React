import { useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import type { AnalyticsDimension } from '@/core/models/analytics'
import { saysIn } from '@/core/rules/sentence'
import Field from '@/core/ui/Field'
import MultiSelect from '@/core/ui/MultiSelect'
import { fsi } from '@/core/util/bidi'
import { analyticsApi, analyticsMembersKey } from './api'

/**
 * A filter on an open breakdown — store, city, region (CTO demo builder pass): its members are too many to list,
 * so what is typed searches them through `Analytics/DimensionValues` (up to 50 matches, busiest first).
 */
export default function SearchFilterField({
  dimension,
  lang,
  value,
  onChange,
}: {
  dimension: AnalyticsDimension
  lang: string
  value: string[]
  onChange: (values: string[]) => void
}) {
  const { t } = useTranslation('boards')
  const [search, setSearch] = useState('')
  const members = useQuery({
    queryKey: analyticsMembersKey(dimension.key, search),
    queryFn: () => analyticsApi.dimensionValues(dimension.key, search),
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData,
    retry: false,
  })
  const machine = dimension.key === 'store'
  const label = t('editor.filterOn', { dimension: fsi(saysIn(dimension.label, lang) || dimension.key) })
  return (
    <Field label={label} hint={t('editor.searchFilterHint')}>
      <MultiSelect
        label={label}
        value={value}
        onChange={onChange}
        options={(members.data ?? []).map((m) => ({ value: m.key, text: saysIn(m.label, lang) || m.key, machine }))}
        optionOf={(v) => ({ value: v, text: v, machine })}
        onQueryChange={setSearch}
        loading={members.isFetching}
        failed={!!members.error}
        data-testid={`editor-filter-${dimension.key}`}
      />
    </Field>
  )
}
