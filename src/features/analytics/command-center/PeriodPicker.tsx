import { useState, type FormEvent } from 'react'
import { CC_PERIOD_KINDS, type CcPeriodKind } from '@/core/models/command-center'
import Button from '@/core/ui/Button'
import Chip from '@/core/ui/Chip'
import Field from '@/core/ui/Field'
import Input from '@/core/ui/Input'
import type { CcT } from './lang'
import type { StorePeriod } from './store-profile'

/**
 * The store profile's period (oms 948, BO 4177): the rolling 4 weeks with last year beside them, year-to-date, or two
 * dates. The rolling 4 weeks and year-to-date apply on the chip; dates apply once both ends are typed. The page moves
 * the URL to the choice (`withPeriod`), so the server is asked again for it. BO 4177 states no longest range: the
 * server's refusal, if any, is shown as the page's load failure.
 */
export default function PeriodPicker({ value, onChange, t }: { value: StorePeriod; onChange: (next: StorePeriod) => void; t: CcT }) {
  const [picking, setPicking] = useState<CcPeriodKind>(value.period)
  const [from, setFrom] = useState(value.period === 'dates' ? value.from : '')
  const [to, setTo] = useState(value.period === 'dates' ? value.to : '')
  const choose = (kind: CcPeriodKind) => {
    setPicking(kind)
    if (kind === 'rolling4' || kind === 'ytd') onChange({ period: kind })
  }
  const ready = from !== '' && to !== '' && from <= to
  const apply = (event: FormEvent) => {
    event.preventDefault()
    if (ready) onChange({ period: 'dates', from, to })
  }
  return (
    <form className="flex flex-wrap items-end gap-2" onSubmit={apply} data-cc-period-picker={value.period}>
      <div className="flex flex-wrap items-center gap-1" role="group" aria-label={t('storeProfile.period.label')}>
        {CC_PERIOD_KINDS.map((kind) => (
          <Chip key={kind} on={kind === picking} onClick={() => choose(kind)} data-cc-period={kind}>
            {t(`storeProfile.period.${kind}`)}
          </Chip>
        ))}
      </div>
      {picking === 'dates' && (
        <>
          <Field label={t('storeProfile.period.from')} className="w-40">
            <Input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} dir="ltr" />
          </Field>
          <Field label={t('storeProfile.period.to')} className="w-40">
            <Input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} dir="ltr" />
          </Field>
          <Button type="submit" variant="secondary" disabled={!ready}>
            {t('storeProfile.period.apply')}
          </Button>
        </>
      )}
    </form>
  )
}
