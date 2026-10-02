// Throwaway filter composition: all 14 production criteria, unchanged request meanings.
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, ChevronUp, Search, X } from 'lucide-react'
import Button from '@/core/ui/Button'
import { fromIsoDate, toIsoDate } from '@/core/util/date-format'
import { BLANK_CRITERIA, buildDeliveryQuery, DEFAULT_LIMIT, type DeliveryFilterCriteria } from '../filter'

type Field = keyof DeliveryFilterCriteria
// Fixture lookup descriptions, not a replacement for production lookup endpoints.
const choices: Partial<Record<Field, string[]>> = {
  documentType: ['Call Center', 'Web Order', 'Store Order'],
  documentSource: ['Call center', 'Web', 'Store'],
  deliveryDocumentType: ['Standard Delivery', 'Return Delivery'],
  deliveryType: ['Delivery', 'PickInStore'],
}
const common: Field[] = ['fromDate', 'toDate', 'storeCode', 'deliveryNo', 'customerPhone']
const groups: { name: string; fields: Field[] }[] = [
  { name: 'identityGroup', fields: ['documentNo', 'orderNo'] },
  { name: 'classificationGroup', fields: ['documentType', 'documentSource', 'deliveryDocumentType', 'documentReason'] },
  { name: 'fulfilmentGroup', fields: ['deliveryType', 'isExpress'] },
  { name: 'resultsGroup', fields: ['limit'] },
]

export default function ThemePrototypeFilters({ applied, onApply, onReset }: {
  applied: DeliveryFilterCriteria; onApply: (criteria: DeliveryFilterCriteria) => void; onReset: () => void
}) {
  const { t } = useTranslation('theme-prototype')
  const [draft, setDraft] = useState(applied)
  const [expanded, setExpanded] = useState(false)
  const label = (key: Field) => t(`deliveries:filters.${key === 'isExpress' ? 'dawaaNow' : key}`)
  const set = (key: Field, value: DeliveryFilterCriteria[Field]) => setDraft(old => ({ ...old, [key]: value }))
  const dirty = JSON.stringify(draft) !== JSON.stringify(applied)
  const active = (Object.keys(applied) as Field[]).filter(key => key === 'fromDate'
    ? applied.fromDate && applied.toDate
    : key !== 'toDate' && key !== 'limit' && applied[key] !== null && applied[key] !== '')
  const extraCount = active.filter(key => !common.includes(key)).length
  const valueText = (key: Field) => key === 'fromDate'
    ? `${toIsoDate(applied.fromDate!)} — ${toIsoDate(applied.toDate!)}`
    : key === 'isExpress' ? t(applied.isExpress ? 'common:yes' : 'common:no') : String(applied[key])
  const remove = (key: Field) => {
    const patch = key === 'fromDate' ? { fromDate: null, toDate: null } : { [key]: null }
    setDraft(old => ({ ...old, ...patch }))
    onApply({ ...applied, ...patch })
  }
  const field = (key: Field) => <div key={key} className="prototype-filter-field">
    <label htmlFor={`prototype-${key}`}>{label(key)}</label>
    {key === 'fromDate' || key === 'toDate'
      ? <input id={`prototype-${key}`} type="date" value={draft[key] ? toIsoDate(draft[key]) : ''} onChange={e => set(key, fromIsoDate(e.target.value))} />
      : key === 'isExpress'
        ? <select id={`prototype-${key}`} value={draft.isExpress === null ? '' : String(draft.isExpress)} onChange={e => set(key, e.target.value === '' ? null : e.target.value === 'true')}>
          <option value="">{t('deliveries:filters.any')}</option><option value="true">{t('common:yes')}</option><option value="false">{t('common:no')}</option>
        </select>
        : choices[key]
          ? <select id={`prototype-${key}`} value={String(draft[key] ?? '')} onChange={e => set(key, e.target.value || null)}>
            <option value="">{t('deliveries:filters.any')}</option>{choices[key]!.map(value => <option key={value}>{value}</option>)}
          </select>
          : <input id={`prototype-${key}`} type={key === 'limit' ? 'number' : key === 'customerPhone' ? 'tel' : 'text'}
            min={key === 'limit' ? 1 : undefined} max={key === 'limit' ? 20000 : undefined}
            autoComplete="off" value={String(draft[key] ?? '')}
            onChange={e => set(key, e.target.value === '' ? null : key === 'limit' ? Number(e.target.value) : e.target.value)} />}
  </div>
  return <div className="prototype-filter-system">
    <form className="prototype-filters" aria-label={t('deliveries:filters.ariaLabel')} onSubmit={e => {
      e.preventDefault()
      // Keep production normalization (paired dates, trimmed text, default limit).
      const query = buildDeliveryQuery(draft)
      onApply({ ...draft, limit: Number(query.Limit) })
    }}>
      <div className="prototype-common-filters">{common.map(field)}</div>
      <div id="prototype-all-filters" className="prototype-expanded-filters" hidden={!expanded}>
        {groups.map(group => <fieldset key={group.name} className={`prototype-filter-group ${group.name}`}>
          <legend>{t(group.name)}</legend><div>{group.fields.map(field)}</div>
        </fieldset>)}
      </div>
      <div className="prototype-filter-footer">
        <Button variant="text" aria-expanded={expanded} aria-controls="prototype-all-filters" onClick={() => setExpanded(!expanded)}>
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}{t(expanded ? 'fewerFilters' : 'allFilters')}
          {extraCount > 0 && <span className="prototype-filter-count">{t('appliedExtra', { count: extraCount })}</span>}
        </Button>
        <span className="prototype-draft-state" role="status">{dirty ? t('unapplied') : t('filterCount')}</span>
        <div className="prototype-filter-actions">
          <Button variant="outlined" onClick={() => { setDraft(BLANK_CRITERIA); onReset() }}>{t('clearAll')}</Button>
          <Button type="submit"><Search size={14} />{t('search')}</Button>
        </div>
      </div>
      {(draft.fromDate === null) !== (draft.toDate === null) && <p className="prototype-date-hint">{t('pairedDates')}</p>}
    </form>
    <div className="prototype-active-filters" aria-label={t('activeFilters')}>
      {active.length > 0 ? <><span>{t('activeFilters')}</span>{active.map(key => <button key={key} onClick={() => remove(key)} aria-label={t('removeFilter', { label: label(key) })}>
        <span>{label(key)}: <bdi>{valueText(key)}</bdi></span><X size={12} />
      </button>)}</> : <span>{t('noFilters')}</span>}
      <span className="prototype-limit-summary">{t('appliedLimit', { count: applied.limit || DEFAULT_LIMIT })}</span>
    </div>
  </div>
}
