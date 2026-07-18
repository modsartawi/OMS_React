import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Search } from 'lucide-react'
import { lookupQueries } from '@/core/services/lookups'
import { fromIsoDate, toIsoDate } from '@/core/util/date-format'
import { BLANK_CRITERIA, DEFAULT_LIMIT, type DeliveryFilterCriteria } from './filter'

/** Fixed Delivery Type options — WPF strings, sent as-is (R-3). */
const DELIVERY_TYPE_OPTIONS = ['Delivery', 'PickInStore']

const CONTROL =
  'h-8 w-full rounded-md border border-input bg-background px-2 text-sm ' +
  'focus:outline-none focus:ring-2 focus:ring-ring'

/**
 * Map a lookup query to sorted, de-duplicated dropdown options keyed on the
 * row's `description` — the WPF filter contract sends the description text, not
 * the code (R-3). A failed lookup degrades gracefully: one warning toast, an
 * empty list; the text filters still work.
 */
function useLookupOptions(
  query: { data?: readonly { description: string }[]; isError: boolean },
  lookupNameKey: string,
): string[] {
  const { t } = useTranslation()
  const warned = useRef(false)

  useEffect(() => {
    if (query.isError && !warned.current) {
      warned.current = true
      toast.warning(t('deliveries:lookupUnavailable.title'), {
        description: t('deliveries:lookupUnavailable.detail', { name: t(lookupNameKey) }),
      })
    }
  }, [query.isError, t, lookupNameKey])

  const descriptions = new Set<string>()
  for (const row of query.data ?? []) {
    const description = (row.description ?? '').trim()
    if (description) descriptions.add(description)
  }
  return [...descriptions].sort((a, b) => a.localeCompare(b))
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={htmlFor} className="text-xs font-medium text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  )
}

/** A select whose blank option means "no filter" (the PrimeNG "Any" placeholder). */
function AnySelect({
  id,
  value,
  onChange,
  options,
  anyLabel,
}: {
  id: string
  value: string
  onChange: (value: string) => void
  options: string[]
  anyLabel: string
}) {
  return (
    <select id={id} className={CONTROL} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{anyLabel}</option>
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  )
}

/**
 * Screen 1 filter panel — 14 controls, no validators.
 *
 * Owns the search form; on submit it hands the assembled criteria to the parent,
 * which runs the query and owns the grid. The three coded dropdowns come from
 * the session-cached lookup endpoints. Rehydrates from `initialCriteria` so the
 * last search survives a Screen 2 round trip (R-8).
 */
