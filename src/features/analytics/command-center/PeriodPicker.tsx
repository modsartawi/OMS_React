import { useState, type FormEvent } from 'react'
import type { CcPeriodChoice } from '@/core/command-center-routes'
import { CC_PERIOD_KINDS, type CcPeriodKind } from '@/core/models/command-center'
import Button from '@/core/ui/Button'
import Chip from '@/core/ui/Chip'
import Field from '@/core/ui/Field'
import Input from '@/core/ui/Input'
import type { CcT } from './lang'
import { chipChoice, datesChoice } from './period-picker'

/**
 * A profile's period (oms 948 store profile, BO 4177; 949 category profile, BO 4178): the rolling 4 weeks, year-to-date,
 * or two dates. The rolling 4 weeks and year-to-date apply on the chip; dates apply once both ends are typed
 * (`./period-picker`). The page moves the URL to the choice (`withPeriod`), so the server is asked again for it. The
 * BO tickets state no longest range: the server's refusal, if any, is shown as the page's load failure.
 */
export default function PeriodPicker({ value, onChange, t }: { value: CcPeriodChoice; onChange: (next: CcPeriodChoice) => void; t: CcT }) {
  const [picking, setPicking] = useState<CcPeriodKind>(value.period)
  const [from, setFrom] = useState(value.period === 'dates' ? value.from : '')
  const [to, setTo] = useState(value.period === 'dates' ? value.to : '')
  const choose = (kind: CcPeriodKind) => {
    setPicking(kind)
    const next = chipChoice(kind)
    if (next) onChange(next)
  }
  const dates = datesChoice(from, to)
  const apply = (event: FormEvent) => {
    event.preventDefault()
    if (dates) onChange(dates)
  }
  return (
    <form className="flex flex-wrap items-end gap-2" onSubmit={apply} data-cc-period-picker={value.period}>
      <div className="flex flex-wrap items-center gap-1" role="group" aria-label={t('period.label')}>
        {CC_PERIOD_KINDS.map((kind) => (
          <Chip key={kind} on={kind === picking} onClick={() => choose(kind)} data-cc-period={kind}>
            {t(`period.${kind}`)}
          </Chip>
        ))}
      </div>
      {picking === 'dates' && (
        <>
          <Field label={t('period.from')} className="w-40">
            <Input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} dir="ltr" />
          </Field>
          <Field label={t('period.to')} className="w-40">
            <Input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} dir="ltr" />
          </Field>
          <Button type="submit" variant="secondary" disabled={!dates}>
            {t('period.apply')}
          </Button>
        </>
      )}
    </form>
  )
}
