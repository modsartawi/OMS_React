import { useEffect, useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { RotateCcw } from 'lucide-react'
import Button from '@/core/ui/Button'
import Field from '@/core/ui/Field'
import Input from '@/core/ui/Input'
import Ltr from '@/core/ui/Ltr'
import { MAX_DAYS, type ResolvedRange, type ScorecardFilters } from './range'

export const FILTER_INPUTS = ['type', 'channel', 'city', 'region', 'store'] as const
export type TextFilters = Pick<ScorecardFilters, (typeof FILTER_INPUTS)[number]>
export type RangeAndTextFilters = Pick<ScorecardFilters, 'from' | 'to'> & TextFilters

const textFiltersOf = (f: TextFilters): TextFilters => ({
  type: f.type,
  channel: f.channel,
  city: f.city,
  region: f.region,
  store: f.store,
})
const BLANK: TextFilters = { type: '', channel: '', city: '', region: '', store: '' }

/**
 * The scorecard's range and filters (ticket 543), shared by the scorecard and the closes report (758).
 * The range writes the URL at once; the text filters are a draft, applied together on Enter or Apply
 * (the board's way): typed into the URL on every key they could not hold an inner space ("Al Khobar")
 * and each key fired a read.
 */
export default function FilterForm<F extends RangeAndTextFilters>({
  filters,
  range,
  update,
  changedFromOutside,
  onReset,
}: {
  filters: F
  range: ResolvedRange
  update: (change: (prev: F) => F) => void
  changedFromOutside: () => boolean
  /** Back to the defaults; the text filters are blanked here. */
  onReset: () => void
}) {
  const { t } = useTranslation('dispatch-scorecard')
  const [draft, setDraft] = useState<TextFilters>(() => textFiltersOf(filters))
  useEffect(() => {
    if (changedFromOutside()) setDraft(textFiltersOf(filters))
  }, [filters, changedFromOutside])
  const applyDraft = () => {
    const applied = Object.fromEntries(FILTER_INPUTS.map((key) => [key, draft[key].trim()])) as TextFilters
    setDraft(applied)
    update((prev) => ({ ...prev, ...applied }))
  }
  const patch = (p: Partial<RangeAndTextFilters>) => update((prev) => ({ ...prev, ...p }))

  return (
    <form
      className="flex flex-wrap items-end gap-3 rounded-lg border border-border/60 bg-card/40 p-3"
      onSubmit={(e) => {
        e.preventDefault()
        applyDraft()
      }}
      data-sc-filters=""
    >
      <Field label={t('filters.from')}>
        <Input
          type="date"
          value={filters.from || (range.ok ? range.from : '')}
          onChange={(e) => patch({ from: e.target.value, to: filters.to || (range.ok ? range.to : '') })}
          className="w-40"
          data-sc-filter="from"
        />
      </Field>
      <Field label={t('filters.to')}>
        <Input
          type="date"
          value={filters.to || (range.ok ? range.to : '')}
          onChange={(e) => patch({ to: e.target.value, from: filters.from || (range.ok ? range.from : '') })}
          className="w-40"
          data-sc-filter="to"
        />
      </Field>
      {FILTER_INPUTS.map((key) => (
        <Field key={key} label={t(`filters.${key}`)}>
          <Input
            type="text"
            value={draft[key]}
            onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
            placeholder={t('filters.any')}
            className="w-28"
            data-sc-filter={key}
          />
        </Field>
      ))}
      <Button type="submit" variant="secondary" data-sc-apply="">
        {t('filters.apply')}
      </Button>
      <Button
        variant="outlined"
        onClick={() => {
          setDraft(BLANK)
          onReset()
        }}
        data-sc-reset=""
      >
        <RotateCcw className="h-3.5 w-3.5" aria-hidden />
        {t('filters.reset')}
      </Button>
      {!range.ok && (
        <p role="alert" className="basis-full text-xs text-danger-800" data-sc-problem={range.problem}>
          {range.problem === 'tooLong' ? (
            <Trans t={t} i18nKey="problem.tooLong" values={{ max: String(MAX_DAYS) }} components={{ max: <Ltr /> }} />
          ) : (
            t(`problem.${range.problem}`)
          )}
        </p>
      )}
    </form>
  )
}