export default function FilterPanel({
  loading,
  initialCriteria,
  onSearch,
}: {
  loading: boolean
  initialCriteria: DeliveryFilterCriteria | null
  onSearch: (criteria: DeliveryFilterCriteria) => void
}) {
  const { t } = useTranslation('deliveries')
  const [form, setForm] = useState<DeliveryFilterCriteria>(initialCriteria ?? BLANK_CRITERIA)

  const documentTypeOptions = useLookupOptions(
    useQuery(lookupQueries.documentTypes()),
    'deliveries:lookups.documentTypes',
  )
  const documentSourceOptions = useLookupOptions(
    useQuery(lookupQueries.documentSources()),
    'deliveries:lookups.documentSources',
  )
  const deliveryDocumentTypeOptions = useLookupOptions(
    useQuery(lookupQueries.deliveryDocumentTypes()),
    'deliveries:lookups.deliveryDocumentTypes',
  )

  const set = <K extends keyof DeliveryFilterCriteria>(key: K, value: DeliveryFilterCriteria[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  /** Text fields: '' means "no filter" and is stored as null. */
  const setText = (key: keyof DeliveryFilterCriteria, value: string) =>
    set(key, (value === '' ? null : value) as DeliveryFilterCriteria[typeof key])

  function submit(event: React.FormEvent) {
    event.preventDefault()
    onSearch(form)
  }

  const textField = (key: 'documentNo' | 'deliveryNo' | 'storeCode' | 'orderNo' | 'documentReason' | 'customerPhone', type = 'text') => (
    <Field label={t(`filters.${key}`)} htmlFor={key}>
      <input
        id={key}
        type={type}
        className={CONTROL}
        autoComplete="off"
        value={form[key] ?? ''}
        onChange={(e) => setText(key, e.target.value)}
      />
    </Field>
  )

  return (
    <form
      onSubmit={submit}
      aria-label={t('filters.ariaLabel')}
      className="rounded-md border border-border bg-card p-3"
    >
      <div className="grid grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] gap-3">
        <Field label={t('filters.fromDate')} htmlFor="fromDate">
          <input
            id="fromDate"
            type="date"
            className={CONTROL}
            value={form.fromDate ? toIsoDate(form.fromDate) : ''}
            onChange={(e) => set('fromDate', fromIsoDate(e.target.value))}
          />
        </Field>
        <Field label={t('filters.toDate')} htmlFor="toDate">
          <input
            id="toDate"
            type="date"
            className={CONTROL}
            value={form.toDate ? toIsoDate(form.toDate) : ''}
            onChange={(e) => set('toDate', fromIsoDate(e.target.value))}
          />
        </Field>

        <Field label={t('filters.documentType')} htmlFor="documentType">
          <AnySelect
            id="documentType"
            value={form.documentType ?? ''}
            onChange={(v) => setText('documentType', v)}
            options={documentTypeOptions}
            anyLabel={t('filters.any')}
          />
        </Field>
        <Field label={t('filters.documentSource')} htmlFor="documentSource">
          <AnySelect
            id="documentSource"
            value={form.documentSource ?? ''}
            onChange={(v) => setText('documentSource', v)}
            options={documentSourceOptions}
            anyLabel={t('filters.any')}
          />
        </Field>
        <Field label={t('filters.deliveryDocumentType')} htmlFor="deliveryDocumentType">
          <AnySelect
            id="deliveryDocumentType"
            value={form.deliveryDocumentType ?? ''}
            onChange={(v) => setText('deliveryDocumentType', v)}
            options={deliveryDocumentTypeOptions}
            anyLabel={t('filters.any')}
          />
        </Field>

        {textField('documentNo')}

        <Field label={t('filters.limit')} htmlFor="limit">
          <input
            id="limit"
            type="number"
            min={1}
            max={20000}
            className={CONTROL}
            value={form.limit ?? ''}
            onChange={(e) => set('limit', e.target.value === '' ? null : Number(e.target.value))}
          />
        </Field>

        {textField('deliveryNo')}
        {textField('storeCode')}
        {textField('customerPhone', 'tel')}
        {textField('orderNo')}

        <Field label={t('filters.deliveryType')} htmlFor="deliveryType">
          <AnySelect
            id="deliveryType"
            value={form.deliveryType ?? ''}
            onChange={(v) => setText('deliveryType', v)}
            options={DELIVERY_TYPE_OPTIONS}
            anyLabel={t('filters.any')}
          />
        </Field>

        {textField('documentReason')}

        <Field label={t('filters.dawaaNow')} htmlFor="isExpress">
          {/* Tri-state: blank = omit the param entirely (not "No"). */}
          <select
            id="isExpress"
            className={CONTROL}
            value={form.isExpress === null ? '' : String(form.isExpress)}
            onChange={(e) => set('isExpress', e.target.value === '' ? null : e.target.value === 'true')}
          >
            <option value="">{t('filters.any')}</option>
            <option value="true">{t('common:yes')}</option>
            <option value="false">{t('common:no')}</option>
          </select>
        </Field>
      </div>

      <div className="mt-3 flex justify-end">
        <button
          type="submit"
          disabled={loading}
          className="inline-flex h-8 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
        >
          <Search className="h-4 w-4" aria-hidden />
          {loading ? t('actions.loading') : t('actions.load')}
        </button>
      </div>
    </form>
  )
}

/** The blank-form default, exported for the page's first mount. */
export { DEFAULT_LIMIT }
